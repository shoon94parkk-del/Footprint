const test=require('node:test');
const assert=require('node:assert/strict');
const {clean,categoryOf,calcConfidence,extractYear,keywordProfile}=require('../server');

test('clean trims and caps',()=>{assert.equal(clean('  abc  ',10),'abc')});
test('categories patent',()=>{assert.equal(categoryOf({url:'https://patents.google.com/patent/X',title:'x',snippet:'x'}),'patent')});
test('confidence rises with company',()=>{const r={url:'https://x.com',title:'SEMES 박상훈',snippet:''};assert.ok(calcConfidence(r,{company:'SEMES'})>calcConfidence(r,{}))});
test('extract year',()=>{assert.equal(extractYear({title:'Published 2024',snippet:''}),2024)});
test('keywords',()=>{assert.ok(keywordProfile([{title:'wafer bonding patent',snippet:''}]).includes('웨이퍼'))});
