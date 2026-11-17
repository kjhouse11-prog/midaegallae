# -*- coding: utf-8 -*-
"""편집부 원문 검증용 확인 목록을 만듭니다 → data/편집부_확인목록.csv (엑셀에서 바로 열림, UTF-8 BOM)

우선순위
  1순위: 판정에 바로 영향을 주는 이상치 (50%·70%컷 역전, 논술 반영비율 미수집)
  2순위: 출처가 학원 추정치이거나 '확인 필요'로 표시된 모집단위
  3순위: 학원 정리본 출처 입결 (대학 발표 원문으로 교체 대상)
  4순위: 수상 입시특전 중 출처 미확인 항목
검증이 끝나면 data/extra_2027.json·data/tracks_raw 원자료를 고치고
  python3 scripts/merge_extra.py && python3 scripts/build_tracks.py 로 다시 만듭니다.
실행: python3 scripts/export_checks.py
"""
import csv, json, os, re

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "data", "편집부_확인목록.csv")

tracks = json.load(open(os.path.join(ROOT, "src/lib/tracks.json"), encoding="utf-8"))
programs = json.load(open(os.path.join(ROOT, "src/lib/programs.json"), encoding="utf-8"))["programs"]
rows = []

for key, u in tracks["univs"].items():
    for t in u["tracks"]:
        if t.get("chk"):
            rows.append([1, key, f"{t['round']} {t['name']}", t.get("rep") or ", ".join(d for d, _ in t["units"][:3]),
                         t["chk"], f"50%컷 {t['g50']} / 70%컷 {t['g70']}" if t.get("g50") else "", t["src"]])

P2 = {"학원 추정 성적대": "정시 백분위가 학원 추정치 → 대학 발표 입결로 교체", "확인 필요": "전형 정보 확인 필요",
      "경쟁률만 확인 · 반영비율 확인 필요": "반영비율 미확인"}
for p in programs:
    v = p.get("verify", "")
    name = p["univ"] + (f"({p['campus']})" if p.get("campus") else "")
    cur = " / ".join(x for x in [p.get("method") or "", f"70%컷 {p['gpa_cut70']}" if p.get("gpa_cut70") else "",
                                  f"백분위 {p['csat_pct']}" if p.get("csat_pct") else ""] if x)
    if v in P2:
        rows.append([2, name, p["track"], p["dept"], P2[v], cur, p.get("src", "")])
    elif v == "입결 공개(학원 정리)":
        rows.append([3, name, p["track"], p["dept"], "학원 정리본 입결 → 대학 입학처·대학어디가 원문 대조", cur, p.get("src", "")])

# 수상 입시특전 (benefits.ts) — '확인 필요' 항목
src = open(os.path.join(ROOT, "src/lib/benefits.ts"), encoding="utf-8").read()
for m in re.finditer(r'\{[^{}]*?univ:\s*"([^"]+)"[^{}]*?benefit:\s*"([^"]+)"[^{}]*?status:\s*"확인 필요"', src, re.S):
    rows.append([4, m.group(1), "수상 입시특전", "", "출처 미확인 특전 → 대학 공지 확인", m.group(2), ""])

rows.sort(key=lambda r: (r[0], r[1]))
with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["순위", "대학", "전형", "모집단위", "확인할 내용", "현재 값", "출처(원문 대조 시작점)", "확인 결과", "확인자", "확인일"])
    for r in rows: w.writerow(r + ["", "", ""])
cnt = {}
for r in rows: cnt[r[0]] = cnt.get(r[0], 0) + 1
print(f"→ {OUT}  총 {len(rows)}건", " · ".join(f"{k}순위 {v}건" for k, v in sorted(cnt.items())))
