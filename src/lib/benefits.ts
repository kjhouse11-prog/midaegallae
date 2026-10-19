// 실기대회 수상 시 '본교 입시특전' — 대학이 직접 여는 실기대회의 수상자 혜택(가산점·우선입학·장학금·등록금 등).
// status "확인": 대학·언론 공지로 내용을 확인한 항목 / "확인 필요": 알려진 사례지만 출처를 찾지 못해 편집부 확인이 필요한 항목.
// 혜택은 해마다 바뀌므로 화면에 '기준 연도'와 '당해 모집요강 확인' 안내를 함께 표시합니다.
export interface Benefit {
  univ: string; contest: string; benefit: string; basis: string;
  status: "확인" | "확인 필요"; source?: { name: string; url: string }; keys: string[];
}

export const BENEFITS: Benefit[] = [
  {
    univ: "청강문화산업대학교", contest: "청강 콘텐츠 실기대전 (만화·애니메이션·게임·융합 콘텐츠)",
    benefit: "부문별 대상: 수시 우선입학(무시험) 자격 · 그 밖 수상자: 수시모집 가산점",
    basis: "2019·2021 대회 안내 기준", status: "확인",
    source: { name: "청강문화산업대학교 공지(2019)", url: "https://www.ck.ac.kr/?p=150191" }, keys: ["청강"],
  },
  {
    univ: "건국대학교", contest: "건국대학교 미술·디자인 실기대회",
    benefit: "총장상 수상자 장학금 200만 원 (입학 시 등록금 혜택 여부는 편집부 확인 필요)",
    basis: "2013 대회 안내 기준", status: "확인",
    source: { name: "대학저널(2013.05)", url: "https://www.dhnews.co.kr/news/view/179512197408998" }, keys: ["건국", "건대"],
  },
  {
    univ: "상명대학교 (디자인)", contest: "상명대학교 디자인 실기대회",
    benefit: "수상자 입학 시 등록금 혜택이 있는 것으로 알려짐",
    basis: "출처 미확인", status: "확인 필요", keys: ["상명"],
  },
];

// 수상 이름에 대학 이름이 들어 있으면 해당 특전을 연결
export const benefitFor = (title: string) => BENEFITS.find((b) => b.keys.some((k) => title.includes(k)));
