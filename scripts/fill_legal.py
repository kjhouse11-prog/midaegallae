# -*- coding: utf-8 -*-
"""개인정보 처리방침·이용약관의 [ ] 항목을 data/legal.json 값으로 채웁니다.
  1) data/legal.json 에 법인명·보호책임자·고객센터 등 값을 입력
  2) python3 scripts/fill_legal.py          → 채울 수 있는 값을 반영하고 남은 [ ] 항목을 보여 줌
     python3 scripts/fill_legal.py --check  → 바꾸지 않고 남은 항목만 확인 (스토어 제출 전 점검)
모든 항목이 채워지면 각 파일의 '시행 전 초안' 안내 문단도 자동으로 지웁니다(법률 검토 후 실행).
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
FILES = ["public/privacy.html", "public/terms.html"]
vals = {k: v for k, v in json.load(open(os.path.join(ROOT, "data/legal.json"), encoding="utf-8")).items() if not k.startswith("_") and v}
check = "--check" in sys.argv
left_total = 0
for f in FILES:
    path = os.path.join(ROOT, f)
    s = open(path, encoding="utf-8").read()
    body = re.sub(r'<p class="draft">.*?</p>', "", s, flags=re.S)  # 안내 문단의 '[ ]' 설명은 제외
    if not check:
        for k, v in vals.items(): s = s.replace(k, v)
        body = re.sub(r'<p class="draft">.*?</p>', "", s, flags=re.S)
    # 앱 메뉴 이름([마이] 등)은 빈칸이 아님
    left = [m for m in re.findall(r"\[[^\]]*\]", body) if m not in ("[마이]", "[회원 탈퇴]", "[AI 진단 받기]")]
    left_total += len(left)
    if not check:
        if not left: s = re.sub(r'<p class="draft">.*?</p>\n?', "", s, flags=re.S)
        open(path, "w", encoding="utf-8").write(s)
    print(f"{f}: 남은 빈칸 {len(left)}개", ("· " + ", ".join(sorted(set(left)))) if left else "· 완료")
sys.exit(1 if check and left_total else 0)
