function strip(s=''){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()}
async function get(url,timeout=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}});return{status:r.status,text:await r.text(),type:r.headers.get('content-type'),url:r.url}}finally{clearTimeout(t)}}
function links(html){const out=[];for(const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const href=m[1],title=strip(m[2]);if(/^https?:\/\//i.test(href)&&title)out.push({title:title.slice(0,140),href:href.slice(0,500)})}return out.slice(0,30)}
(async()=>{
 const q='"세메스" "박상훈"';
 const urls=[
  ['NAVER',`https://search.naver.com/search.naver?where=web&query=${encodeURIComponent(q)}`],
  ['NAVER-TOTAL',`https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(q)}`],
  ['NAVER-M',`https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`],
  ['DAUM',`https://search.daum.net/search?w=tot&q=${encodeURIComponent(q)}`],
  ['MOJEEK',`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`],
  ['YAHOO',`https://search.yahoo.com/search?p=${encodeURIComponent(q)}`],
  ['GOOGLE-WEB',`https://www.google.com/search?q=${encodeURIComponent(q)}`]
 ];
 for(const [name,u] of urls){try{const r=await get(u);const hay=r.text;const hits={park:(hay.match(/박상훈/g)||[]).length,semes:(hay.match(/세메스|SEMES/gi)||[]).length,patent:(hay.match(/patents\.google|특허|patent/gi)||[]).length};console.log('[DEBUG-SEARCH]',JSON.stringify({name,status:r.status,type:r.type,len:hay.length,final:r.url,hits,links:links(hay).filter(x=>/박상훈|세메스|patent|특허|google/i.test(x.title+' '+x.href)).slice(0,12),head:strip(hay.slice(0,1800)).slice(0,500)}))}catch(e){console.log('[DEBUG-SEARCH-ERR]',name,e.message)}}
})().catch(e=>console.error('[DEBUG-FATAL]',e));
