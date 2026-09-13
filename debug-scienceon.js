async function get(url){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9'}});return await r.text()}
function compact(s=''){return String(s).replace(/\s+/g,' ').slice(0,5000)}
(async()=>{const html=await get('https://scienceon.kisti.re.kr/srch/selectPORSrchPatent.do?cn=KOR1020200175557');
for(const key of ['function searchTag','searchTag =','searchTag(', 'searchCondition', 'totSearchKeyword2']){const i=html.indexOf(key);if(i>=0)console.log('[SO-CODE]',key,compact(html.slice(Math.max(0,i-1800),i+4500)))}
for(const m of html.matchAll(/<form\b[^>]*>/gi)){if(/action|search|srch/i.test(m[0]))console.log('[SO-FORM]',m[0])}
for(const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)){if(/srch|search|common|patent/i.test(m[1]))console.log('[SO-SCRIPT]',m[1])}
})().catch(e=>console.error('[SO-ERR]',e.stack||e));