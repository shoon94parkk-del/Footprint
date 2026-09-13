const q='"박상훈" "SEMES" LinkedIn';
const targets=[
  ['s-jina',`https://s.jina.ai/${encodeURIComponent(q)}`],
  ['search-jina',`https://search.jina.ai/?q=${encodeURIComponent(q)}`]
];
async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0','accept-language':'ko-KR,ko;q=0.9,en;q=0.7','accept':'text/html,application/json,text/plain,*/*'}});return{status:r.status,text:await r.text(),type:r.headers.get('content-type')}}finally{clearTimeout(t)}}
function links(text=''){const out=[];for(const m of text.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)){const u=m[0].replace(/[),.;]+$/,'');if(!out.includes(u))out.push(u);if(out.length>=25)break}return out}
(async()=>{for(const [name,url] of targets){try{const r=await get(url),low=r.text.toLowerCase();console.log('[JINASEARCH]',JSON.stringify({name,status:r.status,type:r.type,bytes:r.text.length,hitName:r.text.includes('박상훈'),hitCompany:low.includes('semes')||r.text.includes('세메스'),hitLinkedin:low.includes('linkedin'),links:links(r.text),sample:r.text.slice(0,5000)}))}catch(e){console.log('[JINASEARCH]',JSON.stringify({name,error:e.name+': '+e.message}))}}})().catch(e=>console.error('[JINASEARCH] fatal',e));
