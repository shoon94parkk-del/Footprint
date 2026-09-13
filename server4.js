const http=require('http');
const fs=require('fs');
const path=require('path');
const {URL}=require('url');
const base=require('./server3');
const jina=require('./jina-search');
const PORT=process.env.PORT||10000,PUBLIC=path.join(__dirname,'public'),MAX_BODY=64*1024;

function strip(s=''){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
async function fetchText(url,timeout=9000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7','accept':'text/html,application/xhtml+xml,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
function isSciencePatent(u=''){return /scienceon\.kisti\.re\.kr\/srch\/selectPORSrchPatent\.do\?cn=/i.test(u)}
function flattenReport(report){const rows=[];for(const group of Object.values(report.grouped||{}))for(const r of group)rows.push({...r});return rows}
function companyHit(text,company){if(!company)return true;const low=String(text||'').toLowerCase();return jina.aliases(company).some(x=>low.includes(x.toLowerCase()))}
function extractPatent(html,url,name,company,sourceQuery){const text=strip(html),low=text.toLowerCase(),n=name.toLowerCase();if(!low.includes(n)||!companyHit(text,company))return null;if(!/발명자/.test(text)||!/출원인/.test(text))return null;const titleMatch=text.match(/(?:한국특허|공개 특허|등록 특허)\s+(.{2,160}?)(?:\s+원문보기|\s+내보내기|\s+MyON)/);const title=titleMatch?titleMatch[1].trim():'ScienceON 특허';const inventorIdx=text.indexOf('발명자'),assigneeIdx=text.indexOf('출원인');const start=Math.max(0,Math.min(inventorIdx>=0?inventorIdx:1e9,assigneeIdx>=0?assigneeIdx:1e9)-650),snippet=text.slice(start,start+2600);const ym=text.match(/공개번호[^\n]*?\((20\d{2})-|공개일[^\n]*?(20\d{2})/);return{title,url,snippet,source:'scienceon-patent',sourceQuery,year:ym?Number(ym[1]||ym[2]):null}}
async function getCandidates(query,pages=6){const out=new Map();for(let p=0;p<pages;p++){const start=1+p*10;for(const where of ['web','nexearch']){try{const html=await fetchText(`https://search.naver.com/search.naver?where=${where}&query=${encodeURIComponent(query)}&start=${start}`,6000);for(const r of base.parseNaverHtml(html,query)){if(isSciencePatent(r.url)){const m=r.url.match(/[?&]cn=([^&#]+)/i),key=m?m[1]:r.url;if(!out.has(key))out.set(key,r)}}}catch{}}}return[...out.values()]}
async function verifyCandidates(candidates,name,company){const out=[];for(let i=0;i<candidates.length;i+=5){const chunk=candidates.slice(i,i+5);const got=await Promise.all(chunk.map(async r=>{try{return extractPatent(await fetchText(r.url,9000),r.url,name,company,r.sourceQuery)}catch{return null}}));out.push(...got.filter(Boolean))}return out}
function expansionQueries(name,company,initialRows){const qs=new Set(),aliases=jina.aliases(company);for(const c of aliases.length?aliases:['']){for(const q of [`${name} ${c}`,`"${name}" "${c}"`,`${name} ${c} 특허`,`${name} ${c} 발명자`])if(q.trim())qs.add(q.trim())}const text=initialRows.map(r=>`${r.title||''} ${r.snippet||''}`).join(' ');for(const term of ['기판','잉크젯','프린팅','본딩','bonding','printing','inkjet','wafer'])if(text.toLowerCase().includes(term.toLowerCase()))qs.add(`${name} ${company} ${term}`);return[...qs]}
async function scan(input){
  const jinaPromise=jina.search(input).catch(e=>({rows:[],enabled:Boolean(process.env.JINA_API_KEY),error:e.message,queries:[]}));
  const first=await base.scan(input),h=first.input;
  const js=await jinaPromise;
  const existing=[...flattenReport(first.report),...js.rows],maps=new Map();
  for(const r of existing)if(r?.url)maps.set(r.url.replace(/[?#].*$/,''),r);
  if(!js.enabled){
    const queries=expansionQueries(h.name,h.company||'',existing);
    for(const q of queries){const candidates=await getCandidates(q,q.includes('발명자')?3:4),verified=await verifyCandidates(candidates,h.name,h.company||'');for(const r of verified)maps.set(r.url.replace(/[?#].*$/,''),r)}
  }else{
    const science=[...maps.values()].filter(r=>isSciencePatent(r.url));
    const verified=await verifyCandidates(science,h.name,h.company||'');
    for(const r of verified)maps.set(r.url.replace(/[?#].*$/,''),r);
  }
  const report=base.buildReport(h,[...maps.values()]);
  report.sources={...(report.sources||{}),verifiedScienceOn:true,jinaSearch:js.enabled,jinaQueries:js.queries.length,jinaError:js.error||null};
  return{input:h,report};
}
function sendJson(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj))}
function serveStatic(res,pn){let f=pn==='/'?'/index.html':pn;f=path.normalize(f).replace(/^\.\.(\/|\\)/,'');const full=path.join(PUBLIC,f);if(!full.startsWith(PUBLIC))return sendJson(res,403,{error:'Forbidden'});fs.readFile(full,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}const ext=path.extname(full),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-cache':'public,max-age=120'});res.end(d)})}
const server=http.createServer((req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);if(req.method==='GET'&&u.pathname==='/health')return sendJson(res,200,{ok:true,version:'0.8.0',advancedSearch:Boolean(process.env.JINA_API_KEY),naverApi:Boolean(process.env.NAVER_CLIENT_ID&&process.env.NAVER_CLIENT_SECRET)});if(req.method==='GET'&&u.pathname==='/api/selftest'){scan({selfAudit:'yes',name:'박상훈',company:'세메스',school:'동양미래대학교',region:'서울',ageBand:'30대'}).then(x=>sendJson(res,200,{ok:x.report.stats.likely>=4,stats:x.report.stats,sources:x.report.sources,persona:x.report.persona,grouped:x.report.grouped})).catch(e=>sendJson(res,500,{ok:false,error:e.message}));return}if(req.method==='POST'&&u.pathname==='/api/scan'){let b='';req.on('data',c=>{b+=c;if(b.length>MAX_BODY)req.destroy()});req.on('end',async()=>{try{sendJson(res,200,await scan(JSON.parse(b||'{}')))}catch(e){sendJson(res,400,{error:e.message||'검색 실패'})}});return}if(req.method==='GET')return serveStatic(res,u.pathname);res.writeHead(405);res.end('Method not allowed')});
if(require.main===module)server.listen(PORT,()=>console.log(`Footprint v0.8 listening on ${PORT}`));
module.exports={scan,extractPatent,getCandidates,verifyCandidates,expansionQueries};
