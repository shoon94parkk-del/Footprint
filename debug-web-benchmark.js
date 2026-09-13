const queries=[
  '"박상훈" "SEMES" LinkedIn',
  '"박상훈" "SEMES" site:linkedin.com',
  '"박상훈" "세메스"',
  '"박상훈" "세메스" 특허',
  '"Sang Hoon Park" SEMES LinkedIn'
];
function strip(s=''){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
function parseBing(html){const out=[];const blocks=html.match(/<li class="b_algo"[\s\S]*?<\/li>/gi)||[];for(const b of blocks.slice(0,12)){const m=b.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!m)continue;const p=b.match(/<p[^>]*>([\s\S]*?)<\/p>/i);out.push({url:m[1],title:strip(m[2]),snippet:strip(p?.[1]||'')})}return out}
function parseRss(xml){const out=[];for(const item of xml.match(/<item>[\s\S]*?<\/item>/gi)||[]){const t=item.match(/<title>([\s\S]*?)<\/title>/i),l=item.match(/<link>([\s\S]*?)<\/link>/i),d=item.match(/<description>([\s\S]*?)<\/description>/i);if(l)out.push({url:strip(l[1]),title:strip(t?.[1]||''),snippet:strip(d?.[1]||'')})}return out}
async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7'}});return{status:r.status,text:await r.text()}}finally{clearTimeout(t)}}
(async()=>{for(const q of queries){for(const mode of ['html','rss']){try{const url=mode==='rss'?`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`:`https://www.bing.com/search?q=${encodeURIComponent(q)}`;const r=await get(url),rows=mode==='rss'?parseRss(r.text):parseBing(r.text);console.log('[BINGBENCH]',JSON.stringify({mode,q,status:r.status,count:rows.length,rows:rows.slice(0,8)}))}catch(e){console.log('[BINGBENCH]',JSON.stringify({mode,q,error:e.name+': '+e.message}))}}}})().catch(e=>console.error('[BINGBENCH] fatal',e));
