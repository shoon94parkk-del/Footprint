const {spawn}=require('child_process');
const {scan}=require('./server4');

const child=spawn(process.execPath,['server4.js'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
spawn(process.execPath,['debug-scienceon.js'],{stdio:'inherit'});

setTimeout(async()=>{
  const started=Date.now();
  try{
    const r=await scan({selfAudit:'yes',name:'박상훈',company:'세메스'});
    const patents=(r.report.grouped.patent||[]).slice(0,20);
    console.log('[SELFTEST] semes-park',JSON.stringify({ok:patents.length>=4,ms:Date.now()-started,stats:r.report.stats,occupation:r.report.persona.occupation,titles:patents.map(x=>x.title)}));
  }catch(e){console.error('[SELFTEST] semes-park failed',e&&e.stack||e)}
},1200);
