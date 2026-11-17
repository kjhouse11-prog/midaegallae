// 미대갈래 — AI 작품 진단 (Supabase Edge Function, Deno)
//
// 앱이 작품 id만 보내면, 서버가
//   1) 로그인한 학생 본인의 작품인지 확인하고
//   2) 비공개 저장소(artworks)에서 사진을 직접 읽어
//   3) Claude에게 보내 6개 항목 점수·잘한 점·보완할 점·강사 코멘트를 받고
//   4) analyses 테이블에 저장한 뒤 결과를 돌려줍니다.
// → Claude API 키는 서버에만 있고, 학생이 점수를 꾸며 저장할 수 없습니다.
//
// 배포 (대표 PC, Supabase CLI):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        (필수)
//   supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5-5    (선택, 기본값 동일)
//   supabase secrets set AI_DAILY_LIMIT=10                    (선택, 1인 하루 진단 횟수)
//   supabase functions deploy analyze-artwork
// SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 넣어 줍니다.

import { createClient } from "npm:@supabase/supabase-js@2";

const AXES = ["구도", "형태", "명암", "색채", "완성도", "발상"] as const;
const VIEWS: [string, string][] = [["front", "앞"], ["back", "뒤"], ["left", "좌"], ["right", "우"]];
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") || "10");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
// code: 앱이 상황별로 안내 문구를 고르는 데 씀 (not_configured 이면 앱이 데모 진단으로 대신함)
const fail = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);

// 분야별 실기 평가 관점 — 「미대입시」 심사평에서 자주 보는 기준을 요약
const FIELD_GUIDE: Record<string, string> = {
  기초디자인: "주어진 사물·주제의 특징을 살린 화면 구성, 형태의 정확한 묘사, 색채 계획과 대비, 주제 해석의 참신함",
  사고의전환: "주제를 비틀어 새롭게 해석하는 발상, 아이디어가 한눈에 읽히는 전달력, 사물 묘사력",
  발상과표현: "주제에 대한 독창적 해석, 표현 방식의 다양성, 화면 장악력",
  기초조형: "점·선·면·입체 등 조형 요소의 질서와 변화, 구성의 균형, 재료 표현",
  소묘: "비례·형태의 정확성, 명암 단계(5단계 이상)와 양감, 질감 표현, 공간감, 화면 마감",
  수채화: "색의 투명도와 번짐 조절, 명도 대비, 형태 묘사, 물 조절에 따른 마감",
  인체: "인체 비례·동세, 골격과 근육 이해, 명암에 의한 양감, 손·발 등 세부 묘사",
  한국화: "필선의 강약과 운필, 먹의 농담, 여백 운용, 채색 조화",
  상황표현: "상황이 한 장면으로 읽히는 연출, 인물 동작·표정, 배경과 원근, 이야기 전달력",
  칸만화: "칸 나눔과 시선 흐름, 연출(컷 크기·앵글), 캐릭터 일관성, 기승전결",
  이미지보드: "세계관과 분위기 전달, 색채 설정, 장면 구성",
  캐릭터디자인: "캐릭터의 개성과 실루엣, 설정의 일관성, 표정·포즈 변화",
  애니메이션: "동세와 움직임의 흐름, 연속 동작의 이해, 연출",
  웹툰: "세로 스크롤 연출, 칸 흐름, 캐릭터 표현, 대사 배치",
  게임포스터: "게임 세계관이 드러나는 연출, 주인공 강조, 타이틀·화면 구성, 색채 분위기",
  컨셉아트: "세계관 설정, 원근과 공간 연출, 분위기 조명, 디자인 설득력",
  "상황표현(게임)": "게임 장면의 긴장감 연출, 캐릭터 동작, 공간·원근",
  조소: "비례와 양감, 덩어리감과 무게중심, 표면 처리, 사방에서 본 형태의 연결",
  공예: "형태와 기능의 조화, 재료 이해, 마감의 정교함",
  입체조형: "입체 구성의 질서와 변화, 공간감, 재료·구조 이해",
};

const TOOL = {
  name: "save_critique",
  description: "미술 입시 실기 작품 진단 결과를 저장합니다.",
  input_schema: {
    type: "object",
    properties: {
      scores: {
        type: "object",
        description: "각 항목 0~100 정수. 색이 없는 흑백 작품(소묘·연필 등)의 '색채'는 null.",
        properties: Object.fromEntries(AXES.map((a) => [a, { type: ["integer", "null"], minimum: 0, maximum: 100 }])),
        required: [...AXES],
      },
      strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3, description: "잘한 점, 작품 속 구체적 위치·요소를 짚어 한 문장씩" },
      improvements: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3, description: "보완할 점, 무엇을 어떻게 고칠지 한 문장씩" },
      comment: { type: "string", description: "입시미술 강사가 학생에게 하듯 3~5문장 종합 코멘트, 존댓말" },
      nextTask: { type: "string", description: "다음 일주일 연습 과제 1개, 구체적인 분량·시간 포함 한 문장" },
      notArtwork: { type: "boolean", description: "사진이 미술 작품이 아니거나 너무 흐려 평가할 수 없으면 true" },
    },
    required: ["scores", "strengths", "improvements", "comment", "nextTask"],
  },
};

