async function get(url){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7'}});return await r.text()}
function compact(s=''){return String(s).replace(/\s+/g,' ').slice(0,7000)}
(async()=>{const html=await get('https://scienceon.kisti.re.kr/srch/selectPORSrchPatent.do?cn=KOR1020200175557');
const patterns=[/viewTab\([^)]*\)/g,/selectRsrchmanContList\.do/g,/박상훈/g];
for(const re of patterns){let n=0;for(const m of html.matchAll(re)){if(n++>=20)break;console.log('[AUTHOR-MATCH]',re.source,compact(html.slice(Math.max(0,m.index-1800),m.index+3500)))}}
for(const m of html.matchAll(/onclick=["']([^"']*viewTab[^"']*)["']/gi))console.log('[AUTHOR-ONCLICK]',m[1]);
})().catch(e=>console.error('[AUTHOR-ERR]',e.stack||e));