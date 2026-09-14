const test=require('node:test');
const assert=require('node:assert/strict');
const {buildOrQueries,scoreCandidate,matchedHints}=require('../server4');

test('optional hints become independent OR queries',()=>{
  const q=buildOrQueries({name:'박상훈',company:'세메스',school:'동양미래대학교',email:'park@example.com',region:'서울'});
  assert.ok(q.some(x=>x.includes('박상훈')&&x.includes('세메스')));
  assert.ok(q.some(x=>x.includes('박상훈')&&x.includes('동양미래대학교')&&!x.includes('세메스')));
  assert.ok(q.some(x=>x.includes('park@example.com')));
  assert.ok(q.some(x=>x.includes('박상훈')&&x.includes('서울')&&!x.includes('세메스')));
});

test('one strong optional hint can qualify without other hints',()=>{
  const h={name:'박상훈',company:'세메스',school:'동양미래대학교',email:'park@example.com',region:'서울'};
  const companyOnly={url:'https://example.com/a',title:'박상훈 - SEMES engineer',snippet:'SEMES에서 근무'};
  const schoolOnly={url:'https://example.com/b',title:'박상훈 동양미래대학교',snippet:'동문 소개'};
  const emailOnly={url:'https://example.com/c',title:'Profile',snippet:'park@example.com'};
  assert.ok(scoreCandidate(companyOnly,h)>=52);
  assert.ok(scoreCandidate(schoolOnly,h)>=52);
  assert.ok(scoreCandidate(emailOnly,h)>=52);
  assert.deepEqual(matchedHints(companyOnly,h),['회사']);
});