function systemPrompt(field: string, solid: boolean, grade: string) {
  const guide = FIELD_GUIDE[field] || "구도·형태·명암·색채·완성도·발상 전반";
  return [
    "당신은 한국 미술대학 입시 실기를 20년 이상 지도한 입시미술 강사입니다. 월간 「미대입시」의 심사평 기준에 맞춰 학생 작품을 진단합니다.",
    `분야: ${field || "미지정"} / 학년: ${grade || "미지정"}`,
    `이 분야에서 중요하게 보는 점: ${guide}`,
    "점수 기준: 90 이상 = 상위권 대학 합격권 완성도, 80대 = 합격권 근접, 70대 = 기본기는 있으나 보완 필요, 60대 = 기초 단계, 60 미만 = 기초부터 다시. 학년을 고려하되 점수는 입시 기준으로 냉정하게 매기고, 말투는 따뜻하게 합니다.",
    "작품에 실제로 보이는 것만 근거로 말하고, 보이지 않는 것을 추측하지 않습니다. 학생 얼굴·이름 등 개인정보가 보여도 언급하지 않습니다.",
    solid ? "입체 작품입니다. 앞·뒤·좌·우 4장의 사진을 함께 보고 하나의 작품으로 평가하세요. 사진만으로 양감·무게감 판단에 한계가 있음을 코멘트에 짧게 밝혀 주세요." : "",
    "결과는 반드시 save_critique 도구로만 제출합니다.",
  ].filter(Boolean).join("\n");
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method", "POST만 허용합니다.", 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return fail("not_configured", "AI 진단이 아직 설정되지 않았어요.", 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") || "";
  // 학생 권한 클라이언트(RLS 적용) — 본인 작품 확인용
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  // 서버 권한 클라이언트 — 사진 읽기·결과 저장용 (본인 확인 뒤에만 사용)
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: userData } = await asUser.auth.getUser();
  const user = userData?.user;
  if (!user) return fail("auth", "로그인이 필요해요.", 401);

  let body: { artworkId?: string };
  try { body = await req.json(); } catch { return fail("input", "요청 형식이 올바르지 않아요."); }
  if (!body.artworkId) return fail("input", "작품 id가 없어요.");

  const { data: art } = await asUser.from("artworks").select("id, user_id, image_path, genre").eq("id", body.artworkId).maybeSingle();
  if (!art || art.user_id !== user.id) return fail("not_found", "작품을 찾을 수 없어요.", 404);

  // 하루 이용 횟수 제한 (비용 관리)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: myArts } = await admin.from("artworks").select("id").eq("user_id", user.id);
  const ids = (myArts || []).map((r) => r.id);
  if (ids.length) {
    const { count } = await admin.from("analyses").select("id", { count: "exact", head: true }).in("artwork_id", ids).gte("created_at", since).like("model", "claude%");
    if ((count || 0) >= DAILY_LIMIT) return fail("limit", `AI 진단은 하루 ${DAILY_LIMIT}회까지 받을 수 있어요. 내일 다시 시도해 주세요.`, 429);
  }

  const { data: prof } = await admin.from("profiles").select("grade").eq("user_id", user.id).maybeSingle();
  const solid = String(art.image_path).endsWith("-front.jpg");
  const paths = solid ? VIEWS.map(([k]) => String(art.image_path).replace(/-front\.jpg$/, `-${k}.jpg`)) : [String(art.image_path)];

  const images: unknown[] = [];
  for (let i = 0; i < paths.length; i++) {
    const { data: file, error } = await admin.storage.from("artworks").download(paths[i]);
    if (error || !file) return fail("image", "작품 사진을 불러오지 못했어요.", 500);
    if (solid) images.push({ type: "text", text: `${VIEWS[i][1]}면` });
    images.push({ type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: toBase64(await file.arrayBuffer()) } });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt(art.genre || "", solid, prof?.grade || ""),
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: [...images, { type: "text", text: "이 작품을 진단해 주세요." }] }],
    }),
  });
  if (!res.ok) {
    console.error("anthropic", res.status, await res.text());
    return fail("ai", "AI 진단 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.", 502);
  }
  const out = await res.json();
  const use = (out.content || []).find((c: { type: string }) => c.type === "tool_use");
  const r = use?.input;
  if (!r) return fail("ai", "진단 결과를 만들지 못했어요. 다시 시도해 주세요.", 502);
  if (r.notArtwork) return fail("not_artwork", "작품이 잘 보이지 않아요. 작품 전체가 보이도록 정면에서 밝게 다시 찍어 주세요.", 422);

  const scores: Record<string, number | null> = {};
  for (const a of AXES) { const v = r.scores?.[a]; scores[a] = typeof v === "number" ? Math.max(0, Math.min(100, Math.round(v))) : null; }
  const row = {
    artwork_id: art.id, model: MODEL, scores,
    strengths: (r.strengths || []).slice(0, 3).map(String), improvements: (r.improvements || []).slice(0, 3).map(String),
    comment: String(r.comment || ""), next_task: String(r.nextTask || ""),
  };
  const { error: insErr } = await admin.from("analyses").insert(row);
  if (insErr) return fail("save", "진단 결과를 저장하지 못했어요.", 500);

  return json({ analysis: { scores, strengths: row.strengths, improvements: row.improvements, comment: row.comment, nextTask: row.next_task, model: MODEL } });
});
