const q='"박상훈" "SEMES"';
const targets=[
 ['mojeek',`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`],
 ['startpage',`https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`],
 ['ecosia',`https://www.ecosia.org/search?q=${encodeURIComponent(q)}`],
 ['qwant',`https://www.qwant.com/?q=${encodeURIComponent(q)}&t=web`]
];
async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7','accept':'text/html,*/*'}});return{status:r.status,text:await r.text(),type:r.headers.get('content-type')}}finally{clearTimeout(t)}}
function strip(s=''){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
function links(html=''){const out=[];for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){let u=m[1];if(u.startsWith('//'))u='https:'+u;if(!/^https?:\/\//i.test(u))continue;if(!out.includes(u))out.push(u);if(out.length>=80)break}return out}
(async()=>{for(const [name,url] of targets){try{const r=await get(url),text=strip(r.text),low=text.toLowerCase(),urls=links(r.text),interesting=urls.filter(u=>/linkedin|patents|scienceon|semes|semiconductor/i.test(u)).slice(0,20);console.log('[ALTSEARCH]',JSON.stringify({name,status:r.status,type:r.type,bytes:r.text.length,hitName:text.includes('박상훈'),hitCompany:low.includes('semes')||text.includes('세메스'),interesting,sample:text.slice(0,3200)}))}catch(e){console.log('[ALTSEARCH]',JSON.stringify({name,error:e.name+': '+e.message}))}}})().catch(e=>console.error('[ALTSEARCH] fatal',e));
