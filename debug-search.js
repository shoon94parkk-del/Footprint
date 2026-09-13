function strip(s=''){return String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
async function get(url,timeout=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7'}});return{status:r.status,text:await r.text(),type:r.headers.get('content-type')}}finally{clearTimeout(t)}}
(async()=>{
 const name='박상훈',company='세메스';
 const patentUrls=[
  `https://patents.google.com/?inventor=${encodeURIComponent(name)}&assignee=${encodeURIComponent(company)}&country=KR&num=100`,
  `https://patents.google.com/?q=${encodeURIComponent(`inventor=(${name})&assignee=(${company})`)}&country=KR&num=100`,
  `https://patents.google.com/?q=${encodeURIComponent(`"${name}" "${company}"`)}&country=KR&num=100`
 ];
 for(const u of patentUrls){try{const r=await get(u);const ids=[...r.text.matchAll(/\/patent\/([A-Z]{2,4}[A-Z0-9]+)/gi)].map(m=>m[1]).filter((x,i,a)=>a.indexOf(x)===i).slice(0,15);const hits=[...r.text.matchAll(/(?:박상훈|세메스)/g)].length;console.log('[DEBUG-PATENTS]',JSON.stringify({url:u,status:r.status,type:r.type,len:r.text.length,hits,ids,head:strip(r.text.slice(0,1200)).slice(0,500)}))}catch(e){console.log('[DEBUG-PATENTS-ERR]',u,e.message)}}
 const bing=`https://www.bing.com/search?q=${encodeURIComponent(`"${name}" "${company}" site:patents.google.com/patent`)}&format=rss&count=30`;
 try{const r=await get(bing);const items=[...r.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,10).map(m=>({title:strip((m[1].match(/<title>([\s\S]*?)<\/title>/i)||[])[1]),link:strip((m[1].match(/<link>([\s\S]*?)<\/link>/i)||[])[1]),desc:strip((m[1].match(/<description>([\s\S]*?)<\/description>/i)||[])[1]).slice(0,160)}));console.log('[DEBUG-BING]',JSON.stringify({status:r.status,type:r.type,len:r.text.length,items}))}catch(e){console.log('[DEBUG-BING-ERR]',e.message)}
})().catch(e=>console.error('[DEBUG-FATAL]',e));
