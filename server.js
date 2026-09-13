const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_BODY = 64 * 1024;

function clean(v, max = 120) {
  return String(v || '').trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
}
function htmlDecode(s='') {
  return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function stripTags(s='') { return htmlDecode(s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()); }
function unwrapDuckUrl(href='') {
  const decoded=htmlDecode(href);
  try { const u=new URL(decoded.startsWith('//')?'https:'+decoded:decoded,'https://duckduckgo.com'); const x=u.searchParams.get('uddg'); return x?decodeURIComponent(x):u.href; } catch { return decoded; }
}
async function fetchText(url, opts={}, timeoutMs=8500) {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const res=await fetch(url,{...opts,signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; FootprintSelfAudit/0.3)','accept-language':'ko-KR,ko;q=0.9,en;q=0.7',...(opts.headers||{})}});
    if(!res.ok) throw new Error(`HTTP ${res.status}`); return await res.text();
  } finally { clearTimeout(timer); }
}
async function duckSearch(query, limit=8) {
  const html=await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const out=[]; const re=/<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  let m; while((m=re.exec(html))&&out.length<limit){ const url=unwrapDuckUrl(m[1]); if(/^https?:\/\//i.test(url)) out.push({title:stripTags(m[2]),url,snippet:stripTags(m[3]),source:'web'}); }
  return out;
}
async function crossrefSearch(name,hints,limit=5){
  const q=[name,hints.company,hints.school,hints.role].filter(Boolean).join(' ');
  const text=await fetchText(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${limit}&select=DOI,title,author,published,URL,publisher`,{headers:{accept:'application/json'}});
  const json=JSON.parse(text);
  return (json.message?.items||[]).map(item=>{const year=item.published?.['date-parts']?.[0]?.[0]||null; const authors=(item.author||[]).map(a=>[a.given,a.family].filter(Boolean).join(' ')).join(', '); return {title:(item.title||[])[0]||'학술 자료',url:item.URL||(item.DOI?`https://doi.org/${item.DOI}`:''),snippet:[authors,item.publisher,year].filter(Boolean).join(' · '),year,source:'academic'};}).filter(x=>x.url);
}
async function naverSearch(query){
  const id=process.env.NAVER_CLIENT_ID, secret=process.env.NAVER_CLIENT_SECRET; if(!id||!secret) return [];
  const headers={'X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret};
  const kinds=[['webkr','naver-web'],['blog','naver-blog'],['cafearticle','naver-cafe'],['news','naver-news']];
  const batches=await Promise.all(kinds.map(async([kind,source])=>{try{const t=await fetchText(`https://openapi.naver.com/v1/search/${kind}.json?query=${encodeURIComponent(query)}&display=10&sort=sim`,{headers}); const j=JSON.parse(t); return (j.items||[]).map(x=>({title:stripTags(x.title||''),url:x.link||x.originallink||'',snippet:stripTags(x.description||''),source}));}catch{return[];}}));
  return batches.flat().filter(x=>x.url);
}
async function kakaoSearch(query){
  const key=process.env.KAKAO_REST_API_KEY; if(!key) return [];
  const headers={Authorization:`KakaoAK ${key}`}; const kinds=[['web','kakao-web'],['blog','kakao-blog'],['cafe','kakao-cafe']];
  const batches=await Promise.all(kinds.map(async([kind,source])=>{try{const t=await fetchText(`https://dapi.kakao.com/v2/search/${kind}?query=${encodeURIComponent(query)}&size=10&sort=accuracy`,{headers}); const j=JSON.parse(t); return (j.documents||[]).map(x=>({title:stripTags(x.title||''),url:x.url||'',snippet:stripTags(x.contents||''),source}));}catch{return[];}}));
  return batches.flat().filter(x=>x.url);
}
async function githubLookup(username){
  if(!username) return null; const safe=username.replace(/^@/,'').trim(); if(!/^[A-Za-z0-9-]{1,39}$/.test(safe)) return null;
  try{const [u,r]=await Promise.all([fetchText(`https://api.github.com/users/${encodeURIComponent(safe)}`,{headers:{accept:'application/vnd.github+json'}}),fetchText(`https://api.github.com/users/${encodeURIComponent(safe)}/repos?sort=updated&per_page=6`,{headers:{accept:'application/vnd.github+json'}})]); const user=JSON.parse(u),repos=JSON.parse(r); return {user:{login:user.login,name:user.name,bio:user.bio,company:user.company,location:user.location,html_url:user.html_url,public_repos:user.public_repos,created_at:user.created_at},repos:Array.isArray(repos)?repos:[]};}catch{return null;}
}
function domainOf(url=''){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return'';}}
function categoryOf(r){
  const d=domainOf(r.url).toLowerCase(), t=`${r.title} ${r.snippet}`.toLowerCase();
  if(/instagram\.com|facebook\.com|threads\.net|youtube\.com|youtu\.be/.test(d)) return 'social';
  if(/blog\.naver\.com|tistory\.com|brunch\.co\.kr|post\.naver\.com/.test(d)||/naver-blog|kakao-blog/.test(r.source||'')) return 'blog';
  if(/cafe\.naver\.com|cafe\.daum\.net/.test(d)||/naver-cafe|kakao-cafe/.test(r.source||'')) return 'community';
  if(d.includes('patents.google')||d.includes('kipris')||t.includes('patent')||t.includes('특허')) return 'patent';
  if(d.includes('github.com')) return 'developer';
  if(d.includes('linkedin.com')) return 'career';
  if(r.source==='academic'||d.includes('doi.org')||d.includes('researchgate')||d.includes('orcid')) return 'academic';
  if(/news|newspaper|press|기사|뉴스/.test(t)||/naver-news/.test(r.source||'')) return 'news';
  return 'web';
}
function calcConfidence(r,hints){
  const hay=`${r.title} ${r.snippet} ${r.url}`.toLowerCase(); let s=38;
  const checks=[[hints.company,20],[hints.school,15],[hints.role,12],[hints.region,7],[hints.nickname,18],[hints.social,22],[hints.keyword,10]];
  for(const[v,pts]of checks) if(v&&hay.includes(v.toLowerCase())) s+=pts;
  if(categoryOf(r)==='patent'&&hints.company) s+=6; if(categoryOf(r)==='social'&&hints.nickname) s+=7;
  return Math.min(96,s);
}
function extractYear(r){if(r.year)return r.year;const ys=[...`${r.title} ${r.snippet}`.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=1980&&y<=2035);return ys[0]||null;}

const INTERESTS=[
 ['기술·엔지니어링',['wafer','semiconductor','반도체','엔지니어','engineering','설계','장비','특허','patent']],
 ['소프트웨어·AI',['github','developer','software','python','javascript',' ai ','llm','코딩','개발']],
 ['투자·경제',['주식','투자','증시','etf','stock','finance','경제','부동산']],
 ['여행',['여행','travel','호텔','항공','trip','맛집','관광']],
 ['사진·디자인',['사진','photography','camera','design','디자인','전시']],
 ['스포츠·운동',['운동','헬스','러닝','축구','야구','골프','fitness','running']],
 ['음식·카페',['맛집','카페','coffee','요리','레시피','restaurant']],
 ['자동차',['자동차','차량','car','vehicle','드라이브']],
 ['반려동물',['강아지','고양이','반려','dog','cat','pet']],
 ['문화·콘텐츠',['영화','드라마','공연','음악','책','movie','music','book']]
];
function inferPersona(results,hints){
  const text=results.map(r=>`${r.title} ${r.snippet}`).join(' ').toLowerCase();
  const interests=INTERESTS.map(([label,terms])=>{const hits=terms.reduce((n,x)=>n+(text.split(x).length-1),0);return{label,hits,confidence:Math.min(94,46+hits*8)};}).filter(x=>x.hits>0).sort((a,b)=>b.hits-a.hits).slice(0,5);
  const cats=results.reduce((m,r)=>{const c=categoryOf(r);m[c]=(m[c]||0)+1;return m;},{});
  const styles=[];
  if((cats.patent||0)+(cats.academic||0)>=2) styles.push({label:'전문성 중심',confidence:Math.min(92,58+((cats.patent||0)+(cats.academic||0))*6),why:'특허·연구 자료가 반복적으로 발견됨'});
  if((cats.blog||0)+(cats.social||0)>=2) styles.push({label:'기록·공유형',confidence:Math.min(90,54+((cats.blog||0)+(cats.social||0))*5),why:'블로그·SNS 공개 활동이 반복적으로 발견됨'});
  if(/비교|분석|리뷰|후기|정리|가이드|분석/.test(text)) styles.push({label:'분석·비교형',confidence:68,why:'비교·분석·리뷰형 표현이 공개 콘텐츠에 반복됨'});
  let occupation=hints.role||'';
  if(!occupation){if(/engineer|엔지니어|설계|wafer|semiconductor/.test(text))occupation='기술·엔지니어링 종사 가능성'; else if(/developer|software|github|개발자/.test(text))occupation='소프트웨어·개발 종사 가능성'; else if(/research|연구|논문/.test(text))occupation='연구·전문직 종사 가능성';}
  return {occupation:occupation||'직업을 충분히 추정하기 어려움',interests,styles:styles.slice(0,3)};
}
function keywordProfile(results){return inferPersona(results,{}).interests.map(x=>x.label).slice(0,6);}
function buildReport(input,results,github){
  const enriched=results.map(r=>({...r,category:categoryOf(r),confidence:calcConfidence(r,input),domain:domainOf(r.url),year:extractYear(r)}));
  const likely=enriched.filter(r=>r.confidence>=55); const categories=[...new Set(likely.map(r=>r.category))],domains=[...new Set(likely.map(r=>r.domain).filter(Boolean))];
  const hintCount=['company','school','role','region','nickname','social','keyword','ageBand'].filter(k=>input[k]).length;
  const score=Math.min(94,Math.round(16+likely.length*2.8+categories.length*6+Math.min(domains.length,10)*2+hintCount*3));
  const confidence=Math.min(95,Math.round(43+hintCount*6+Math.min(likely.length,9)*3));
  const persona=inferPersona(likely,input); const top=persona.interests.slice(0,3).map(x=>x.label);
  let narrative=`공개 인터넷에서 ${input.name}과 연결 가능성이 높은 흔적 ${likely.length}건을 찾았습니다.`;
  if(input.company) narrative+=` ${input.company} 관련 정보와 교차해 동명이인을 줄였습니다.`;
  if(persona.occupation) narrative+=` 직업·활동 영역은 ‘${persona.occupation}’로 보입니다.`;
  if(top.length) narrative+=` 공개 활동에서 특히 ${top.join(', ')} 주제가 반복됩니다.`;
  if(persona.styles[0]) narrative+=` 온라인에서는 ‘${persona.styles[0].label}’ 성격의 활동이 상대적으로 두드러집니다.`;
  const timeline=likely.filter(r=>r.year).sort((a,b)=>a.year-b.year).slice(0,12).map(r=>({year:r.year,title:r.title,category:r.category,confidence:r.confidence}));
  const grouped={}; for(const r of likely.sort((a,b)=>b.confidence-a.confidence))(grouped[r.category]||=[]).push(r);
  if(github){grouped.developer||=[];grouped.developer.unshift({title:`GitHub @${github.user.login}`,snippet:[github.user.name,github.user.bio,github.user.company,`${github.user.public_repos} public repos`].filter(Boolean).join(' · '),category:'developer',confidence:98,domain:'github.com',year:new Date(github.user.created_at).getFullYear()});}
  return {score,confidence,narrative,keywords:top,persona,grouped,timeline,stats:{likely:likely.length,total:enriched.length,domains:domains.length,categories:categories.length},sources:{naver:Boolean(process.env.NAVER_CLIENT_ID&&process.env.NAVER_CLIENT_SECRET),kakao:Boolean(process.env.KAKAO_REST_API_KEY),publicWeb:true}};
}
async function scan(input){
  if(input.selfAudit!=='yes') throw new Error('본인 또는 본인의 동의를 받은 검색만 이용할 수 있습니다.');
  const name=clean(input.name,80); if(!name)throw new Error('이름은 필수입니다.');
  const hints={name,ageBand:clean(input.ageBand,20),company:clean(input.company,100),school:clean(input.school,100),role:clean(input.role,100),region:clean(input.region,80),nickname:clean(input.nickname,80),social:clean(input.social,160),github:clean(input.github,50),keyword:clean(input.keyword,100)};
  const parts=[name,hints.company,hints.school,hints.role,hints.region,hints.nickname].filter(Boolean); const core=parts.map(x=>`"${x}"`).join(' ');
  const queries=[core,`"${name}" ${[hints.company,hints.school,hints.nickname].filter(Boolean).join(' ')} site:blog.naver.com`, `"${name}" ${hints.nickname||''} (site:instagram.com OR site:facebook.com OR site:threads.net)`, `"${name}" ${hints.nickname||''} (site:tistory.com OR site:brunch.co.kr OR site:youtube.com)`, `"${name}" ${hints.company||''} patent 특허`];
  const jobs=queries.map(q=>duckSearch(q,6).catch(()=>[])); jobs.push(naverSearch(parts.join(' ')).catch(()=>[])); jobs.push(kakaoSearch(parts.join(' ')).catch(()=>[])); jobs.push(crossrefSearch(name,hints,5).catch(()=>[]));
  const gh=githubLookup(hints.github); const batches=await Promise.all(jobs); const github=await gh; const dedupe=new Map();
  for(const r of batches.flat()) if(r.url&&!dedupe.has(r.url))dedupe.set(r.url,r);
  return {input:hints,report:buildReport(hints,[...dedupe.values()],github)};
}
function sendJson(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj));}
function serveStatic(req,res,pathname){let file=pathname==='/'?'/index.html':pathname;file=path.normalize(file).replace(/^\.\.(\/|\\)/,'');const full=path.join(PUBLIC,file);if(!full.startsWith(PUBLIC))return sendJson(res,403,{error:'Forbidden'});fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}const ext=path.extname(full),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-cache':'public, max-age=3600'});res.end(data);});}
const server=http.createServer((req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);if(req.method==='GET'&&u.pathname==='/health')return sendJson(res,200,{ok:true,version:'0.3.0'});if(req.method==='POST'&&u.pathname==='/api/scan'){let body='';req.on('data',c=>{body+=c;if(body.length>MAX_BODY)req.destroy();});req.on('end',async()=>{try{sendJson(res,200,await scan(JSON.parse(body||'{}')));}catch(e){sendJson(res,400,{error:e.message||'검색에 실패했습니다.'});}});return;}if(req.method==='GET')return serveStatic(req,res,u.pathname);res.writeHead(405);res.end('Method not allowed');});
if(require.main===module)server.listen(PORT,()=>console.log(`Footprint listening on ${PORT}`));
module.exports={clean,categoryOf,calcConfidence,keywordProfile,buildReport,extractYear,inferPersona};
