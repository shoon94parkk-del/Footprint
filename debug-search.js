function strip(s=''){return String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
async function get(url,timeout=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7'}});return{status:r.status,text:await r.text(),type:r.headers.get('content-type')}}finally{clearTimeout(t)}}
function rssItems(text){return[...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,10).map(m=>({title:strip((m[1].match(/<title>([\s\S]*?)<\/title>/i)||[])[1]),link:strip((m[1].match(/<link>([\s\S]*?)<\/link>/i)||[])[1]),desc:strip((m[1].match(/<description>([\s\S]*?)<\/description>/i)||[])[1]).slice(0,180)}))}
(async()=>{
 const name='박상훈',company='세메스';
 const patentUrl=`https://patents.google.com/?inventor=${encodeURIComponent(name)}&assignee=${encodeURIComponent(company)}&country=KR&num=100`;
 try{const r=await get(patentUrl);console.log('[DEBUG-PATENTS]',JSON.stringify({status:r.status,len:r.text.length,head:strip(r.text.slice(0,1000)).slice(0,450)}))}catch(e){console.log('[DEBUG-PATENTS-ERR]',e.message)}
 const queries=[
  '"박상훈" "세메스" patent',
  '"Sang Hoon Park" SEMES patent',
  '"Sang-Hoon Park" SEMES patent',
  '"Sanghoon Park" SEMES patent',
  '"Sang Hoon Park" "Semes Co Ltd"'
 ];
 for(const q of queries){try{const u=`https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss&count=30&mkt=ko-KR&setlang=ko`;const r=await get(u);console.log('[DEBUG-BING-Q]',JSON.stringify({q,status:r.status,items:rssItems(r.text)}))}catch(e){console.log('[DEBUG-BING-ERR]',q,e.message)}}
 const justiaUrls=[
  'https://patents.justia.com/search?q=%22Sang+Hoon+Park%22+SEMES',
  'https://patents.justia.com/search?q=%22Sang-Hoon+Park%22+SEMES',
  'https://patents.justia.com/inventor/sang-hoon-park'
 ];
 for(const u of justiaUrls){try{const r=await get(u);const hits=[...r.text.matchAll(/SEMES|Semes|Sang Hoon Park|Sang-Hoon Park/gi)].length;console.log('[DEBUG-JUSTIA]',JSON.stringify({url:u,status:r.status,type:r.type,len:r.text.length,hits,head:strip(r.text.slice(0,3000)).slice(0,700)}))}catch(e){console.log('[DEBUG-JUSTIA-ERR]',u,e.message)}}
})().catch(e=>console.error('[DEBUG-FATAL]',e));
