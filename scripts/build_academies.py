"""전국 입시 미술학원 현황(엑셀) → src/lib/academies.json

사용: python3 scripts/build_academies.py <학원현황.xlsx>
- 원본 엑셀은 공모전 접수 명단에서 나온 자료라 저장소에 올리지 않는다.
- 개인정보 보호: 휴대전화(010·011·016·017·018·019) 번호는 공개 데이터에서 뺀다 (원장·담당자 개인번호일 수 있음).
- 시험·빈 행, 학원명이 없는 행, 학원명과 주소가 같은 중복 행을 정리한다.
"""
import json, re, sys
import openpyxl

SRC = sys.argv[1]
OUT = "src/lib/academies.json"
JUNK = re.compile(r"test|테스트|^[-\s]*$", re.I)
# 학원명이 아니라 개인 이름으로 보이는 행 (예: '○○동 김선생')
PERSON = re.compile(r"(선생|쌤|샘)$")

AREA = {"서울": "02", "경기": "031", "인천": "032", "강원": "033", "충남": "041", "대전": "042", "충북": "043", "세종": "044",
        "부산": "051", "울산": "052", "대구": "053", "경북": "054", "경남": "055", "전남": "061", "광주": "062", "전북": "063", "제주": "064"}

def tel(v, sido):
    raw = str(v or "").strip()
    d = re.sub(r"\D", "", re.split(r"[,~.]", raw)[0] if re.search(r"\d{4}[,~.]\d", raw) else raw)
    if not d: return None, False
    if re.match(r"^01[016789]", d): return None, True           # 휴대전화 → 비공개
    if re.match(r"^1[56]\d{6}$", d): return f"{d[:4]}-{d[4:]}", False   # 대표번호 1588-0000
    if not d.startswith("0"):
        if len(d) in (9, 10) and d[:2] in {a[1:] for a in AREA.values()}: d = "0" + d   # 앞자리 0 빠짐
        elif len(d) == 9 and d[0] == "2": d = "0" + d
        elif len(d) in (7, 8): d = AREA.get(sido, "") + d                               # 지역번호 빠짐
    if d.startswith("050") and len(d) in (11, 12): return f"{d[:4]}-{d[4:-4]}-{d[-4:]}", False   # 안심번호 0507
    if d.startswith("070") and len(d) == 11: return f"070-{d[3:7]}-{d[7:]}", False
    if d.startswith("02") and len(d) in (9, 10): return f"02-{d[2:-4]}-{d[-4:]}", False
    if re.match(r"^0[3-6]\d", d) and len(d) in (10, 11): return f"{d[:3]}-{d[3:-4]}-{d[-4:]}", False
    return None, False                                                                  # 확인 불가 번호

def tags(name):
    t = []
    if re.search(r"만화|애니|웹툰|툰|코믹|캐릭터", name): t.append("만화·애니")
    if re.search(r"게임", name): t.append("게임")
    if re.search(r"한국화|동양화", name): t.append("한국화")
    if re.search(r"디자인", name): t.append("디자인")
    if re.search(r"조소|조형|공예", name): t.append("조소·조형")
    return t

ws = openpyxl.load_workbook(SRC, data_only=True).active
rows, seen, stat = [], set(), {"원본": 0, "제외_시험·빈행": 0, "제외_개인이름": 0, "제외_중복": 0, "휴대전화_비공개": 0, "전화없음": 0}
for r in ws.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    stat["원본"] += 1
    sido, gugun, name, addr, zipc, phone = (list(r) + [None] * 6)[:6]
    name = re.sub(r"\s+", " ", str(name or "")).strip(); addr = re.sub(r"\s+", " ", str(addr or "")).strip()
    if not name or JUNK.search(name) or not addr: stat["제외_시험·빈행"] += 1; continue
    if PERSON.search(name): stat["제외_개인이름"] += 1; continue
    key = (name.replace(" ", ""), addr.replace(" ", ""))
    if key in seen: stat["제외_중복"] += 1; continue
    seen.add(key)
    t, hidden = tel(phone, str(sido).strip())
    if hidden: stat["휴대전화_비공개"] += 1
    elif not t: stat["전화없음"] += 1
    rows.append({"sido": str(sido).strip(), "gugun": str(gugun or "").strip(), "name": name, "addr": addr,
                 "zip": str(zipc).zfill(5) if re.fullmatch(r"\d{4,5}", str(zipc or "")) else "", "tel": t, "tags": tags(name)})

rows.sort(key=lambda x: (x["sido"], x["gugun"], x["name"]))
for i, x in enumerate(rows): x["id"] = f"K{i + 1:04d}"
json.dump([{k: x[k] for k in ("id", "sido", "gugun", "name", "addr", "zip", "tel", "tags")} for x in rows],
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
stat["공개"] = len(rows)
print(json.dumps(stat, ensure_ascii=False))
