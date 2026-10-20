// 공통 코드 — 대학·전형 데이터는 programs.json (2027 모집 · 2026 입결, 조사 2026-10-12) / 추후 Supabase admissions·results 테이블
export const MAJORS = ["시각디자인", "산업디자인", "공예", "패션디자인", "실내·공간디자인", "영상·미디어", "애니메이션", "만화·웹툰", "회화", "조소", "미술교육", "기타"] as const;
// 작품 분야 — 계열별로 묶어 선택창에 표시. 값은 그대로 작품의 '분야'로 저장(이전 버전의 '장르' 값도 그대로 호환).
// 게임 계열 상황표현은 만화·애니 상황표현과 구분되도록 값에 (게임)을 붙임.
// solid: true 계열은 입체 작품이라 앞·뒤·좌·우 4면 사진을 한 작품으로 올림.
export const FIELD_GROUPS: { group: string; fields: string[]; solid?: boolean }[] = [
  { group: "디자인 계열", fields: ["기초디자인", "사고의전환", "발상과표현", "기초조형"] },
  { group: "회화·드로잉 계열", fields: ["소묘", "수채화", "인체", "한국화"] },
  { group: "만화·애니메이션 계열", fields: ["상황표현", "칸만화", "이미지보드", "캐릭터디자인", "애니메이션", "웹툰"] },
  { group: "게임 계열", fields: ["게임포스터", "컨셉아트", "상황표현(게임)"] },
  { group: "조형·공예 계열", fields: ["조소", "공예", "입체조형"], solid: true },
];
export const FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
export const isSolidField = (f: string) => FIELD_GROUPS.some((g) => g.solid && g.fields.includes(f));
export const fieldGroup = (f: string) => FIELD_GROUPS.find((g) => g.fields.includes(f))?.group ?? "";
export const SOLID_VIEWS = [["front", "앞"], ["back", "뒤"], ["left", "좌"], ["right", "우"]] as const;
export const AXES = ["구도", "형태", "명암", "색채", "완성도", "발상"] as const;
export const REGIONS = ["서울", "경기", "인천", "강원", "대전", "세종", "충북", "충남", "광주", "전북", "전남", "대구", "경북", "부산", "울산", "경남", "제주"];
export type Axis = (typeof AXES)[number];


export const DRILL: Record<Axis, string> = {
  구도: "썸네일 스케치 10개로 화면 배치 비교하기", 형태: "크로키 하루 20장, 비례 체크선 긋기", 명암: "구·원기둥 5단계 명암 소묘 2장",
  색채: "보색·유사색 조합 컬러칩 12개 만들기", 완성도: "4시간 타이머 완성 연습 1회, 마지막 30분 정리", 발상: "기출 주제 1개를 3가지 아이디어로 풀어보기",
};
// 입시 프로필의 '계열·분야' — 작품 분야와 같은 5계열 21분야 체계 (FIELD_GROUPS)
export const TRACKS = FIELD_GROUPS.map((g) => g.group);
export const fieldsOf = (track: string) => FIELD_GROUPS.find((g) => g.group === track)?.fields ?? FIELDS;
// 선호 지역 빠른 선택 묶음
export const REGION_GROUPS: [string, string[]][] = [
  ["수도권", ["서울", "경기", "인천"]], ["강원", ["강원"]], ["충청권", ["대전", "세종", "충북", "충남"]],
  ["호남권", ["광주", "전북", "전남"]], ["대구·경북", ["대구", "경북"]], ["부산·울산·경남", ["부산", "울산", "경남"]], ["제주", ["제주"]],
];
// 희망 전공 → 기본 계열·분야 (프로필에 계열을 처음 정할 때 제안값)
export const MAJOR_TRACK: Record<string, [string, string]> = {
  시각디자인: ["디자인 계열", "기초디자인"], 산업디자인: ["디자인 계열", "사고의전환"], "실내·공간디자인": ["디자인 계열", "기초디자인"], 패션디자인: ["디자인 계열", "발상과표현"],
  "영상·미디어": ["디자인 계열", "발상과표현"], 공예: ["조형·공예 계열", "공예"], 조소: ["조형·공예 계열", "조소"], 회화: ["회화·드로잉 계열", "소묘"],
  미술교육: ["회화·드로잉 계열", "소묘"], 애니메이션: ["만화·애니메이션 계열", "애니메이션"], "만화·웹툰": ["만화·애니메이션 계열", "웹툰"], 기타: ["디자인 계열", "기초디자인"],
};
