# -*- coding: utf-8 -*-
"""대학별 개설 전형·반영비율·수시/정시 모집인원 데이터(src/lib/tracks.json)를 만듭니다.
입력: data/tracks_raw/ (그린알다 2027 미대 수시·정시 대학별 페이지·전형 상세에서 수집)
  susi.jsonl   {"u", "d": {"rows": [[전형명, 전형유형, 모집단위, 인원, r]]}}
  jungsi.jsonl {"u", "rows": [[전형명, 전형유형, 모집단위, 인원|"이월"]], "carry"}
  need.json    [[u, 전형명, 분류, 대표 모집단위, r]]  — 상세를 받은 대표 모집단위
  detail.jsonl {"r", "ratio", "csat", "comp", "g50", "g70", "etc"}
  detail2.jsonl 앱에 학과 카드가 없는 실기·정시 전형의 상세 {"r", "ratio", "wr"(판정용 최종 단계), "csat", "exam", "comp"}
  jcodes.jsonl 정시 대학별 페이지의 [전형명, 모집단위, r]
출력:
  univs    대학(캠퍼스)별 수시·정시 정원내 모집인원, 개설 전형 목록(반영비율·수능최저·경쟁률·등급컷)
  programs 교과·종합·포트폴리오 전형의 모집단위별 판정용 행(T###) — 앱의 programs.json에 없는 것만
실행: python3 scripts/build_tracks.py
"""
import json, os, re, collections

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data/tracks_raw")
APP = os.path.join(ROOT, "src/lib/programs.json")
OUT = os.path.join(ROOT, "src/lib/tracks.json")

ART = re.compile(r"디자인|미술|회화|조소|조형|공예|만화|웹툰|애니|영상|미디어|패션|의상|의류|섬유|텍스타일|도자|도예|금속|판화|서양화|동양화|한국화|입체|사진|일러스트|게임|실내|공간|인테리어|가구|주얼리|Art|아트|큐레이터|이론|수묵|수채|기초|무대|조각|예술|Fine|콘텐츠")
NOT = re.compile(r"뷰티|미용|메이크업|경영|자유전공|자율전공|상상력|인공지능|소프트웨어|광고홍보|대학전체|인문콘텐츠|문화콘텐츠학과|커뮤니케이션콘텐츠|K컬처|문화산업대학|무대기술|영화영상|미디어커뮤니케이션|건축")
# 지원 자격이 제한된 특별전형(정원외·기회균형 등)은 일반 학생 판정에서 뺌
SPEC = re.compile(r"농어촌|기회균형|고른기회|사회통합|사회배려|사회기여|사회적배려|저소득|기초생활|수급|특성화|장애|특수교육|성인|재직|보훈|가톨릭지도자|재림교회|목회자|나눔인재|기회균등")
SPORT = re.compile(r"특기자")  # 미술·디자인 특기자는 실적 전형이라 남김

# 그린알다 대학 표기 → 앱의 (대학, 캠퍼스)
UMAP = {
    "강원대_강릉": ("강원대", "강릉"), "강원대_삼척": ("강원대", "삼척"), "강원대_춘천": ("강원대", "춘천"),
    "건국대": ("건국대", "서울"), "건국대_글로컬": ("건국대", "글로컬(충주)"), "경기대_수원": ("경기대", "수원"),
    "경희대": ("경희대", "서울"), "경희대_국제": ("경희대", "국제(수원)"), "단국대_죽전": ("단국대", "죽전"), "단국대_천안": ("단국대", "천안"),
    "동양대_동두천": ("동양대", "동두천"), "명지대": ("명지대", "서울"), "명지대_용인": ("명지대", "용인"),
    "상명대": ("상명대", "서울"), "상명대_천안": ("상명대", "천안"), "연세대_미래": ("연세대", "미래(원주)"), "영산대": ("영산대", "해운대"),
    "예원예술대_드림": ("예원예술대", "양주"), "예원예술대_희망": ("예원예술대", "임실"), "중부대_고양": ("중부대", "고양"),
    "중앙대_다빈치": ("중앙대", "다빈치(안성)"), "추계예술대": ("추계예대", ""), "한양대": ("한양대", "서울"), "한양대_에리카": ("한양대", "ERICA"),
    "홍익대": ("홍익대", "서울"), "홍익대_세종": ("홍익대", "세종"),
}
EXTRA_REGION = {("예원예술대", "임실"): "전북"}
GRIN = "https://grinalda.net/univ-info-susi/midaesusi-univ/?u={}&y=2027"
GRIN_J = "https://grinalda.net/univ-info-jungsi/midaejungsi-univ/?u={}&y=2027"
GRIN_JD = "https://grinalda.net/univ-info-jungsi/midaejungsi-detail/?r={}"
GRIN_D = "https://grinalda.net/univ-info-susi/midaesusi-detail/?r={}"


