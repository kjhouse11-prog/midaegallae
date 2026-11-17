# -*- coding: utf-8 -*-
"""스토어 등록용 스크린샷 자동 촬영 (아이폰 6.9형 1290×2796 = 안드로이드 휴대전화 겸용)
준비: pip install playwright && playwright install chromium
실행: npm run build && npx vite preview --port 4173 &  → python3 scripts/store_screenshots.py
데모 모드(가상 학생 '김미대')로 찍으며, 상단 '데모 모드' 띠는 숨김. 결과: store/screenshots/
"""
import asyncio, os
from playwright.async_api import async_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..')
OUT=os.path.join(ROOT,'store/screenshots/')
SAMPLE=os.path.join(ROOT,'store/sample-drawing.jpg')
PROFILE={"name":"김미대","grade":"고2","gpa":2.4,"mock":82,"major":"시각디자인","regions":["서울","경기"],"academyStart":"2025-03","guardianConsent":False,"mockKnown":True,"school":"한빛고등학교","schoolType":"일반고","track":"디자인 계열","field":"기초디자인"}
CSS=".demo-bar,.install-bar{display:none!important}"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':430,'height':932},device_scale_factor=3)
    pg=await ctx.new_page(); pg.on('pageerror', lambda e: print('ERR',e))
    await pg.goto('http://localhost:4173/'); await pg.wait_for_timeout(800); await pg.add_style_tag(content=CSS)
    await pg.screenshot(path=OUT+'01_login.png')
    await pg.get_by_role('button',name='회원가입').first.click()
    await pg.fill('input[type=email]','demo@mgood.co.kr'); await pg.fill('input[type=password]','demo1234')
    await pg.locator('input[type=checkbox]').first.check()
    await pg.get_by_role('button',name='가입하기').click(); await pg.wait_for_timeout(800)
    await pg.evaluate('''(p)=>{const d=JSON.parse(localStorage.getItem("midae-navi-demo-v1"));d.profile=p;d.awards=[{id:"a1",title:"전국 고교생 미술실기대회 금상",level:"전국",awardedOn:"2026-08"}];localStorage.setItem("midae-navi-demo-v1",JSON.stringify(d));}''', PROFILE)
    await pg.reload(); await pg.wait_for_timeout(1000); await pg.add_style_tag(content=CSS)
    await pg.screenshot(path=OUT+'02_home.png')
    nav=pg.locator('nav').last
    # 작품
    await nav.get_by_text('작품').click(); await pg.wait_for_timeout(500)
    await pg.set_input_files('#file',SAMPLE); await pg.wait_for_timeout(2500)
    
    await pg.locator('.card-btn').first.click(); await pg.wait_for_timeout(500)
    await pg.get_by_role('button',name='AI 진단 받기').click(); await pg.wait_for_timeout(2500)
    await pg.locator('text=AI 실기 진단').evaluate("e=>{const c=e.closest('.card'); c.style.scrollMarginTop='170px'; c.scrollIntoView({block:'start'})}"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT+'04_work.png')
    # 대학찾기
    await nav.get_by_text('대학찾기').click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=OUT+'03_univ.png')
    for t,f in [('플래너','05_planner'),('학원','06_academy'),('멘토','07_mentor')]:
      await nav.get_by_text(t).click(); await pg.wait_for_timeout(1500)
      await pg.screenshot(path=OUT+f+'.png')
    await b.close()
asyncio.run(main())
