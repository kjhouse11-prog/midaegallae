// 첨삭 지도 비용 예시 — 베타 '가상 가격'. 실제 결제·전문가 연결은 아직 없습니다 (신청 체험만 이 기기에 기록).
// 가격은 정식 서비스 기획용 예시이며, 「월간 미대입시」 심사위원·제휴 강사 풀과 협의해 확정합니다.
export interface Critique { id: string; name: string; who: string; how: string; turnaround: string; price: number; unit: string; tag?: string; detail: string[] }
export const CRITIQUES: Critique[] = [
  { id: "ai", name: "AI 작품 진단", who: "미대갈래 AI", how: "앱에서 바로", turnaround: "즉시", price: 0, unit: "무제한", tag: "무료",
    detail: ["구도·형태·명암·색채·완성도·발상 6개 항목 점수", "약점 항목과 다음 연습 과제 제안", "실기 지수에 자동 반영"] },
  { id: "photo", name: "사진 첨삭 (글 피드백)", who: "현직 입시미술 강사", how: "작품 사진 1점", turnaround: "48시간 안", price: 20000, unit: "1회",
    detail: ["항목별 강평 글 (500자 이상)", "잘한 점 2 · 보완할 점 3", "다음 연습 과제 1개"] },
  { id: "redpen", name: "사진 첨삭 + 수정 드로잉", who: "현직 입시미술 강사", how: "작품 사진 1점", turnaround: "72시간 안", price: 35000, unit: "1회", tag: "인기",
    detail: ["작품 위에 고칠 부분을 직접 그려 표시", "구도 대안 썸네일 2개", "글 강평 포함"] },
  { id: "pack4", name: "사진 첨삭 4회권", who: "같은 강사가 4회 연속", how: "작품 사진 4점", turnaround: "회당 48시간 안", price: 70000, unit: "4회 (회당 17,500원)", tag: "12% 할인",
    detail: ["같은 강사가 한 달 동안 성장 추이를 비교", "4회차에 변화 요약 리포트", "남은 횟수 6개월 안 사용"] },
  { id: "video", name: "화상 1:1 첨삭", who: "현직 입시미술 강사", how: "화상 통화 30분", turnaround: "예약제", price: 50000, unit: "30분",
    detail: ["작품 2~3점을 보며 실시간 강평", "질문·답변, 대학별 준비 상담", "녹화본 제공"] },
  { id: "mock", name: "모의 실기 평가", who: "「미대입시」 실기대회 심사 기준", how: "시험 조건으로 그린 작품 1점", turnaround: "월 1회 일괄 채점", price: 30000, unit: "1회",
    detail: ["대학 실기고사와 같은 주제·시간으로 응시", "심사 기준표 점수와 참가자 중 위치(백분위)", "심사평 요약"] },
  { id: "prof", name: "포트폴리오 리뷰", who: "대학 교수·실기대회 심사위원", how: "작품 5~8점", turnaround: "시즌제 (연 2회)", price: 120000, unit: "1회", tag: "시즌 한정",
    detail: ["대학 심사 관점의 종합 강평", "목표 대학·학과 적합도 의견", "보완 우선순위 3가지"] },
];
export const won = (n: number) => (n === 0 ? "무료" : `${n.toLocaleString("ko-KR")}원`);
export interface CritiqueReq { id: string; svc: string; workId?: string; workLabel?: string; memo: string; at: string }
