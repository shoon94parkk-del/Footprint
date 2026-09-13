const test=require('node:test');
const assert=require('node:assert/strict');
const {clean,parseNaverHtml,categoryOf,confidence,inferPersona,buildReport}=require('../server3');

test('clean trims and caps',()=>{assert.equal(clean('  abc  ',10),'abc')});
test('naver html parser extracts external link',()=>{const html='<div>박상훈 세메스 특허 <a href="https://scienceon.kisti.re.kr/srch/selectPORSrchPatent.do?cn=KOR1">[특허]기판 본딩 장치</a></div>';const r=parseNaverHtml(html,'"박상훈" "세메스" 특허');assert.equal(r.length,1);assert.ok(r[0].url.includes('scienceon.kisti.re.kr'))});
test('categories patent from ScienceON',()=>{assert.equal(categoryOf({url:'https://scienceon.kisti.re.kr/srch/selectPORSrchPatent.do?cn=KOR1',title:'특허',snippet:'발명자 박상훈 출원인 세메스',source:'scienceon-patent'}),'patent')});
test('categories social',()=>{assert.equal(categoryOf({url:'https://www.instagram.com/example',title:'x',snippet:'x'}),'social')});
test('confidence rises with exact name and company',()=>{const r={url:'https://scienceon.kisti.re.kr/x',title:'기판 장치',snippet:'발명자 박상훈 출원인 세메스 주식회사',source:'scienceon-patent',sourceQuery:'"박상훈" "세메스"'};assert.ok(confidence(r,{name:'박상훈',company:'세메스'})>=90)});
test('persona finds engineering from patents',()=>{const p=inferPersona([{url:'https://scienceon.kisti.re.kr/x',title:'wafer bonding chuck',snippet:'반도체 장비 특허',source:'scienceon-patent'}],{});assert.ok(p.interests.some(x=>x.label==='기술·엔지니어링'))});
test('report keeps verified patent',()=>{const r=buildReport({name:'박상훈',company:'세메스'},[{url:'https://scienceon.kisti.re.kr/x',title:'기판 본딩 장치',snippet:'박상훈 세메스 주식회사 특허',source:'scienceon-patent',sourceQuery:'"박상훈" "세메스"',year:2025}]);assert.equal(r.stats.patents,1);assert.ok(r.grouped.patent.length===1)});