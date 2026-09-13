const $ = s => document.querySelector(s);
const form = $('#scanForm');
const hero = $('#hero');
const loading = $('#loading');
const results = $('#results');
const optional = $('#optional');
const steps = ['이름이 등장하는 공개 흔적을 찾는 중…','회사·학교·직무 힌트로 동명이인을 분리하는 중…','특허·논문·개발 활동을 교차 확인하는 중…','발견된 정보를 하나의 프로필로 재구성하는 중…'];
const labels = {patent:'특허 · 발명',developer:'개발 활동',career:'경력 프로필',academic:'논문 · 연구',news:'기사 · 언론',web:'공개 웹'};

$('#moreBtn').onclick = () => optional.classList.toggle('hidden');
$('#backBtn').onclick = () => { results.classList.add('hidden'); hero.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); };
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function groupHtml(key, rows){
  return `<section class="group"><h4>${labels[key]||key}<small>${rows.length}건</small></h4>${rows.slice(0,8).map(r=>`<article class="trace"><div><b>${esc(r.title)}</b><p>${esc(r.snippet||'공개 검색 결과에서 확인된 흔적입니다.')}</p></div><div class="trace-meta"><span class="confidence">일치 ${r.confidence}%</span><small class="domain">${esc(r.domain||'source')}</small></div></article>`).join('')}</section>`;
}
function render(data){
  const r=data.report;
  $('#personName').textContent=data.input.name;
  $('#narrative').textContent=r.narrative;
  $('#score').textContent=r.score;
  $('#scoreRing').style.setProperty('--score',`${r.score}%`);
  $('#confidence').textContent=`${r.confidence}%`;
  $('#foundCount').textContent=`${r.stats.likely}건`;
  $('#categoryCount').textContent=`${r.stats.categories}개`;
  $('#domainCount').textContent=`${r.stats.domains}개`;
  $('#keywordChips').innerHTML=(r.keywords||[]).map(k=>`<span class="chip">${esc(k)}</span>`).join('') || '<span class="chip">뚜렷한 반복 주제가 아직 없습니다</span>';
  const order=['patent','career','developer','academic','news','web'];
  $('#groups').innerHTML=order.filter(k=>r.grouped[k]?.length).map(k=>groupHtml(k,r.grouped[k])).join('') || '<div class="method-note"><b>관련성이 높은 흔적을 충분히 찾지 못했습니다.</b><p>회사·학교·직무·GitHub ID 같은 선택 정보를 한두 개 추가하면 동명이인 결과를 줄일 수 있습니다.</p></div>';
  $('#timeline').innerHTML=(r.timeline||[]).map(t=>`<div class="time-item"><b>${t.year}</b><span>${esc(t.title)}</span></div>`).join('') || '<div class="time-item">연도를 식별할 수 있는 흔적이 아직 없습니다.</div>';
}
form.onsubmit=async e=>{
  e.preventDefault();
  const payload=Object.fromEntries(new FormData(form).entries());
  hero.classList.add('hidden'); results.classList.add('hidden'); loading.classList.remove('hidden');
  let idx=0,pct=14; $('#loadingStep').textContent=steps[0]; $('#progressBar').style.width='14%';
  const timer=setInterval(()=>{idx=Math.min(idx+1,steps.length-1);pct=Math.min(pct+21,88);$('#loadingStep').textContent=steps[idx];$('#progressBar').style.width=pct+'%';},1200);
  try{
    const res=await fetch('/api/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json(); if(!res.ok) throw new Error(data.error||'검색 실패');
    clearInterval(timer); $('#progressBar').style.width='100%'; render(data);
    setTimeout(()=>{loading.classList.add('hidden');results.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});},250);
  }catch(err){clearInterval(timer);loading.classList.add('hidden');hero.classList.remove('hidden');alert(err.message||'검색에 실패했습니다.');}
};
