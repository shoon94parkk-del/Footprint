const test=require('node:test');
const assert=require('node:assert/strict');
const {clean,categoryOf,calcConfidence,extractYear,keywordProfile,inferPersona,parsePatentCsv}=require('../server');

test('clean trims and caps',()=>{assert.equal(clean('  abc  ',10),'abc')});
test('categories patent',()=>{assert.equal(categoryOf({url:'https://patents.google.com/patent/X',title:'x',snippet:'x'}),'patent')});
test('categories social',()=>{assert.equal(categoryOf({url:'https://www.instagram.com/example',title:'x',snippet:'x'}),'social')});
test('confidence rises with company',()=>{const r={url:'https://x.com',title:'SEMES 박상훈',snippet:''};assert.ok(calcConfidence(r,{name:'박상훈',company:'SEMES'})>calcConfidence(r,{name:'박상훈'}))});
test('extract year',()=>{assert.equal(extractYear({title:'Published 2024',snippet:''}),2024)});
test('keywords map to broad interest',()=>{assert.ok(keywordProfile([{title:'wafer bonding patent',snippet:''}]).includes('기술·엔지니어링'))});
test('persona finds travel interest',()=>{const p=inferPersona([{title:'제주 여행 호텔 후기',snippet:'맛집 카페 travel'}],{});assert.ok(p.interests.some(x=>x.label==='여행'))});
test('Google Patents CSV keeps matching inventor and assignee',()=>{
  const csv='search URL,https://patents.google.com/\nid,title,assignee,inventor,priority_date,filing_date,publication_date,grant_date,link\nKR20250097390A,Substrate bonding apparatus,세메스 주식회사,박상훈,2023-12-21,2023-12-21,2025-07-02,,https://patents.google.com/patent/KR20250097390A/en\nKR00000000A,Other,다른회사,박상훈,2024-01-01,2024-01-01,2025-01-01,,https://patents.google.com/patent/KR00000000A/en';
  const rows=parsePatentCsv(csv,'박상훈','세메스');
  assert.equal(rows.length,1);assert.equal(rows[0].patentId,'KR20250097390A');assert.equal(rows[0].year,2025);
});