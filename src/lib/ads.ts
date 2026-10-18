// 앱 하단 광고 목록 — 모든 화면 맨 아래에서 차례로(8초씩) 돌아가며 재생됩니다.
// 광고를 추가·교체하려면 src/assets/ad/ 에 영상(mp4·webm)과 첫 화면 이미지(jpg)를 넣고 아래에 한 줄 추가하세요.
// sample: true 는 베타용 가상 광고(실존 학원·대학 아님). 누르면 링크 대신 '샘플 광고' 안내가 뜹니다.
import mgoodMp4 from "../assets/ad/mgood-ad.mp4";
import mgoodWebm from "../assets/ad/mgood-ad.webm";
import mgoodPoster from "../assets/ad/mgood-ad-poster.jpg";
import academyMp4 from "../assets/ad/ad-academy.mp4";
import academyWebm from "../assets/ad/ad-academy.webm";
import academyPoster from "../assets/ad/ad-academy-poster.jpg";
import univMp4 from "../assets/ad/ad-univ.mp4";
import univWebm from "../assets/ad/ad-univ.webm";
import univPoster from "../assets/ad/ad-univ-poster.jpg";
import contestMp4 from "../assets/ad/ad-contest.mp4";
import contestWebm from "../assets/ad/ad-contest.webm";
import contestPoster from "../assets/ad/ad-contest-poster.jpg";

export type AdKind = "잡지" | "미술학원" | "미술대학" | "실기대회";
export interface Ad { id: string; kind: AdKind; name: string; mp4: string; webm: string; poster: string; url?: string; sample?: boolean }

export const MGOOD_URL = "https://www.mgood.co.kr/main/index.php";
export const ADS: Ad[] = [
  { id: "mgood", kind: "잡지", name: "월간 미대입시", mp4: mgoodMp4, webm: mgoodWebm, poster: mgoodPoster, url: MGOOD_URL },
  { id: "academy", kind: "미술학원", name: "아틀리에 온 미술학원", mp4: academyMp4, webm: academyWebm, poster: academyPoster, sample: true },
  { id: "univ", kind: "미술대학", name: "한빛예술대학교 조형예술대학", mp4: univMp4, webm: univWebm, poster: univPoster, sample: true },
  { id: "contest", kind: "실기대회", name: "전국 고교생 미술실기대회", mp4: contestMp4, webm: contestWebm, poster: contestPoster, sample: true },
];
