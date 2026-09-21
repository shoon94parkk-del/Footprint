const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

const read=p=>fs.readFileSync(p,'utf8');

test('durable Footprint project memory preserves privacy and identity contracts',()=>{
  for(const p of ['AGENTS.md','docs/project-memory.md','docs/regression-guardrails.md','docs/decision-log.md']){
    assert.equal(fs.existsSync(p),true,p);
  }
  const memory=read('docs/project-memory.md');
  const guard=read('docs/regression-guardrails.md');
  for(const token of ['selfAudit=yes','OR signals','Matched hint categories','JINA_API_KEY']){
    assert.equal(memory.includes(token),true,token);
  }
  for(const token of ['Do not repurpose','Optional identity hints remain OR','Sensitive inference','Public sources only']){
    assert.equal(guard.includes(token),true,token);
  }
});
