async function run(){
  const prompt='공개 웹에서 박상훈과 세메스(SEMES)가 동일 인물로 연결되는 근거를 조사해 주세요. 특허뿐 아니라 LinkedIn, 경력 프로필, 일반 웹 문서도 찾아주세요. 동명이인은 제외하고, 실제로 이름과 세메스/SEMES가 함께 연결되는 근거만 사용하세요. 각 근거의 제목과 URL을 포함하고, 확인 가능한 사실과 추정을 구분하세요.';
  const body={messages:[{role:'user',content:prompt}],stream:false,reasoning_effort:'low',no_direct_answer:false,team_size:1,language_code:'ko',search_language_code:'ko'};
  const c=new AbortController(),t=setTimeout(()=>c.abort(),90000);
  try{
    const r=await fetch('https://deepsearch.jina.ai/v1/chat/completions',{method:'POST',signal:c.signal,headers:{'content-type':'application/json','user-agent':'Footprint-self-audit/0.8'},body:JSON.stringify(body)});
    const text=await r.text();
    console.log('[DEEPBENCH]',JSON.stringify({status:r.status,type:r.headers.get('content-type'),bytes:text.length,body:text.slice(0,30000)}));
  }catch(e){console.log('[DEEPBENCH]',JSON.stringify({error:e.name+': '+e.message}))}
  finally{clearTimeout(t)}
}
run();
