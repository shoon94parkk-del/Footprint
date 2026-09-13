const $=s=>document.querySelector(s);
const form=$('#scanForm'),hero=$('#hero'),loading=$('#loading'),results=$('#results'),optional=$('#optional');
const steps=['이름이 등장하는 공개 흔적을 찾는 중…','네이버·블로그·공개 SNS 흔적을 확인하는 중…','동명이인을 회사·학교·지역·닉네임으로 분리하는 중…','관심사와 온라인 활동 스타일을 재구성하는 중…'];
const labels={social:'공개 SNS',blog:'블로그',community:'카페·커뮤니티',patent:'특허 · 발명',developer:'개발 활동',career:'경력 프로필',academic:'논문 · 연구',news:'기사 · 언론',web:'공개 웹'};
$('#moreBtn').onclick=()=>optional.classList.toggle('hidden');
$('#backBtn').onclick=()=>{results.classList.add('hidden');hero.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});};
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function groupHtml(key,rows){return `<section class="group"><h4>${labels[key]||key}<small>${rows.length}건</small></h4>${rows.slice(0,8).map(r=>`<article class="trace"><div><b>${esc(r.title)}</b><p>${esc(r.snippet||'공개 검색 결과에서 확인된 흔적입니다.')}</p></div><div class="trace-meta"><span class="confidence">일치 ${r.confidence}%</span><small class="domain">${esc(r.domain||'source')}</small></div></article>`).join('')}</section>`;}
function personaRows(rows,empty){return rows?.length?rows.map(x=>`<div class="persona-row"><b>${esc(x.label)}</b><span>${x.confidence}%</span>${x.why?`<small>${esc(x.why)}</small>`:''}</div>`).join(''):`<small class="empty">${empty}</small>`;}
function render(data){
  const r=data.report,p=r.persona||{};
  $('#personName').textContent=data.input.name;
  $('#narrative').textContent=r.narrative;
  $('#score').textContent=r.score;
  $('#scoreRing').style.setProperty('--score',`${r.score}%`);
  $('#confidence').textContent=`${r.confidence}%`;
  $('#foundCount').textContent=`${r.stats.likely}건`;
  $('#categoryCount').textContent=`${r.stats.categories}개`;
  $('#domainCount').textContent=`${r.stats.domains}개`;
  $('#occupation').textContent=p.occupation||'충분히 추정하기 어려움';
  $('#interestList').innerHTML=personaRows(p.interests,'뚜렷한 관심사를 아직 찾지 못했습니다.');
  $('#styleList').innerHTML=personaRows(p.styles,'공개 활동 스타일을 충분히 판단하기 어렵습니다.');
  $('#keywordChips').innerHTML=(r.keywords||[]).map(k=>`<span class="chip">${esc(k)}</span>`).join('')||'<span class="chip">추가 힌트를 넣으면 더 정확해집니다</span>';
  const order=['social','blog','community','patent','career','developer','academic','news','web'];
  $('#groups').innerHTML=order.filter(k=>r.grouped[k]?.length).map(k=>groupHtml(k,r.grouped[k])).join('')||'<div class="method-note"><b>관련성이 높은 흔적을 충분히 찾지 못했습니다.</b><p>지역·학교·직장·닉네임 중 한두 개를 추가하면 동명이인을 크게 줄일 수 있습니다.</p></div>';
  $('#timeline').innerHTML=(r.timeline||[]).map(t=>`<div class="time-item"><b>${t.year}</b><span>${esc(t.title)}</span></div>`).join('')||'<div class="time-item">연도를 식별할 수 있는 공개 흔적이 아직 없습니다.</div>';
}
form.onsubmit=async e=>{
  e.preventDefault();
  const payload=Object.fromEntries(new FormData(form).entries());
  hero.classList.add('hidden');results.classList.add('hidden');loading.classList.remove('hidden');
  let idx=0,pct=12;$('#loadingStep').textContent=steps[0];$('#progressBar').style.width='12%';
  const timer=setInterval(()=>{idx=Math.min(idx+1,steps.length-1);pct=Math.min(pct+22,88);$('#loadingStep').textContent=steps[idx];$('#progressBar').style.width=pct+'%';},1100);
  try{
    const res=await fetch('/api/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'검색 실패');
    clearInterval(timer);$('#progressBar').style.width='100%';render(data);
    setTimeout(()=>{loading.classList.add('hidden');results.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});},250);
  }catch(err){clearInterval(timer);loading.classList.add('hidden');hero.classList.remove('hidden');alert(err.message||'검색에 실패했습니다.');}
};
