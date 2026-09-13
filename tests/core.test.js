const test=require('node:test');
const assert=require('node:assert/strict');
const {clean,categoryOf,calcConfidence,extractYear,keywordProfile,inferPersona}=require('../server');

test('clean trims and caps',()=>{assert.equal(clean('  abc  ',10),'abc')});
test('categories patent',()=>{assert.equal(categoryOf({url:'https://patents.google.com/patent/X',title:'x',snippet:'x'}),'patent')});
test('categories social',()=>{assert.equal(categoryOf({url:'https://www.instagram.com/example',title:'x',snippet:'x'}),'social')});
test('confidence rises with company',()=>{const r={url:'https://x.com',title:'SEMES 박상훈',snippet:''};assert.ok(calcConfidence(r,{company:'SEMES'})>calcConfidence(r,{}))});
test('extract year',()=>{assert.equal(extractYear({title:'Published 2024',snippet:''}),2024)});
test('keywords map to broad interest',()=>{assert.ok(keywordProfile([{title:'wafer bonding patent',snippet:''}]).includes('기술·엔지니어링'))});
test('persona finds travel interest',()=>{const p=inferPersona([{title:'제주 여행 호텔 후기',snippet:'맛집 카페 travel'}],{});assert.ok(p.interests.some(x=>x.label==='여행'))});
