const http=require('http');
const fs=require('fs');
const path=require('path');
const {URL}=require('url');
const base=require('./server3');
const jina=require('./jina-search');
const PORT=process.env.PORT||10000,PUBLIC=path.join(__dirname,'public'),MAX_BODY=64*1024;

function clean(v,max=180){return String(v||'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,max)}
function strip(s=''){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
function domainOf(u=''){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}}
function yearOf(r){if(r.year)return r.year;const m=`${r.title||''} ${r.snippet||''}`.match(/\b(20\d{2}|19\d{2})\b/);return m?Number(m[1]):null}
async function fetchText(url,timeout=9000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7','accept':'text/html,application/xhtml+xml,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
function isSciencePatent(u=''){return /scienceon\.kisti\.re\.kr\/srch\/selectPORSrchPatent\.do\?cn=/i.test(u)}
function flattenReport(report){const rows=[];for(const group of Object.values(report?.grouped||{}))for(const r of group)rows.push({...r});return rows}
function companyHit(text,company){if(!company)return false;const low=String(text||'').toLowerCase();return jina.aliases(company).some(x=>low.includes(x.toLowerCase()))}
function normalizeKey(url=''){try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.toString().replace(/\/$/,'')}catch{return String(url).replace(/[#?].*$/,'')}}

function extractPatent(html,url,name,company,sourceQuery){const text=strip(html),low=text.toLowerCase(),n=name.toLowerCase();if(!low.includes(n))return null;if(!/발명자/.test(text)||!/출원인/.test(text))return null;const titleMatch=text.match(/(?:한국특허|공개 특허|등록 특허)\s+(.{2,160}?)(?:\s+원문보기|\s+내보내기|\s+MyON)/);const title=titleMatch?titleMatch[1].trim():'ScienceON 특허';const inventorIdx=text.indexOf('발명자'),assigneeIdx=text.indexOf('출원인');const start=Math.max(0,Math.min(inventorIdx>=0?inventorIdx:1e9,assigneeIdx>=0?assigneeIdx:1e9)-650),snippet=text.slice(start,start+2800);const ym=text.match(/공개번호[^\n]*?\((20\d{2})-|공개일[^\n]*?(20\d{2})/);return{title,url,snippet,source:'scienceon-patent',sourceQuery,year:ym?Number(ym[1]||ym[2]):null}}
async function getCandidates(query,pages=2){const out=new Map();for(let p=0;p<pages;p++){const start=1+p*10;for(const where of ['web','nexearch']){try{const html=await fetchText(`https://search.naver.com/search.naver?where=${where}&query=${encodeURIComponent(query)}&start=${start}`,6000);for(const r of base.parseNaverHtml(html,query)){if(isSciencePatent(r.url)){const m=r.url.match(/[?&]cn=([^&#]+)/i),key=m?m[1]:r.url;if(!out.has(key))out.set(key,r)}}}catch{}}}return[...out.values()]}
async function verifyCandidates(candidates,name,company){const out=[];for(let i=0;i<candidates.length;i+=5){const chunk=candidates.slice(i,i+5),got=await Promise.all(chunk.map(async r=>{try{return extractPatent(await fetchText(r.url,9000),r.url,name,company,r.sourceQuery)}catch{return null}}));out.push(...got.filter(Boolean))}return out}

function buildOrQueries(h){
  const name=clean(h.name,80),q=s=>`"${String(s).replace(/["\\]/g,' ').trim()}"`,set=new Set();
  if(!name)return[];
  set.add(q(name));
  const add=(value,suffix='')=>{value=clean(value);if(!value)return;set.add(`${q(name)} ${q(value)}${suffix?` ${suffix}`:''}`);};
  for(const c of jina.aliases(h.company)){
    add(c);add(c,'LinkedIn');add(c,'특허');add(c,'발명자');
  }
  add(h.school);if(h.school)add(h.school,'LinkedIn');
  add(h.role);add(h.region);add(h.nickname);
  if(h.nickname){add(h.nickname,'Instagram');add(h.nickname,'블로그')}
  add(h.keyword);
  if(h.email){set.add(q(h.email));add(h.email)}
  if(h.social){set.add(q(h.social));add(h.social)}
  if(h.github){set.add(q(h.github));add(h.github);add(h.github,'GitHub')}
  return [...set].filter(Boolean).slice(0,24);
}
async function naverPublicSearch(query){try{const html=await fetchText(`https://search.naver.com/search.naver?where=web&query=${encodeURIComponent(query)}`,6500);return base.parseNaverHtml(html,query).slice(0,25)}catch{return[]}}
async function discoverPublic(h){const qs=buildOrQueries(h),rows=[];for(let i=0;i<qs.length;i+=5){const chunk=qs.slice(i,i+5),got=await Promise.all(chunk.map(naverPublicSearch));for(const batch of got)rows.push(...batch)}return{rows,queries:qs}}

function matchedHints(r,h){
  const hay=`${r.title||''} ${r.snippet||''} ${r.url||''}`.toLowerCase(),hits=[];
  const has=v=>v&&hay.includes(String(v).toLowerCase());
  if(jina.aliases(h.company).some(has))hits.push('회사');
  if(has(h.school))hits.push('학교');
  if(has(h.email))hits.push('이메일');
  if(has(h.role))hits.push('직업');
  if(has(h.region))hits.push('지역');
  if(has(h.nickname))hits.push('닉네임');
  if(has(h.social))hits.push('SNS');
  if(has(h.github))hits.push('GitHub');
  if(has(h.keyword))hits.push('추가 키워드');
  if(has(h.ageBand))hits.push('나이대');
  return [...new Set(hits)];
}
function scoreCandidate(r,h){
  const hay=`${r.title||''} ${r.snippet||''} ${r.url||''}`.toLowerCase(),name=String(h.name||'').toLowerCase();let s=8;
  const nameHit=name&&hay.includes(name),hits=matchedHints(r,h);
  if(nameHit)s+=38;
  const weights={회사:30,학교:24,이메일:45,직업:14,지역:10,닉네임:24,SNS:22,GitHub:22,'추가 키워드':8,나이대:4};
  for(const x of hits)s+=weights[x]||0;
  if(hits.length>1)s+=Math.min(12,(hits.length-1)*4);
  const cat=base.categoryOf(r);
  if(cat==='patent'&&nameHit&&hits.includes('회사'))s+=10;
  if(cat==='career'&&nameHit&&hits.some(x=>['회사','학교','직업'].includes(x)))s+=10;
  if(!nameHit&&!hits.includes('이메일')&&!hits.includes('SNS')&&!hits.includes('GitHub'))s=Math.min(s,42);
  return Math.min(98,s);
}
function buildReport(h,results,meta={}){
  const seen=new Map();
  for(const r of results){if(!r?.url)continue;const k=normalizeKey(r.url),old=seen.get(k);if(!old||scoreCandidate(r,h)>scoreCandidate(old,h))seen.set(k,r)}
  const enriched=[...seen.values()].map(r=>({...r,category:base.categoryOf(r),confidence:scoreCandidate(r,h),matchedHints:matchedHints(r,h),domain:domainOf(r.url),year:yearOf(r)}));
  const likely=enriched.filter(r=>r.confidence>=52),cats=[...new Set(likely.map(r=>r.category))],domains=[...new Set(likely.map(r=>r.domain).filter(Boolean))];
  const hintCount=['company','school','email','role','region','nickname','social','github','keyword','ageBand'].filter(k=>h[k]).length;
  const score=Math.min(96,Math.round(15+likely.length*3+cats.length*6+domains.length*2+hintCount*2));
  const avg=likely.length?likely.reduce((n,r)=>n+r.confidence,0)/likely.length:35,match=Math.min(97,Math.round(avg));
  const persona=base.inferPersona(likely,h),top=persona.interests.slice(0,3).map(x=>x.label),pc=likely.filter(r=>r.category==='patent').length;
  let narrative=`공개 인터넷에서 ${h.name}과 연결 가능성이 있는 후보 ${enriched.length}건을 모았고, 그중 ${likely.length}건을 관련성이 높은 흔적으로 분류했습니다.`;
  if(hintCount)narrative+=` 입력한 ${hintCount}개의 부가정보는 모두 OR 조건으로 독립 검색한 뒤 본인 일치 근거로만 사용했습니다.`;
  if(pc)narrative+=` 특허·발명 기록은 ${pc}건이 연결됩니다.`;
  if(persona.occupation!=='직업을 충분히 추정하기 어려움')narrative+=` 공개 기록상 ‘${persona.occupation}’ 가능성이 높습니다.`;
  if(top.length)narrative+=` 반복되는 관심 주제는 ${top.join(', ')}입니다.`;
  const grouped={};for(const r of likely.sort((a,b)=>b.confidence-a.confidence))(grouped[r.category]||=[]).push(r);
  const timeline=likely.filter(r=>r.year).sort((a,b)=>a.year-b.year).slice(0,24).map(r=>({year:r.year,title:r.title,category:r.category,confidence:r.confidence}));
  return{score,confidence:match,narrative,keywords:top,persona,grouped,timeline,stats:{likely:likely.length,total:enriched.length,domains:domains.length,categories:cats.length,patents:pc},sources:{naverHtml:true,scienceOn:true,publicWeb:true,orHintSearch:true,queryCount:meta.queryCount||0,jinaSearch:Boolean(meta.jinaEnabled),jinaQueries:meta.jinaQueries||0,jinaError:meta.jinaError||null}};
}

function expansionQueries(name,company,initialRows){const qs=new Set();for(const c of jina.aliases(company)){for(const q of [`${name} ${c}`,`"${name}" "${c}"`,`${name} ${c} 특허`,`${name} ${c} 발명자`])qs.add(q)}const text=initialRows.map(r=>`${r.title||''} ${r.snippet||''}`).join(' ').toLowerCase();for(const term of ['기판','잉크젯','프린팅','본딩','bonding','printing','inkjet','wafer'])if(text.includes(term.toLowerCase()))qs.add(`${name} ${company} ${term}`);return[...qs].filter(Boolean).slice(0,8)}
async function scan(input){
  if(input.selfAudit!=='yes')throw new Error('본인 또는 본인의 동의를 받은 검색만 이용할 수 있습니다.');
  const h={name:clean(input.name,80),ageBand:clean(input.ageBand,20),company:clean(input.company,100),school:clean(input.school,100),email:clean(input.email,160),role:clean(input.role,100),region:clean(input.region,80),nickname:clean(input.nickname,80),social:clean(input.social,180),github:clean(input.github,80),keyword:clean(input.keyword,100)};
  if(!h.name)throw new Error('이름은 필수입니다.');
  const baseInput={...h,selfAudit:'yes'};
  const [first,publicDiscovery,js]=await Promise.all([
    base.scan(baseInput).catch(()=>({report:{grouped:{}}})),
    discoverPublic(h).catch(()=>({rows:[],queries:[]})),
    jina.search(h).catch(e=>({rows:[],enabled:Boolean(process.env.JINA_API_KEY),error:e.message,queries:[]}))
  ]);
  const all=[...flattenReport(first.report),...publicDiscovery.rows,...js.rows],maps=new Map();
  for(const r of all)if(r?.url)maps.set(normalizeKey(r.url),r);
  if(h.company){
    const patentQueries=expansionQueries(h.name,h.company,[...maps.values()]),candidateBatches=await Promise.all(patentQueries.map(q=>getCandidates(q,2).catch(()=>[]))),candidateMap=new Map();
    for(const r of candidateBatches.flat())candidateMap.set(normalizeKey(r.url),r);
    const verified=await verifyCandidates([...candidateMap.values()],h.name,h.company);
    for(const r of verified)maps.set(normalizeKey(r.url),r);
  }
  const report=buildReport(h,[...maps.values()],{queryCount:publicDiscovery.queries.length,jinaEnabled:js.enabled,jinaQueries:js.queries.length,jinaError:js.error});
  return{input:h,report};
}
function sendJson(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj))}
function serveStatic(res,pn){let f=pn==='/'?'/index.html':pn;f=path.normalize(f).replace(/^\.\.(\/|\\)/,'');const full=path.join(PUBLIC,f);if(!full.startsWith(PUBLIC))return sendJson(res,403,{error:'Forbidden'});fs.readFile(full,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}const ext=path.extname(full),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-cache':'public,max-age=120'});res.end(d)})}
const server=http.createServer((req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);if(req.method==='GET'&&u.pathname==='/health')return sendJson(res,200,{ok:true,version:'0.9.0',searchMode:'OR-hints',advancedSearch:Boolean(process.env.JINA_API_KEY)});if(req.method==='GET'&&u.pathname==='/api/selftest'){scan({selfAudit:'yes',name:'박상훈',company:'세메스',school:'동양미래대학교',region:'서울',ageBand:'30대'}).then(x=>sendJson(res,200,{ok:x.report.stats.likely>=4,stats:x.report.stats,sources:x.report.sources,persona:x.report.persona,grouped:x.report.grouped})).catch(e=>sendJson(res,500,{ok:false,error:e.message}));return}if(req.method==='POST'&&u.pathname==='/api/scan'){let b='';req.on('data',c=>{b+=c;if(b.length>MAX_BODY)req.destroy()});req.on('end',async()=>{try{sendJson(res,200,await scan(JSON.parse(b||'{}')))}catch(e){sendJson(res,400,{error:e.message||'검색 실패'})}});return}if(req.method==='GET')return serveStatic(res,u.pathname);res.writeHead(405);res.end('Method not allowed')});
if(require.main===module)server.listen(PORT,()=>console.log(`Footprint v0.9 listening on ${PORT}`));
module.exports={scan,extractPatent,getCandidates,verifyCandidates,expansionQueries,buildOrQueries,matchedHints,scoreCandidate,buildReport};