def univ_of(u, dept=""):
    if u == "경북대" and "섬유패션" in dept: return ("경북대", "상주")
    return UMAP.get(u, (u, ""))


def full(univ, campus): return f"{univ}({campus})" if campus else univ


def is_art(dept): return bool(ART.search(dept)) and not NOT.search(dept)


def special(name): return name.startswith("외_") or bool(SPEC.search(name))


def major_of(d):
    rules = [("미술교육", r"미술교육|응용미술교육"), ("만화·웹툰", r"만화|웹툰"), ("애니메이션", r"애니"), ("패션디자인", r"패션|의상|의류"),
             ("공예", r"공예|도자|도예|금속|섬유미술|목조형|유리|주얼리|텍스타일"), ("실내·공간디자인", r"실내|공간|인테리어|환경디자인|가구|리빙"),
             ("시각디자인", r"시각|커뮤니케이션디자인|그래픽"), ("산업디자인", r"산업|제품|공업|디자인공학|모빌리티|자동차"),
             ("영상·미디어", r"영상|미디어|사진|게임"), ("조소", r"조소|조각|입체"), ("기타", r"예술학|큐레이터|이론"),
             ("회화", r"회화|서양화|동양화|한국화|미술학|판화|조형예술|수묵|순수미술|현대미술|Fine"), ("디자인(통합)", r"디자인")]
    for m, rx in rules:
        if re.search(rx, d): return m
    return "기타"


def norm(s): return re.sub(r"[\s_.·()&・-]", "", s)


GENERIC = re.compile(r"디자인|학과|학부|전공|계열|미술대학|예체능계|인문계|과$")


def core(s): return GENERIC.sub("", norm(s))


def same_unit(a, b):
    """모집단위 이름 비교 — '디자인전공(시각)' ↔ '시각디자인전공'처럼 표기가 달라도 핵심어로 맞춤"""
    if norm(a) == norm(b): return True
    ca, cb = core(a), core(b)
    return bool(ca and cb) and (ca in cb or cb in ca)


def num(v):
    if v in (None, "", "null"): return None
    try: return float(v)
    except (TypeError, ValueError): return None


# ---------- 반영비율 파싱 → {교과, 서류, 실기, 면접, 수능} 합 100 ----------
TOK = re.compile(r"(1단계성적|1단계|학생부종합평가|서류종합평가|서류평가|학생부교과|학생부|교과|서류|면접|실기|수능)(\d+)")


def toks(s, cat):
    w = collections.Counter()
    for k, v in TOK.findall(s):
        v = int(v)
        if k.startswith("1단계"): w["1단계"] += v
        elif k in ("학생부교과", "교과"): w["교과"] += v
        elif k == "학생부": w["서류" if cat == "종합" else "교과"] += v
        elif k in ("학생부종합평가", "서류종합평가", "서류평가", "서류"): w["서류"] += v
        else: w[k] += v
    return w


def parse_ratio(ratio, cat):
    s = re.sub(r"\([^)]*\)", "", ratio.replace(" ", ""))
    stage1 = ""
    if "2단계" in s:
        a, b = s.split("2단계", 1)
        stage1 = a.replace("1단계", "", 1).strip(":→ ").strip()
        w1, w2 = toks(a.replace("1단계", "", 1), cat), toks(b, cat)
        k = w2.pop("1단계", 0)
        t1 = sum(w1.values()) or 1
        w = collections.Counter({x: v * k / t1 for x, v in w1.items()}) + w2 if k else w2
    else:
        w = toks(s, cat)
    tot = sum(w.values())
    if not tot: return None, stage1
    out = {k: round(w.get(k, 0) * 100 / tot) for k in ("교과", "서류", "실기", "면접", "수능")}
    return out, stage1


def pretty_ratio(ratio):
    return re.sub(r"\s+", " ", ratio.replace("/", "+").replace(":", " ")).strip()


CSAT = re.compile(r"(\d)\s*개\s*영역(?:의)?\s*(?:등급\s*)?(?:의\s*)?합\s*(?:이\s*)?(\d+)")


