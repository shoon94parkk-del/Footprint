const http=require('http');
const fs=require('fs');
const path=require('path');
const {URL}=require('url');

const PORT=process.env.PORT||10000;
const PUBLIC=path.join(__dirname,'public');
const MAX_BODY=64*1024;

function clean(v,max=160){return String(v||'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,max)}
function decodeHtml(s=''){return String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))}
function strip(s=''){return decodeHtml(String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function domainOf(url=''){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return''}}
function yearOf(r){if(r.year)return r.year;const m=`${r.title||''} ${r.snippet||''}`.match(/\b(20\d{2}|19\d{2})\b/);return m?+m[1]:null}

async function fetchText(url,opts={},timeout=9000){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);
  try{
    const res=await fetch(url,{...opts,signal:c.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7',...(opts.headers||{})}});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);return await res.text();
  }finally{clearTimeout(t)}
}

function parseRss(xml,source='bing'){const out=[];const re=/<item>([\s\S]*?)<\/item>/gi;let m;while((m=re.exec(xml))&&out.length<30){const b=m[1],title=strip((b.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||''),url=decodeHtml((b.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||'').trim(),snippet=strip((b.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]||'');if(/^https?:\/\//i.test(url))out.push({title,url,snippet,source})}return out}
async function bingSearch(q,limit=12){try{const xml=await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss&count=${Math.min(50,limit)}`,{headers:{accept:'application/rss+xml,application/xml,text/xml,*/*'}},8000);return parseRss(xml,'bing').slice(0,limit)}catch{return[]}}

function unwrapDuck(h=''){try{const u=new URL(decodeHtml(h).startsWith('//')?'https:'+decodeHtml(h):decodeHtml(h),'https://duckduckgo.com');const x=u.searchParams.get('uddg');return x?decodeURIComponent(x):u.href}catch{return h}}
async function duckSearch(q,limit=10){try{const html=await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,{},7500);const out=[],re=/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))&&out.length<limit){const url=unwrapDuck(m[1]);if(!/^https?:\/\//.test(url))continue;const tail=html.slice(re.lastIndex,re.lastIndex+2200);const sm=tail.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i);out.push({title:strip(m[2]),url,snippet:sm?strip(sm[1]):'',source:'duck'})}return out}catch{return[]}}

function parseGooglePatentHtml(html){
  const out=[],seen=new Set();
  const re=/<a[^>]+href=["'](\/patent\/([A-Z]{2,4}[A-Z0-9]+)(?:\/[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
  while((m=re.exec(html))&&out.length<80){const id=m[2].toUpperCase();if(seen.has(id))continue;seen.add(id);const title=strip(m[3])||id;const around=strip(html.slice(Math.max(0,m.index-900),Math.min(html.length,re.lastIndex+1400)));out.push({title,url:`https://patents.google.com/patent/${id}/ko`,snippet:around.slice(0,650),source:'google-patents',patentId:id})}
  return out
}
async function googlePatentHtmlSearch(name,company){
  const queries=[];
  if(company)queries.push(`inventor=(${name})&assignee=(${company})`);
  queries.push(`inventor=(${name})`);
  const seen=new Map();
  for(const q of queries){
    const urls=[`https://patents.google.com/?q=${encodeURIComponent(q)}&country=KR&num=100&oq=${encodeURIComponent(q)}`,`https://patents.google.com/?inventor=${encodeURIComponent(name)}${company?`&assignee=${encodeURIComponent(company)}`:''}&country=KR&num=100`];
    for(const u of urls){try{const html=await fetchText(u,{headers:{accept:'text/html,*/*',referer:'https://patents.google.com/'}},11000);for(const r of parseGooglePatentHtml(html))if(!seen.has(r.patentId))seen.set(r.patentId,r)}catch{}}
    if(seen.size>=4)break;
  }
  return [...seen.values()]
}

function patentRelevant(r,name,company){const hay=`${r.title} ${r.snippet}`.toLowerCase();const n=name.toLowerCase(),c=(company||'').toLowerCase();if(r.source==='google-patents'&&(!company||hay.includes(c)||hay.includes(n)))return true;return hay.includes(n)&&(!c||hay.includes(c))}
async function patentSearch(name,company){
  const [direct,bing1,bing2]=await Promise.all([
    googlePatentHtmlSearch(name,company),
    bingSearch(`"${name}" "${company||''}" site:patents.google.com/patent`,25),
    bingSearch(`"${name}" "${company||''}" 특허`,20)
  ]);
  const all=[...direct,...bing1,...bing2].map(r=>({...r,source:r.url.includes('patents.google.com')?'google-patents':r.source}));
  const seen=new Map();for(const r of all){if(!r.url)continue;const m=r.url.match(/\/patent\/([A-Z]{2,4}[A-Z0-9]+)/i);if(m)r.patentId=m[1].toUpperCase();if(patentRelevant(r,name,company)){const k=r.patentId||r.url.replace(/[?#].*$/,'');if(!seen.has(k))seen.set(k,r)}}return [...seen.values()]
}

async function crossrefSearch(name,h){try{const q=[name,h.company,h.school,h.role].filter(Boolean).join(' ');const txt=await fetchText(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=6&select=DOI,title,author,published,URL,publisher`,{headers:{accept:'application/json'}},7000);const j=JSON.parse(txt);return(j.message?.items||[]).map(x=>{const year=x.published?.['date-parts']?.[0]?.[0]||null;const authors=(x.author||[]).map(a=>[a.given,a.family].filter(Boolean).join(' ')).join(', ');return{title:(x.title||[])[0]||'학술 자료',url:x.URL||`https://doi.org/${x.DOI}`,snippet:[authors,x.publisher,year].filter(Boolean).join(' · '),year,source:'academic'}})}catch{return[]}}
async function naverSearch(q){const id=process.env.NAVER_CLIENT_ID,secret=process.env.NAVER_CLIENT_SECRET;if(!id||!secret)return[];const headers={'X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret};const kinds=[['webkr','naver-web'],['blog','naver-blog'],['cafearticle','naver-cafe'],['news','naver-news']];const b=await Promise.all(kinds.map(async([k,s])=>{try{const t=await fetchText(`https://openapi.naver.com/v1/search/${k}.json?query=${encodeURIComponent(q)}&display=10&sort=sim`,{headers},7000);return(JSON.parse(t).items||[]).map(x=>({title:strip(x.title),url:x.link||x.originallink,snippet:strip(x.description),source:s}))}catch{return[]}}));return b.flat()}
async function kakaoSearch(q){const key=process.env.KAKAO_REST_API_KEY;if(!key)return[];const headers={Authorization:`KakaoAK ${key}`};const kinds=[['web','kakao-web'],['blog','kakao-blog'],['cafe','kakao-cafe']];const b=await Promise.all(kinds.map(async([k,s])=>{try{const t=await fetchText(`https://dapi.kakao.com/v2/search/${k}?query=${encodeURIComponent(q)}&size=10&sort=accuracy`,{headers},7000);return(JSON.parse(t).documents||[]).map(x=>({title:strip(x.title),url:x.url,snippet:strip(x.contents),source:s}))}catch{return[]}}));return b.flat()}

function categoryOf(r){const d=domainOf(r.url).toLowerCase(),t=`${r.title||''} ${r.snippet||''}`.toLowerCase();if(r.source==='google-patents'||d.includes('patents.google')||d.includes('kipris')||t.includes('특허')||t.includes('patent'))return'patent';if(/instagram\.com|facebook\.com|threads\.net|youtube\.com|youtu\.be/.test(d))return'social';if(/blog\.naver\.com|tistory\.com|brunch\.co\.kr/.test(d)||/naver-blog|kakao-blog/.test(r.source||''))return'blog';if(/cafe\.naver\.com|cafe\.daum\.net/.test(d)||/naver-cafe|kakao-cafe/.test(r.source||''))return'community';if(d.includes('linkedin.com'))return'career';if(d.includes('github.com'))return'developer';if(r.source==='academic'||d.includes('doi.org'))return'academic';if(/news|기사|뉴스/.test(t)||/naver-news/.test(r.source||''))return'news';return'web'}
function confidence(r,h){const hay=`${r.title||''} ${r.snippet||''} ${r.url||''}`.toLowerCase();let s=20;if(h.name&&hay.includes(h.name.toLowerCase()))s+=30;if(h.company&&hay.includes(h.company.toLowerCase()))s+=25;if(h.school&&hay.includes(h.school.toLowerCase()))s+=12;if(h.role&&hay.includes(h.role.toLowerCase()))s+=10;if(h.region&&hay.includes(h.region.toLowerCase()))s+=6;if(h.nickname&&hay.includes(h.nickname.toLowerCase()))s+=15;if(categoryOf(r)==='patent'&&r.source==='google-patents')s+=22;return Math.min(98,s)}
const INTERESTS=[['기술·엔지니어링',['wafer','bonding','chuck','semiconductor','반도체','엔지니어','설계','장비','특허','patent','기판','본딩','printing','inkjet']],['소프트웨어·AI',['github','developer','software','python','javascript','llm','코딩','개발']],['투자·경제',['주식','투자','etf','stock','finance','경제','부동산']],['여행',['여행','travel','호텔','항공','trip','관광']],['음식·카페',['맛집','카페','coffee','restaurant']],['자동차',['자동차','car','vehicle','드라이브']],['반려동물',['강아지','고양이','반려','dog','cat','pet']],['문화·콘텐츠',['영화','드라마','공연','음악','책','movie','music','book']]];
function inferPersona(rows,h){const text=rows.map(r=>`${r.title} ${r.snippet}`).join(' ').toLowerCase();const interests=INTERESTS.map(([label,terms])=>{const hits=terms.reduce((n,x)=>n+(text.split(x).length-1),0);return{label,hits,confidence:Math.min(94,48+hits*7)}}).filter(x=>x.hits).sort((a,b)=>b.hits-a.hits).slice(0,5);const cats=rows.reduce((m,r)=>(m[categoryOf(r)]=(m[categoryOf(r)]||0)+1,m),{});const styles=[];if((cats.patent||0)+(cats.academic||0)>=2)styles.push({label:'전문성 중심',confidence:Math.min(94,62+((cats.patent||0)+(cats.academic||0))*5),why:'특허·연구 기록이 반복적으로 발견됨'});if((cats.blog||0)+(cats.social||0)>=2)styles.push({label:'기록·공유형',confidence:Math.min(90,56+((cats.blog||0)+(cats.social||0))*5),why:'블로그·SNS 활동이 반복적으로 발견됨'});if(/비교|분석|리뷰|후기|정리|가이드/.test(text))styles.push({label:'분석·비교형',confidence:70,why:'비교·분석형 콘텐츠가 반복됨'});let occupation=h.role||'';if(!occupation&&/wafer|bonding|semiconductor|반도체|엔지니어|설계|장비|특허/.test(text))occupation='기술·엔지니어링 종사 가능성';else if(!occupation&&/developer|software|github|개발자/.test(text))occupation='소프트웨어·개발 종사 가능성';return{occupation:occupation||'직업을 충분히 추정하기 어려움',interests,styles:styles.slice(0,3)}}
function buildReport(h,results){const enriched=results.map(r=>({...r,category:categoryOf(r),confidence:confidence(r,h),domain:domainOf(r.url),year:yearOf(r)}));const likely=enriched.filter(r=>r.confidence>=55||r.source==='google-patents');const cats=[...new Set(likely.map(r=>r.category))],domains=[...new Set(likely.map(r=>r.domain).filter(Boolean))];const hintCount=['company','school','role','region','nickname','social','keyword','ageBand'].filter(k=>h[k]).length;const score=Math.min(96,Math.round(15+likely.length*3+cats.length*6+domains.length*2+hintCount*2));const match=Math.min(97,Math.round(42+hintCount*5+Math.min(likely.length,12)*3));const persona=inferPersona(likely,h),top=persona.interests.slice(0,3).map(x=>x.label),pc=likely.filter(r=>r.category==='patent').length;let narrative=`공개 인터넷에서 ${h.name}과 연결 가능성이 높은 흔적 ${likely.length}건을 찾았습니다.`;if(h.company)narrative+=` ${h.company} 관련 정보와 교차해 동명이인을 줄였습니다.`;if(pc)narrative+=` 발명자·출원인 기준으로 연결되는 특허 흔적 ${pc}건이 확인됩니다.`;if(persona.occupation!=='직업을 충분히 추정하기 어려움')narrative+=` 공개 기록만 보면 ‘${persona.occupation}’이 높습니다.`;if(top.length)narrative+=` 반복되는 관심 주제는 ${top.join(', ')}입니다.`;const grouped={};for(const r of likely.sort((a,b)=>b.confidence-a.confidence))(grouped[r.category]||=[]).push(r);const timeline=likely.filter(r=>r.year).sort((a,b)=>a.year-b.year).slice(0,16).map(r=>({year:r.year,title:r.title,category:r.category,confidence:r.confidence}));return{score,confidence:match,narrative,keywords:top,persona,grouped,timeline,stats:{likely:likely.length,total:enriched.length,domains:domains.length,categories:cats.length,patents:pc},sources:{patents:true,bing:true,naver:Boolean(process.env.NAVER_CLIENT_ID&&process.env.NAVER_CLIENT_SECRET),kakao:Boolean(process.env.KAKAO_REST_API_KEY),publicWeb:true}}}

async function scan(input){if(input.selfAudit!=='yes')throw new Error('본인 또는 본인의 동의를 받은 검색만 이용할 수 있습니다.');const name=clean(input.name,80);if(!name)throw new Error('이름은 필수입니다.');const h={name,ageBand:clean(input.ageBand,20),company:clean(input.company,100),school:clean(input.school,100),role:clean(input.role,100),region:clean(input.region,80),nickname:clean(input.nickname,80),social:clean(input.social,180),github:clean(input.github,50),keyword:clean(input.keyword,100)};const core=[name,h.company,h.school,h.role,h.region,h.nickname].filter(Boolean).join(' ');const strict=[name,h.company].filter(Boolean).map(x=>`"${x}"`).join(' ');const queries=[strict,`${strict} 특허`,`${strict} 엔지니어`,`${strict} site:linkedin.com`,`${strict} site:blog.naver.com OR site:instagram.com OR site:facebook.com`].filter(Boolean);const jobs=[patentSearch(name,h.company),crossrefSearch(name,h),naverSearch(core),kakaoSearch(core)];for(const q of queries){jobs.push(bingSearch(q,12));jobs.push(duckSearch(q,8))}const batches=await Promise.all(jobs.map(p=>Promise.resolve(p).catch(()=>[])));const seen=new Map();for(const r of batches.flat()){if(!r||!r.url)continue;const k=r.patentId?`p:${r.patentId}`:r.url.replace(/[?#].*$/,'');if(!seen.has(k))seen.set(k,r)}return{input:h,report:buildReport(h,[...seen.values()])}}

function sendJson(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj))}
function serveStatic(res,pathname){let file=pathname==='/'?'/index.html':pathname;file=path.normalize(file).replace(/^\.\.(\/|\\)/,'');const full=path.join(PUBLIC,file);if(!full.startsWith(PUBLIC))return sendJson(res,403,{error:'Forbidden'});fs.readFile(full,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}const ext=path.extname(full),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-cache':'public, max-age=120'});res.end(d)})}

const server=http.createServer((req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);if(req.method==='GET'&&u.pathname==='/health')return sendJson(res,200,{ok:true,version:'0.5.0'});if(req.method==='GET'&&u.pathname==='/api/selftest'){scan({selfAudit:'yes',name:'박상훈',company:'세메스'}).then(x=>sendJson(res,200,{ok:x.report.stats.patents>=2,stats:x.report.stats,persona:x.report.persona,patents:(x.report.grouped.patent||[]).slice(0,12).map(r=>({title:r.title,url:r.url,confidence:r.confidence}))})).catch(e=>sendJson(res,500,{ok:false,error:e.message}));return}if(req.method==='POST'&&u.pathname==='/api/scan'){let b='';req.on('data',c=>{b+=c;if(b.length>MAX_BODY)req.destroy()});req.on('end',async()=>{try{sendJson(res,200,await scan(JSON.parse(b||'{}')))}catch(e){sendJson(res,400,{error:e.message||'검색 실패'})}});return}if(req.method==='GET')return serveStatic(res,u.pathname);res.writeHead(405);res.end('Method not allowed')});
if(require.main===module)server.listen(PORT,()=>console.log(`Footprint v0.5 listening on ${PORT}`));
module.exports={clean,parseRss,parseGooglePatentHtml,categoryOf,confidence,inferPersona,buildReport,scan};
