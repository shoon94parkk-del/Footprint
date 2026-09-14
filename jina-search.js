'use strict';

function clean(v=''){return String(v||'').trim()}
function aliases(company=''){
  const raw=clean(company),c=raw.replace(/\s+/g,'').toLowerCase(),out=new Set(raw?[raw]:[]);
  if(c==='세메스'||c==='semes'){out.add('세메스');out.add('SEMES')}
  if(c==='삼성전자'||c==='samsungelectronics'){out.add('삼성전자');out.add('Samsung Electronics')}
  if(c==='sk하이닉스'||c==='에스케이하이닉스'||c==='skhynix'){out.add('SK하이닉스');out.add('SK hynix')}
  if(c==='네이버'||c==='naver')out.add('NAVER')
  if(c==='카카오'||c==='kakao')out.add('Kakao')
  return [...out].filter(Boolean)
}
function quote(s=''){return `"${clean(s).replace(/["\\]/g,' ')}"`}
function buildQueries(h){
  const name=clean(h.name),out=new Set();
  if(!name)return[];
  out.add(quote(name));
  const add=(value,suffix='')=>{value=clean(value);if(!value)return;out.add(`${quote(name)} ${quote(value)}${suffix?` ${suffix}`:''}`)};
  for(const c of aliases(h.company)){add(c);add(c,'LinkedIn 경력 프로필');add(c,'특허 발명자')}
  add(h.school);if(h.school)add(h.school,'LinkedIn');
  add(h.role);add(h.region);add(h.nickname);
  if(h.nickname){add(h.nickname,'Instagram Facebook');add(h.nickname,'네이버 블로그')}
  add(h.keyword);
  if(h.email){out.add(quote(h.email));add(h.email)}
  if(h.social){out.add(quote(h.social));add(h.social)}
  if(h.github){out.add(quote(h.github));add(h.github,'GitHub')}
  return [...out].filter(Boolean).slice(0,12)
}
function normalizeItem(x,q){
  const url=clean(x?.url||x?.link),title=clean(x?.title||x?.name||'공개 웹 결과');
  if(!/^https?:\/\//i.test(url))return null;
  const content=clean(x?.content||x?.description||x?.snippet||x?.text).replace(/\s+/g,' ');
  const published=clean(x?.publishedTime||x?.published_time||x?.timestamp||x?.date);
  const year=(published.match(/\b(20\d{2}|19\d{2})\b/)||content.match(/\b(20\d{2}|19\d{2})\b/))?.[1];
  return {title:title.slice(0,320),url,snippet:content.slice(0,5000),source:'jina-search',sourceQuery:q,year:year?Number(year):null}
}
function extractItems(json){
  if(Array.isArray(json))return json;
  if(Array.isArray(json?.data))return json.data;
  if(Array.isArray(json?.results))return json.results;
  if(Array.isArray(json?.items))return json.items;
  if(json?.data&&typeof json.data==='object')return [json.data];
  return []
}
async function oneSearch(query,key){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),18000);
  try{
    const r=await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`,{signal:c.signal,redirect:'follow',headers:{authorization:`Bearer ${key}`,accept:'application/json','x-locale':'ko-KR','user-agent':'Footprint-Self-Audit/1.0',dnt:'1'}});
    if(!r.ok)throw new Error(`Jina Search HTTP ${r.status}`);
    const json=JSON.parse(await r.text());
    return extractItems(json).map(x=>normalizeItem(x,query)).filter(Boolean)
  }finally{clearTimeout(t)}
}
async function search(h){
  const key=clean(process.env.JINA_API_KEY);
  if(!key)return {rows:[],enabled:false,error:null,queries:[]};
  const queries=buildQueries(h),rows=[];let error=null;
  for(let i=0;i<queries.length;i+=4){const settled=await Promise.allSettled(queries.slice(i,i+4).map(q=>oneSearch(q,key)));for(const x of settled){if(x.status==='fulfilled')rows.push(...x.value);else error=String(x.reason?.message||x.reason)}}
  const seen=new Map();for(const r of rows){const k=r.url.replace(/[?#].*$/,'');if(!seen.has(k))seen.set(k,r)}
  return {rows:[...seen.values()],enabled:true,error,queries}
}
module.exports={search,buildQueries,aliases,extractItems,normalizeItem};
