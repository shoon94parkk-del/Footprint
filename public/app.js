const extraStyle=document.createElement('link');extraStyle.rel='stylesheet';extraStyle.href='/persona.css';document.head.appendChild(extraStyle);
const $=s=>document.querySelector(s);
const form=$('#scanForm'),hero=$('#hero'),loading=$('#loading'),results=$('#results');
const steps=['이름을 기준으로 각 단서를 OR 조건으로 따로 검색하는 중…','특허·공개 웹·블로그·SNS 후보를 최대한 모으는 중…','회사·학교·이메일·지역·닉네임으로 같은 사람인지 점수화하는 중…','찾은 정보를 직업·관심사·활동 스타일로 재구성하는 중…'];
const labels={social:'공개 SNS',blog:'블로그',community:'카페·커뮤니티',patent:'특허 · 발명',developer:'개발 활동',career:'경력 프로필',academic:'논문 · 연구',news:'기사 · 언론',web:'공개 웹'};
$('#backBtn').onclick=()=>{results.classList.add('hidden');hero.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});};
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function evidenceHtml(r){const h=r.matchedHints||[];return h.length?`<div class="evidence">일치 단서 · ${h.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:'<div class="evidence weak">이름·공개 문맥 기반 후보</div>';}
function groupHtml(key,rows){return `<section class="group"><h4>${labels[key]||key}<small>${rows.length}건</small></h4>${rows.slice(0,14).map(r=>`<article class="trace"><div><b>${esc(r.title)}</b><p>${esc(r.snippet||'공개 검색 결과에서 확인된 흔적입니다.')}</p>${evidenceHtml(r)}</div><div class="trace-meta"><span class="confidence">일치 ${r.confidence}%</span><small class="domain">${esc(r.domain||'source')}</small></div></article>`).join('')}</section>`;}
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
  $('#keywordChips').innerHTML=(r.keywords||[]).map(k=>`<span class="chip">${esc(k)}</span>`).join('')||'<span class="chip">추가 공개 흔적이 필요합니다</span>';
  const order=['patent','career','social','blog','community','academic','news','developer','web'];
  $('#groups').innerHTML=order.filter(k=>r.grouped[k]?.length).map(k=>groupHtml(k,r.grouped[k])).join('')||'<div class="method-note"><b>관련성이 높은 흔적을 충분히 찾지 못했습니다.</b><p>부가정보는 AND 필터가 아니라 OR 검색 단서입니다. 회사·학교·이메일·지역·닉네임 중 하나라도 더 입력하면 검색 범위가 넓어집니다.</p></div>';
  $('#timeline').innerHTML=(r.timeline||[]).map(t=>`<div class="time-item"><b>${t.year}</b><span>${esc(t.title)}</span></div>`).join('')||'<div class="time-item">연도를 식별할 수 있는 공개 흔적이 아직 없습니다.</div>';
}
form.onsubmit=async e=>{
  e.preventDefault();
  const payload=Object.fromEntries(new FormData(form).entries());
  hero.classList.add('hidden');results.classList.add('hidden');loading.classList.remove('hidden');
  let idx=0,pct=12;$('#loadingStep').textContent=steps[0];$('#progressBar').style.width='12%';
  const timer=setInterval(()=>{idx=Math.min(idx+1,steps.length-1);pct=Math.min(pct+20,88);$('#loadingStep').textContent=steps[idx];$('#progressBar').style.width=pct+'%';},1500);
  try{
    const res=await fetch('/api/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'검색 실패');
    clearInterval(timer);$('#progressBar').style.width='100%';render(data);
    setTimeout(()=>{loading.classList.add('hidden');results.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});},220);
  }catch(err){clearInterval(timer);loading.classList.add('hidden');hero.classList.remove('hidden');alert(err.message||'검색에 실패했습니다.');}
};