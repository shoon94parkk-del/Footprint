const q='"박상훈" "SEMES" LinkedIn';
const sources=[
  ['google',`https://www.google.com/search?q=${encodeURIComponent(q)}`],
  ['bing',`https://www.bing.com/search?q=${encodeURIComponent(q)}`],
  ['brave',`https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`],
  ['duckduckgo',`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`],
  ['yahoo',`https://search.yahoo.com/search?p=${encodeURIComponent(q)}`],
  ['naver',`https://search.naver.com/search.naver?where=web&query=${encodeURIComponent(q)}`]
];
function strip(s=''){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&amp;/g,' ').replace(/\s+/g,' ').trim()}
(async()=>{
  for(const [name,url] of sources){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
    try{
      const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7'}});
      const html=await r.text(),text=strip(html),low=text.toLowerCase(),hitName=text.includes('박상훈'),hitCompany=low.includes('semes')||text.includes('세메스'),hitLinkedin=low.includes('linkedin');
      const i=Math.max(0,[text.indexOf('박상훈'),low.indexOf('semes'),low.indexOf('linkedin')].filter(x=>x>=0).sort((a,b)=>a-b)[0]||0);
      console.log('[WEBBENCH]',JSON.stringify({name,status:r.status,bytes:html.length,hitName,hitCompany,hitLinkedin,sample:text.slice(Math.max(0,i-160),i+650)}));
    }catch(e){console.log('[WEBBENCH]',JSON.stringify({name,error:e.name+': '+e.message}))}
    finally{clearTimeout(t)}
  }
})().catch(e=>console.error('[WEBBENCH] fatal',e));
