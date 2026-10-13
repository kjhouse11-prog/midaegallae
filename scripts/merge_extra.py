# -*- coding: utf-8 -*-
"""추가 조사 데이터(data/extra_2027.json)를 앱 데이터(src/lib/programs.json)에 합칩니다.
- 기존 행(R###)은 그대로 두고, 추가 행은 X### 번호로 붙입니다 (다시 실행하면 X행만 새로 만듦).
- 같은 대학·캠퍼스·학과·전형이 이미 있으면 건너뜁니다.
실행: python3 scripts/merge_extra.py
"""
import json, os, re
ROOT = os.path.join(os.path.dirname(__file__), "..")
APP = os.path.join(ROOT, "src/lib/programs.json")
EXTRA = os.path.join(ROOT, "data/extra_2027.json")
MAJORS = {"시각디자인", "산업디자인", "공예", "패션디자인", "실내·공간디자인", "영상·미디어", "애니메이션", "회화", "조소", "미술교육", "디자인(통합)", "기타"}
TTYPES = {"수시실기다단계", "수시실기일괄", "수시학종", "정시실기", "정시비실기"}
REGIONS = {"서울", "경기", "인천", "강원", "대전", "세종", "충북", "충남", "광주", "전북", "전남", "대구", "경북", "부산", "울산", "경남", "제주"}

ALIAS = {"서울과기대": "서울과학기술대"}

def num(v):
    if v is None or v == "": return None
    try: return float(v)
    except (TypeError, ValueError):
        m = re.search(r"\d+(\.\d+)?", str(v)); return float(m.group()) if m else None

def key(r): return (r["univ"], r.get("campus") or "", re.sub(r"\s", "", r["dept"]), r["round"], r.get("gun") or "", re.sub(r"\s", "", r.get("track") or ""), re.sub(r"\s", "", r.get("exam") or ""))

def main():
    app = json.load(open(APP, encoding="utf-8"))
    base = [p for p in app["programs"] if not p["id"].startswith("X")]
    srcs = {k: v for k, v in app["sources"].items() if not k.startswith("W")}
    seen = {key(p) for p in base}
    url2key, out, skipped = {}, [], []
    for r in json.load(open(EXTRA, encoding="utf-8")):
        r["univ"] = ALIAS.get(r["univ"].strip(), r["univ"].strip())
        if r.get("major") not in MAJORS: r["major"] = "기타"
        if r.get("ttype") not in TTYPES or r.get("region") not in REGIONS or r.get("round") not in ("수시", "정시"):
            skipped.append((r.get("univ"), r.get("dept"), "형식")); continue
        k = key(r)
        if k in seen: skipped.append((r["univ"], r["dept"], "중복")); continue
        seen.add(k)
        u = r.get("src_url") or ""
        if u not in url2key: url2key[u] = "W%03d" % (len(url2key) + 1); srcs[url2key[u]] = u
        g = {f: num(r.get(f)) for f in ("gpa_best", "gpa_avg", "gpa_cut70", "gpa_min")}
        for f, v in list(g.items()):
            if v is not None and not (1 <= v <= 9): g[f] = None  # 등급 범위 밖(환산점수 등)은 버림
        ref = g["gpa_cut70"] if g["gpa_cut70"] else (round(g["gpa_avg"] + 0.3, 2) if g["gpa_avg"] else None)
        w = [int(num(r.get(x)) or 0) for x in ("wP", "wG", "wC", "wO")]
        verify = r.get("verify") or "확인 필요"
        if r["round"] == "수시" and ref is None and verify.startswith("입결 공개"): verify = "입결 미공개"
        csat = num(r.get("csat_pct"))
        if r["round"] == "정시" and csat is None and verify.startswith("학원"): verify = "확인 필요"
        out.append(dict(
            id="X%03d" % (len(out) + 1), univ=r["univ"].strip(), campus=(r.get("campus") or "").strip(), region=r["region"], kind="4년제",
            dept=r["dept"].strip(), major=r["major"], round=r["round"], gun=(r.get("gun") or "").replace("군", ""), track=r.get("track") or "",
            ttype=r["ttype"], quota=int(num(r.get("quota"))) if num(r.get("quota")) else None, method=r.get("method") or "",
            wP=w[0], wG=w[1], wC=w[2], wO=w[3], stage1=r.get("stage1") or "", exam=r.get("exam") or "", paper=r.get("paper") or "",
            gpa_subjects=r.get("gpa_subjects") or "", csat_min=r.get("csat_min") or "", comp=num(r.get("comp")),
            gpa_best=g["gpa_best"], gpa_avg=g["gpa_avg"], gpa_cut70=g["gpa_cut70"], gpa_min=g["gpa_min"], gpa_basis=r.get("gpa_basis") or "",
            gpa_ref=ref, gpa_ref_est=bool(ref and not g["gpa_cut70"]),
            csat_pct=csat, csat_pm=num(r.get("csat_pm")) if csat is not None else None, eng=int(num(r.get("eng"))) if num(r.get("eng")) else None,
            csat_areas=r.get("csat_areas") or "", src=url2key[u], verify=verify, note=r.get("note") or ""))
    app["programs"] = base + out
    app["sources"] = srcs
    app["asof"] = "2026-10-13"
    json.dump(app, open(APP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    unis = {p["univ"] + p["campus"] for p in app["programs"]}
    print(f"기존 {len(base)} + 추가 {len(out)} = {len(app['programs'])}행, 대학 {len(unis)}곳, 건너뜀 {len(skipped)}")
    for s in skipped[:40]: print("  skip", s)

if __name__ == "__main__": main()
