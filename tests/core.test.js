const test=require('node:test');
const assert=require('node:assert/strict');
const {clean,parseRss,parseGooglePatentHtml,categoryOf,confidence,inferPersona,buildReport}=require('../server2');

test('clean trims and caps',()=>{assert.equal(clean('  abc  ',10),'abc')});
test('rss parser extracts items',()=>{const xml='<rss><channel><item><title>A</title><link>https://example.com/x</link><description>hello</description></item></channel></rss>';const r=parseRss(xml);assert.equal(r.length,1);assert.equal(r[0].title,'A')});
test('google patent html parser extracts patent id',()=>{const html='<a href="/patent/KR20250097390A/ko">Substrate bonding apparatus</a>';const r=parseGooglePatentHtml(html);assert.equal(r.length,1);assert.equal(r[0].patentId,'KR20250097390A')});
test('categories patent',()=>{assert.equal(categoryOf({url:'https://patents.google.com/patent/KR1',title:'x',snippet:'x',source:'google-patents'}),'patent')});
test('categories social',()=>{assert.equal(categoryOf({url:'https://www.instagram.com/example',title:'x',snippet:'x'}),'social')});
test('confidence rises with company',()=>{const r={url:'https://x.com',title:'세메스 박상훈',snippet:''};assert.ok(confidence(r,{name:'박상훈',company:'세메스'})>confidence(r,{name:'박상훈'}))});
test('persona finds engineering from patents',()=>{const p=inferPersona([{url:'https://patents.google.com/patent/KR1',title:'wafer bonding chuck',snippet:'반도체 장비 특허',source:'google-patents'}],{});assert.ok(p.interests.some(x=>x.label==='기술·엔지니어링'))});
test('report keeps verified patent even with sparse snippet',()=>{const r=buildReport({name:'박상훈',company:'세메스'},[{url:'https://patents.google.com/patent/KR20250097390A/ko',title:'기판 본딩 장치',snippet:'박상훈 세메스 주식회사',source:'google-patents',patentId:'KR20250097390A',year:2025}]);assert.equal(r.stats.patents,1);assert.ok(r.grouped.patent.length===1)});