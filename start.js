const {spawn}=require('child_process');
const {scan}=require('./server4');

const child=spawn(process.execPath,['server4.js'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
spawn(process.execPath,['debug-filter.js'],{stdio:'inherit'});

setTimeout(async()=>{
  const started=Date.now();
  try{
    const r=await scan({selfAudit:'yes',name:'박상훈',company:'세메스'});
    const grouped=r.report.grouped||{};
    const patents=(grouped.patent||[]).slice(0,20);
    const publicRows=['web','blog','news','community','career','social','academic','developer']
      .flatMap(category=>(grouped[category]||[]).slice(0,20).map(x=>({category,title:x.title,url:x.url,domain:x.domain,confidence:x.confidence,source:x.source,sourceQuery:x.sourceQuery,snippet:String(x.snippet||'').slice(0,280)})))
      .sort((a,b)=>(b.confidence||0)-(a.confidence||0))
      .slice(0,50);
    console.log('[SELFTEST] semes-park',JSON.stringify({ok:patents.length>=4,ms:Date.now()-started,stats:r.report.stats,occupation:r.report.persona.occupation,patents:patents.map(x=>({title:x.title,url:x.url,confidence:x.confidence})),publicRows}));
  }catch(e){console.error('[SELFTEST] semes-park failed',e&&e.stack||e)}
},1200);
