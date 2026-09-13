async function req(url,opts={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{const r=await fetch(url,{...opts,signal:c.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36','accept-language':'ko-KR,ko;q=0.9,en;q=0.7',...(opts.headers||{})}});return{status:r.status,url:r.url,text:await r.text()}}finally{clearTimeout(t)}}
function compact(s=''){return String(s||'').replace(/\s+/g,' ').slice(0,7000)}
(async()=>{
 const body=new URLSearchParams({searchKeyword:'박상훈',searchGubun:'0002',searchCondition:'patent',mainSrchFlag:'main'}).toString();
 const r=await req('https://scienceon.kisti.re.kr/srch/selectPORSrchTotal.do',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 const html=r.text;
 const keys=['filter_wrap','filterFlag','발명자','출원인','inventor','applicant','assignee','fn_filter','filterAjax','searchField','fieldName','facet','selectPORSrchPatentListAjax','PORSrchPatentListAjax','selectFilter'];
 for(const key of keys){let from=0,n=0;while((from=html.indexOf(key,from))>=0&&n<8){console.log('[FILTER-CODE]',key,n,compact(html.slice(Math.max(0,from-2200),from+4500)));from+=key.length;n++}}
 for(const m of html.matchAll(/\$\.ajax\(\{[\s\S]{0,2500}?\}\);/g)){const s=m[0];if(/filter|facet|patent|srch/i.test(s))console.log('[FILTER-AJAX]',compact(s))}
 const js=await req('https://scienceon.kisti.re.kr/newUI/js/common-srch.js');
 console.log('[FILTER-JS-STATUS]',JSON.stringify({status:js.status,len:js.text.length}));
 for(const key of ['filter','facet','발명자','출원인','searchCondition','filterFlag']){let from=0,n=0;while((from=js.text.indexOf(key,from))>=0&&n<8){console.log('[FILTER-JS]',key,n,compact(js.text.slice(Math.max(0,from-1800),from+3800)));from+=key.length;n++}}
})().catch(e=>console.error('[FILTER-ERR]',e.stack||e));