def norm_csat(c):
    if not c or c.strip() in ("없음", "-"): return ""
    m = CSAT.search(c.replace("합산등급", "등급 합").replace("등급의 합", "등급 합").replace("등급 합이", "등급 합"))
    return f"{m.group(1)}개 영역 등급합 {m.group(2)}" if m else c.strip()


def main():
    app = json.load(open(APP, encoding="utf-8"))["programs"]
    region = {}
    for p in app: region.setdefault((p["univ"], p["campus"]), p["region"])
    region.update(EXTRA_REGION)
    app_by = collections.defaultdict(list)
    for p in app: app_by[(p["univ"], p["campus"])].append(p)

    detail = {d["r"]: d for d in map(json.loads, open(os.path.join(RAW, "detail.jsonl"), encoding="utf-8"))}
    # 같은 대학에 이름이 같은 교과·종합 전형이 있을 수 있어 (대학, 전형명, 교과|종합|포트폴리오)로 찾음
    need = {(n[0], n[1], n[2].split("+")[0]): n for n in json.load(open(os.path.join(RAW, "need.json"), encoding="utf-8"))}
    susi = {}
    for o in map(json.loads, open(os.path.join(RAW, "susi.jsonl"), encoding="utf-8")):
        if o["d"].get("rows"): susi[o["u"]] = o["d"]["rows"]
    jungsi = {}
    for o in map(json.loads, open(os.path.join(RAW, "jungsi.jsonl"), encoding="utf-8")):
        jungsi[o["u"]] = o
    detail2 = {d["r"]: d for d in map(json.loads, open(os.path.join(RAW, "detail2.jsonl"), encoding="utf-8"))}
    jcodes = collections.defaultdict(list)
    for o in map(json.loads, open(os.path.join(RAW, "jcodes.jsonl"), encoding="utf-8")):
        for nm, d, r in o["rows"]: jcodes[(o["u"], nm)].append((norm(d), r))
    jused = collections.Counter()

    def fill(t, d, cat, src):
        """상세 페이지 자료로 반영비율·수능최저·경쟁률 채우기"""
        t["ratio"] = pretty_ratio(d["ratio"]); t["w"], t["stage1"] = parse_ratio(d.get("wr") or d["ratio"], cat)
        if d.get("wr"): t["stage1"] = re.sub(r"^1단계\([^)]*\):?", "", d["ratio"].split("2단계")[0]).strip()
        t["csat"] = norm_csat(d.get("csat") or ""); t["comp"] = num(d.get("comp")) or None
        t["etc"] = d.get("etc") or (f"실기: {d['exam']}" if d.get("exam") else ""); t["src"] = src
        if t["cat"] == "실기" and "포트폴리오" in (d.get("exam") or ""): t["cat"] = "포트폴리오"

    def match_app(univ, campus, rnd, units, kinds):
        """그린알다 모집단위 ↔ 앱 모집단위(같은 대학·전형 종류) 연결"""
        ids = []
        for p in app_by[(univ, campus)]:
            if p["round"] != rnd or p["ttype"] not in kinds: continue
            if any(same_unit(p["dept"], d) for d, _ in units): ids.append(p["id"])
        return ids

    univs, programs, flags = {}, [], []
    tid = 0

    def extra_rows(t, U, univ, campus):
        """앱에 학과 카드가 없는 실기·정시 전형 → 모집단위별 판정용 행 (입결 없음, 경쟁률·반영비율로 난이도 추정)"""
        nonlocal tid
        if t["ids"] or not t["w"]: return
        w = t["w"]; jung = t["round"] == "정시"
        exam = t["etc"][4:] if t["etc"].startswith("실기: ") else ""
        for dept, q in t["units"]:
            if jung and not q: continue  # 수시 이월 인원은 정시 모집 규모를 알 수 없어 판정에서 뺌
            tid += 1
            ttype = ("정시실기" if w["실기"] else "정시비실기") if jung else "수시포트폴리오" if t["cat"] == "포트폴리오" else ("수시실기다단계" if t["stage1"] else "수시실기일괄")
            programs.append(dict(
                id="T%03d" % tid, univ=univ, campus=campus, region=U["region"], kind="4년제", dept=dept, major=major_of(dept), round=t["round"], gun="",
                track=f"{t['round']} {'실기' if w['실기'] else '수능'} ({t['name']})", ttype=ttype, quota=q or None, method=t["ratio"],
                wP=w["실기"], wG=w["교과"] + w["서류"], wC=w["수능"], wO=w["면접"], stage1=t["stage1"], exam=exam, paper="",
                gpa_subjects="학생부 교과(모집요강 확인)" if w["교과"] + w["서류"] else "반영 안 함", csat_min=t["csat"], comp=t["comp"],
                gpa_best=None, gpa_avg=None, gpa_cut70=None, gpa_min=None, gpa_basis="", gpa_ref=None, gpa_ref_est=True,
                csat_pct=None, csat_pm=None, eng=None, csat_areas="수능 반영 영역은 모집요강 확인" if w["수능"] else "", src="G1",
                verify="입결 미공개" if not jung else "확인 필요", note=t.get("limit", ""), cat="정시" if jung else t["cat"], itv=w["면접"] > 0))
            t["ids"].append("T%03d" % tid)

    for u in sorted(set(susi) | set(jungsi)):
        # ---------- 수시 ----------
        groups = collections.OrderedDict()
        for name, kind, dept, q, r in susi.get(u, []):
            if not is_art(dept) or special(name): continue
            if SPORT.search(name) and not re.search(r"미술|디자인", name): continue
            univ, campus = univ_of(u, dept)
            groups.setdefault((univ, campus, name, kind), []).append((dept, int(q) if str(q).isdigit() else 0, r))
        for (univ, campus, name, kind), rows in groups.items():
            key = full(univ, campus)
            U = univs.setdefault(key, {"univ": univ, "campus": campus, "region": region.get((univ, campus), ""), "g": u, "susi": 0, "jungsi": 0, "carry": False, "tracks": []})
            units = [[d, q] for d, q, _ in rows]
            quota = sum(q for _, q in units)
            U["susi"] += quota
            cat = {"학생부교과": "교과", "학생부종합": "종합", "논술위주": "논술"}.get(kind, "실기")
            if cat == "실기" and "포트폴리오" in name: cat = "포트폴리오"
            n = need.get((u, name, cat))
            d = detail.get(n[4]) if n else None
            t = {"round": "수시", "name": name, "cat": cat, "itv": False, "quota": quota, "units": units, "ratio": "", "w": None, "stage1": "",
                 "csat": "", "comp": None, "g50": None, "g70": None, "rep": n[3] if n else "", "etc": "", "src": GRIN.format(u), "ids": []}
            if re.search(r"지역인재|지역교과|지역혁신|지역\b|^지역$", name): t["limit"] = "지역인재: 해당 지역 고교 출신만 지원"
            elif re.search(r"지역균형|학교장추천|고교추천", name): t["limit"] = "학교장 추천 필요(고교별 인원 제한)"
            elif SPORT.search(name): t["limit"] = "수상 실적 등 자격 요건 확인"
            if d:
                t["ratio"] = pretty_ratio(d["ratio"]); t["w"], t["stage1"] = parse_ratio(d["ratio"], cat)
                t["csat"] = norm_csat(d["csat"]); t["comp"] = num(d["comp"]); t["g50"] = num(d["g50"]); t["g70"] = num(d["g70"]); t["etc"] = d.get("etc") or ""
                t["src"] = GRIN_D.format(n[4])
                if t["g50"] and t["g70"] and t["g70"] < t["g50"]:
                    flags.append((key, name, "70%컷이 50%컷보다 높음(자료 확인 필요)", t["g50"], t["g70"]))
            if t["w"] and t["w"]["면접"] > 0: t["itv"] = True
            if cat == "교과" and re.search(r"면접", name): t["itv"] = True
            if cat == "실기":
                t["ids"] = match_app(univ, campus, "수시", units, ("수시실기일괄", "수시실기다단계"))
                ms = collections.Counter(p["method"] for p in app if p["id"] in t["ids"])
                if ms:
                    p0 = next(p for p in app if p["id"] in t["ids"] and p["method"] == ms.most_common(1)[0][0])
                    t["ratio"] = p0["method"] + (" 외" if len(ms) > 1 else "")
                    tw = p0["wP"] + p0["wG"] + p0["wC"] + p0["wO"] or 1
                    t["w"] = {"교과": round(p0["wG"] * 100 / tw), "서류": 0, "실기": round(p0["wP"] * 100 / tw), "면접": round(p0["wO"] * 100 / tw), "수능": round(p0["wC"] * 100 / tw)}
                    if t["w"]["면접"] and "면접" not in p0["method"]: t["w"]["서류"], t["w"]["면접"] = t["w"]["면접"], 0
                    t["comp"] = t["comp"] or p0["comp"]
                    if p0["csat_min"]: t["csat"] = p0["csat_min"]
                if not t["w"] and rows[0][2] in detail2:
                    fill(t, detail2[rows[0][2]], cat, GRIN_D.format(rows[0][2]))
                extra_rows(t, U, univ, campus)
            elif cat == "종합":
                t["ids"] = match_app(univ, campus, "수시", units, ("수시학종",))
                if not t["w"] and rows[0][2] in detail2:
                    fill(t, detail2[rows[0][2]], cat, GRIN_D.format(rows[0][2]))
            # 판정용 행: 교과·포트폴리오 전체, 종합은 앱에 같은 학과 학종 행이 없을 때만
            if cat in ("교과", "종합", "포트폴리오") and t["w"]:
                have = [p["dept"] for p in app if p["id"] in t["ids"]]
                for dept, q in units:
                    if cat == "종합" and any(same_unit(dept, h) for h in have): continue
                    tid += 1
                    rep = same_unit(dept, t["rep"]) if t["rep"] else False
                    g70, g50 = t["g70"], t["g50"]
                    if g50 and g70 and g70 < g50: g50, g70 = g70, g50
                    ref = g70 if g70 else (round(g50 + 0.2, 2) if g50 else None)
                    w = t["w"]
                    if cat == "포트폴리오": wP, wG, wO = w["실기"], w["교과"] + w["서류"], w["면접"]
                    else: wP, wG, wO = w["실기"], w["교과"] + w["서류"], w["면접"]
                    has = ref is not None
                    verify = ("입결 공개(대학 발표)" if rep else "추정: 같은 전형 대표 학과 입결") if has else "입결 미공개"
                    note = " · ".join(x for x in [t.get("limit", ""), t["etc"]] if x)
                    programs.append(dict(
                        id="T%03d" % tid, univ=univ, campus=campus, region=U["region"], kind="4년제", dept=dept, major=major_of(dept), round="수시", gun="",
                        track=f"수시 {'학생부교과' if cat == '교과' else '학생부종합' if cat == '종합' else '포트폴리오'} ({name})",
                        ttype={"교과": "수시교과", "종합": "수시학종", "포트폴리오": "수시포트폴리오"}[cat], quota=q or None, method=t["ratio"],
                        wP=wP, wG=wG, wC=0, wO=wO, stage1=t["stage1"], exam="포트폴리오" if cat == "포트폴리오" else "", paper="",
                        gpa_subjects="학생부 교과(반영 교과는 모집요강 확인)", csat_min=t["csat"], comp=t["comp"] if rep else None,
                        gpa_best=None, gpa_avg=g50 if rep else None, gpa_cut70=g70 if rep else None, gpa_min=None,
                        gpa_basis=("2026 등록자 50%컷(평균 칸)·70%컷" if rep else f"대표 학과({t['rep']}) 입결 준용") if has else "",
                        gpa_ref=ref, gpa_ref_est=not rep, csat_pct=None, csat_pm=None, eng=None, csat_areas="", src="G1", verify=verify, note=note,
                        cat=cat, itv=t["itv"]))
                    t["ids"].append("T%03d" % tid)
            U["tracks"].append(t)
        # ---------- 정시 ----------
        if u in jungsi:
            jg = collections.OrderedDict()
            o = jungsi[u]
            for name, kind, dept, q in o["rows"]:
                if not is_art(dept) or special(name): continue
                univ, campus = univ_of(u, dept)
                jg.setdefault((univ, campus, name, kind), []).append((dept, q))
            for (univ, campus, name, kind), rows in jg.items():
                key = full(univ, campus)
                U = univs.setdefault(key, {"univ": univ, "campus": campus, "region": region.get((univ, campus), ""), "g": u, "susi": 0, "jungsi": 0, "carry": False, "tracks": []})
                units = [[d, q if isinstance(q, int) else 0] for d, q in rows]
                carry = any(not isinstance(q, int) for _, q in rows)
                U["carry"] = U["carry"] or carry
                quota = sum(q for _, q in units)
                U["jungsi"] += quota
                t = {"round": "정시", "name": name, "cat": "정시", "kind": "실기" if kind.startswith("실기") else "교과" if kind == "학생부교과" else "수능", "itv": False, "quota": quota, "units": units,
                     "carry": carry, "ratio": "", "w": None, "stage1": "", "csat": "", "comp": None, "g50": None, "g70": None, "rep": "", "etc": "", "src": GRIN_J.format(u),
                     "ids": match_app(univ, campus, "정시", units, ("정시실기", "정시비실기"))}
                ms = collections.Counter(p["method"] for p in app if p["id"] in t["ids"])
                if ms:
                    p0 = next(p for p in app if p["id"] in t["ids"] and p["method"] == ms.most_common(1)[0][0])
                    t["ratio"] = p0["method"] + (" 외" if len(ms) > 1 else "")
                    tw = p0["wP"] + p0["wG"] + p0["wC"] + p0["wO"] or 1
                    t["w"] = {"교과": round(p0["wG"] * 100 / tw), "서류": 0, "실기": round(p0["wP"] * 100 / tw), "면접": round(p0["wO"] * 100 / tw), "수능": round(p0["wC"] * 100 / tw)}
                    if t["w"]["면접"] and "면접" not in p0["method"]: t["w"]["서류"], t["w"]["면접"] = t["w"]["면접"], 0
                    t["comp"] = p0["comp"]
                # 정시 상세 페이지 r — 같은 전형명·모집단위가 여러 번 나오면(전형유형별) 나온 순서대로 맞춤
                rs = []
                for dept, _ in units:
                    k = (u, name, norm(dept)); hits = [r for dd, r in jcodes.get((u, name), []) if dd == norm(dept)]
                    if len(hits) > jused[k]: rs.append(hits[jused[k]])
                    jused[k] += 1
                if not t["w"] and rs and rs[0] in detail2:
                    fill(t, detail2[rs[0]], "정시", GRIN_JD.format(rs[0]))
                if t["w"] and not t["ratio"].startswith("수능100") and t["kind"] == "수능" and t["w"]["실기"]: t["kind"] = "실기"
                if t["kind"] != "교과": extra_rows(t, U, univ, campus)
                U["tracks"].append(t)
    # 수시·정시 비중
    for U in univs.values():
        tot = U["susi"] + U["jungsi"]
        U["susiPct"] = round(U["susi"] * 100 / tot) if tot else None
        U["focus"] = "수시 위주" if tot and U["susi"] / tot >= 0.65 else "정시 위주" if tot and U["susi"] / tot <= 0.35 else "수시·정시 균형" if tot else "자료 없음"
    # 그린알다에 수시 자료가 없는 대학은 앱 학종 행으로 보충
    for key, U in univs.items():
        if U["susi"] == 0:
            hak = [p for p in app_by[(U["univ"], U["campus"])] if p["ttype"] == "수시학종"]
            if hak:
                m = hak[0]["method"].replace("→", " 2단계 ").replace("+", "/").replace("면접·구술", "면접")
                U["tracks"].insert(0, {"round": "수시", "name": "학생부종합", "cat": "종합", "itv": any("면접" in p["method"] for p in hak), "quota": sum(p["quota"] or 0 for p in hak),
                                       "units": [[p["dept"], p["quota"] or 0] for p in hak], "ratio": hak[0]["method"], "w": parse_ratio(m, "종합")[0], "stage1": hak[0]["stage1"], "csat": hak[0]["csat_min"],
                                       "comp": hak[0]["comp"], "g50": None, "g70": None, "rep": "", "etc": "앱 수록 학종 자료", "src": "", "ids": [p["id"] for p in hak]})
                U["susi"] = sum(p["quota"] or 0 for p in hak); tot = U["susi"] + U["jungsi"]
                U["susiPct"] = round(U["susi"] * 100 / tot) if tot else None
                U["focus"] = "수시 위주" if U["susi"] / tot >= 0.65 else "정시 위주" if U["susi"] / tot <= 0.35 else "수시·정시 균형"
    out = {"asof": "2026-10-23", "basis": "2027학년도 모집요강 기준 미대 모집인원·전형 (그린알다 정리, 정원내 · 특별전형 제외) · 등급컷은 2026 대학 발표",
           "sources": {"G1": "그린알다 2027 미대 수시·정시 대학별 전형 (grinalda.net · 각 대학 모집요강·대학어디가 정리)"},
           "univs": univs, "programs": programs}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    c = collections.Counter(t["cat"] for U in univs.values() for t in U["tracks"])
    print("대학", len(univs), "전형", sum(c.values()), dict(c), "판정 행", len(programs), collections.Counter(p["ttype"] for p in programs))
    print("수시 위주", sum(U["focus"] == "수시 위주" for U in univs.values()), "정시 위주", [k for k, U in univs.items() if U["focus"] == "정시 위주"])
    print("반영비율 없음:", [(k, t["name"], t["cat"]) for k, U in univs.items() for t in U["tracks"] if not t["w"]][:60])
    for f in flags: print("확인:", f)


if __name__ == "__main__":
    main()
