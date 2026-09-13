const targets=[
  ['linkedin-directory','https://kr.linkedin.com/pub/dir/%EC%83%81%ED%9B%88/%EB%B0%95/kr-0-%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD'],
  ['google-patents-search','https://patents.google.com/?inventor=%EB%B0%95%EC%83%81%ED%9B%88&assignee=%EC%84%B8%EB%A9%94%EC%8A%A4&num=25']
];
async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0','accept-language':'ko-KR,ko;q=0.9,en;q=0.7'}});return{status:r.status,text:await r.text()}}finally{clearTimeout(t)}}
function links(text=''){const out=[];for(const m of text.matchAll(/\[([^\]]{2,180})\]\((https?:\/\/[^)\s]+)\)/g)){out.push({title:m[1],url:m[2]});if(out.length>=30)break}return out}
(async()=>{for(const [name,target] of targets){try{const url=`https://r.jina.ai/${target}`,r=await get(url),low=r.text.toLowerCase();console.log('[JINADIRECT]',JSON.stringify({name,status:r.status,bytes:r.text.length,hitName:r.text.includes('박상훈'),hitCompany:low.includes('semes')||r.text.includes('세메스'),hitLinkedin:low.includes('linkedin'),links:links(r.text),sample:r.text.slice(0,4500)}))}catch(e){console.log('[JINADIRECT]',JSON.stringify({name,error:e.name+': '+e.message}))}}})().catch(e=>console.error('[JINADIRECT] fatal',e));
