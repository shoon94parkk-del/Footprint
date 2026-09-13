const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_BODY = 64 * 1024;

function clean(v, max = 120) {
  return String(v || '').trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
}
function htmlDecode(s = '') {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function stripTags(s = '') {
  return htmlDecode(String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim());
}
function unwrapDuckUrl(href = '') {
  const decoded = htmlDecode(href);
  try {
    const u = new URL(decoded.startsWith('//') ? 'https:' + decoded : decoded, 'https://duckduckgo.com');
    const x = u.searchParams.get('uddg');
    return x ? decodeURIComponent(x) : u.href;
  } catch { return decoded; }
}
async function fetchText(url, opts = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FootprintSelfAudit/0.4)',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.7',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

function parseCsv(text = '') {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const src = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

async function googlePatentCsv(rawInner) {
  const url = `https://patents.google.com/xhr/query?url=${encodeURIComponent(rawInner)}&exp=&download=true`;
  return await fetchText(url, { headers: { accept: 'text/csv,text/plain,*/*', referer: 'https://patents.google.com/' } }, 12000);
}
function parsePatentCsv(text, name, company) {
  const rows = parseCsv(text); const out = [];
  for (const row of rows) {
    if (!row || row.length < 4) continue;
    const first = clean(row[0], 100);
    if (!first || /^search URL/i.test(first) || /^id$/i.test(first)) continue;
    const id = first.replace(/\s+/g, '');
    if (!/^[A-Z]{2,4}[A-Z0-9]+$/i.test(id)) continue;
    const title = clean(row[1], 300) || id;
    const assignee = clean(row[2], 300);
    const inventor = clean(row[3], 300);
    if (name && !inventor.includes(name)) continue;
    if (company && !assignee.toLowerCase().includes(company.toLowerCase())) continue;
    const priority = clean(row[4], 40), filing = clean(row[5], 40), publication = clean(row[6], 40), grant = clean(row[7], 40);
    const link = clean(row[8], 500);
    const url = /^https?:\/\//i.test(link) ? link : `https://patents.google.com/patent/${encodeURIComponent(id)}/ko`;
    const yearText = publication || filing || priority || grant;
    const ym = yearText.match(/(19\d{2}|20\d{2})/);
    out.push({
      title,
      url,
      snippet: [`발명자 ${inventor}`, assignee && `출원인 ${assignee}`, publication && `공개 ${publication}`].filter(Boolean).join(' · '),
      source: 'google-patents',
      year: ym ? Number(ym[1]) : null,
      patentId: id
    });
  }
  return out;
}
async function patentSearch(name, company, limit = 50) {
  const rawQueries = [];
  if (company) rawQueries.push(`inventor=${name}&assignee=${company}&num=${limit}`);
  rawQueries.push(`inventor=${name}&num=${limit}`);
  if (company) rawQueries.push(`q=inventor:"${name}" assignee:"${company}"&num=${limit}`);
  const seen = new Map();
  for (const q of rawQueries) {
    try {
      const text = await googlePatentCsv(q);
      const rows = parsePatentCsv(text, name, company);
      for (const r of rows) if (!seen.has(r.patentId)) seen.set(r.patentId, r);
      if (seen.size >= 3) break;
    } catch { /* source can rate-limit; continue to fallback query */ }
  }
  return [...seen.values()].slice(0, limit);
}

function parseDuckHtml(html, limit = 8) {
  const out = [];
  const re = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const url = unwrapDuckUrl(m[1]); if (!/^https?:\/\//i.test(url)) continue;
    const tail = html.slice(re.lastIndex, Math.min(html.length, re.lastIndex + 2600));
    const sm = tail.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    out.push({ title: stripTags(m[2]), url, snippet: sm ? stripTags(sm[1]) : '', source: 'web' });
  }
  return out;
}
function parseDuckLite(html, limit = 8) {
  const out = [];
  const re = /<a[^>]+(?:class=["']result-link["']|rel=["']nofollow["'])[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const url = unwrapDuckUrl(m[1]); if (!/^https?:\/\//i.test(url)) continue;
    const tail = html.slice(re.lastIndex, Math.min(html.length, re.lastIndex + 1800));
    const sm = tail.match(/class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/i);
    out.push({ title: stripTags(m[2]), url, snippet: sm ? stripTags(sm[1]) : '', source: 'web' });
  }
  return out;
}
async function duckSearch(query, limit = 8) {
  try {
    const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const rows = parseDuckHtml(html, limit); if (rows.length) return rows;
  } catch { /* try lite */ }
  try {
    const html = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`);
    return parseDuckLite(html, limit);
  } catch { return []; }
}
async function crossrefSearch(name, hints, limit = 5) {
  const q = [name, hints.company, hints.school, hints.role].filter(Boolean).join(' ');
  try {
    const text = await fetchText(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${limit}&select=DOI,title,author,published,URL,publisher`, { headers: { accept: 'application/json' } });
    const json = JSON.parse(text);
    return (json.message?.items || []).map(item => {
      const year = item.published?.['date-parts']?.[0]?.[0] || null;
      const authors = (item.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ')).join(', ');
      return { title: (item.title || [])[0] || '학술 자료', url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''), snippet: [authors, item.publisher, year].filter(Boolean).join(' · '), year, source: 'academic' };
    }).filter(x => x.url);
  } catch { return []; }
}
async function naverSearch(query) {
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET; if (!id || !secret) return [];
  const headers = { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret };
  const kinds = [['webkr', 'naver-web'], ['blog', 'naver-blog'], ['cafearticle', 'naver-cafe'], ['news', 'naver-news']];
  const batches = await Promise.all(kinds.map(async ([kind, source]) => {
    try {
      const t = await fetchText(`https://openapi.naver.com/v1/search/${kind}.json?query=${encodeURIComponent(query)}&display=10&sort=sim`, { headers });
      const j = JSON.parse(t); return (j.items || []).map(x => ({ title: stripTags(x.title || ''), url: x.link || x.originallink || '', snippet: stripTags(x.description || ''), source }));
    } catch { return []; }
  }));
  return batches.flat().filter(x => x.url);
}
async function kakaoSearch(query) {
  const key = process.env.KAKAO_REST_API_KEY; if (!key) return [];
  const headers = { Authorization: `KakaoAK ${key}` }; const kinds = [['web', 'kakao-web'], ['blog', 'kakao-blog'], ['cafe', 'kakao-cafe']];
  const batches = await Promise.all(kinds.map(async ([kind, source]) => {
    try {
      const t = await fetchText(`https://dapi.kakao.com/v2/search/${kind}?query=${encodeURIComponent(query)}&size=10&sort=accuracy`, { headers });
      const j = JSON.parse(t); return (j.documents || []).map(x => ({ title: stripTags(x.title || ''), url: x.url || '', snippet: stripTags(x.contents || ''), source }));
    } catch { return []; }
  }));
  return batches.flat().filter(x => x.url);
}
async function githubLookup(username) {
  if (!username) return null; const safe = username.replace(/^@/, '').trim(); if (!/^[A-Za-z0-9-]{1,39}$/.test(safe)) return null;
  try {
    const [u, r] = await Promise.all([
      fetchText(`https://api.github.com/users/${encodeURIComponent(safe)}`, { headers: { accept: 'application/vnd.github+json' } }),
      fetchText(`https://api.github.com/users/${encodeURIComponent(safe)}/repos?sort=updated&per_page=6`, { headers: { accept: 'application/vnd.github+json' } })
    ]);
    const user = JSON.parse(u), repos = JSON.parse(r);
    return { user: { login: user.login, name: user.name, bio: user.bio, company: user.company, location: user.location, html_url: user.html_url, public_repos: user.public_repos, created_at: user.created_at }, repos: Array.isArray(repos) ? repos : [] };
  } catch { return null; }
}
function domainOf(url = '') { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function categoryOf(r) {
  const d = domainOf(r.url).toLowerCase(), t = `${r.title} ${r.snippet}`.toLowerCase();
  if (r.source === 'google-patents' || d.includes('patents.google') || d.includes('kipris') || t.includes('patent') || t.includes('특허')) return 'patent';
  if (/instagram\.com|facebook\.com|threads\.net|youtube\.com|youtu\.be/.test(d)) return 'social';
  if (/blog\.naver\.com|tistory\.com|brunch\.co\.kr|post\.naver\.com/.test(d) || /naver-blog|kakao-blog/.test(r.source || '')) return 'blog';
  if (/cafe\.naver\.com|cafe\.daum\.net/.test(d) || /naver-cafe|kakao-cafe/.test(r.source || '')) return 'community';
  if (d.includes('github.com')) return 'developer';
  if (d.includes('linkedin.com')) return 'career';
  if (r.source === 'academic' || d.includes('doi.org') || d.includes('researchgate') || d.includes('orcid')) return 'academic';
  if (/news|newspaper|press|기사|뉴스/.test(t) || /naver-news/.test(r.source || '')) return 'news';
  return 'web';
}
function calcConfidence(r, hints) {
  const hay = `${r.title} ${r.snippet} ${r.url}`.toLowerCase(); let s = 20;
  if (hints.name && hay.includes(hints.name.toLowerCase())) s += 28;
  const checks = [[hints.company, 22], [hints.school, 16], [hints.role, 12], [hints.region, 7], [hints.nickname, 18], [hints.social, 20], [hints.keyword, 10]];
  for (const [v, pts] of checks) if (v && hay.includes(v.toLowerCase())) s += pts;
  if (r.source === 'google-patents') s += 12;
  if (categoryOf(r) === 'social' && hints.nickname) s += 7;
  return Math.min(96, s);
}
function extractYear(r) {
  if (r.year) return r.year;
  const ys = [...`${r.title} ${r.snippet}`.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => Number(m[1])).filter(y => y >= 1980 && y <= 2035);
  return ys[0] || null;
}
const INTERESTS = [
  ['기술·엔지니어링', ['wafer', 'bonding', 'chuck', 'semiconductor', '반도체', '엔지니어', 'engineering', '설계', '장비', '특허', 'patent', '기판', '본딩']],
  ['소프트웨어·AI', ['github', 'developer', 'software', 'python', 'javascript', ' ai ', 'llm', '코딩', '개발']],
  ['투자·경제', ['주식', '투자', '증시', 'etf', 'stock', 'finance', '경제', '부동산']],
  ['여행', ['여행', 'travel', '호텔', '항공', 'trip', '관광']],
  ['사진·디자인', ['사진', 'photography', 'camera', 'design', '디자인', '전시']],
  ['스포츠·운동', ['운동', '헬스', '러닝', '축구', '야구', '골프', 'fitness', 'running']],
  ['음식·카페', ['맛집', '카페', 'coffee', '요리', '레시피', 'restaurant']],
  ['자동차', ['자동차', '차량', 'car', 'vehicle', '드라이브']],
  ['반려동물', ['강아지', '고양이', '반려', 'dog', 'cat', 'pet']],
  ['문화·콘텐츠', ['영화', '드라마', '공연', '음악', '책', 'movie', 'music', 'book']]
];
function inferPersona(results, hints = {}) {
  const text = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  const interests = INTERESTS.map(([label, terms]) => {
    const hits = terms.reduce((n, x) => n + (text.split(x).length - 1), 0);
    return { label, hits, confidence: Math.min(94, 46 + hits * 8) };
  }).filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 5);
  const cats = results.reduce((m, r) => { const c = categoryOf(r); m[c] = (m[c] || 0) + 1; return m; }, {});
  const styles = [];
  if ((cats.patent || 0) + (cats.academic || 0) >= 2) styles.push({ label: '전문성 중심', confidence: Math.min(92, 58 + ((cats.patent || 0) + (cats.academic || 0)) * 6), why: '특허·연구 자료가 반복적으로 발견됨' });
  if ((cats.blog || 0) + (cats.social || 0) >= 2) styles.push({ label: '기록·공유형', confidence: Math.min(90, 54 + ((cats.blog || 0) + (cats.social || 0)) * 5), why: '블로그·SNS 공개 활동이 반복적으로 발견됨' });
  if (/비교|분석|리뷰|후기|정리|가이드/.test(text)) styles.push({ label: '분석·비교형', confidence: 68, why: '비교·분석·리뷰형 표현이 공개 콘텐츠에 반복됨' });
  let occupation = '';
  if (/wafer|bonding|chuck|semiconductor|반도체|기판|본딩|엔지니어|engineering|설계/.test(text)) occupation = '기술·엔지니어링 종사 가능성';
  else if (/developer|software|github|개발자|python|javascript/.test(text)) occupation = '소프트웨어·개발 종사 가능성';
  else if (/research|연구|논문|academic/.test(text)) occupation = '연구·전문직 종사 가능성';
  return { occupation: occupation || '직업을 충분히 추정하기 어려움', interests, styles: styles.slice(0, 3) };
}
function keywordProfile(results) { return inferPersona(results, {}).interests.map(x => x.label).slice(0, 6); }
function buildReport(input, results, github) {
  const enriched = results.map(r => ({ ...r, category: categoryOf(r), confidence: calcConfidence(r, input), domain: domainOf(r.url), year: extractYear(r) }));
  const likely = enriched.filter(r => r.confidence >= 55);
  const categories = [...new Set(likely.map(r => r.category))], domains = [...new Set(likely.map(r => r.domain).filter(Boolean))];
  const hintCount = ['company', 'school', 'role', 'region', 'nickname', 'social', 'keyword', 'ageBand'].filter(k => input[k]).length;
  const score = Math.min(94, Math.round(16 + likely.length * 2.8 + categories.length * 6 + Math.min(domains.length, 10) * 2 + hintCount * 3));
  const confidence = Math.min(95, Math.round(43 + hintCount * 6 + Math.min(likely.length, 9) * 3));
  const persona = inferPersona(likely, input), top = persona.interests.slice(0, 3).map(x => x.label);
  const patentCount = likely.filter(r => r.category === 'patent').length;
  let narrative = `공개 인터넷에서 ${input.name}과 연결 가능성이 높은 흔적 ${likely.length}건을 찾았습니다.`;
  if (input.company) narrative += ` ${input.company} 관련 정보와 교차해 동명이인을 줄였습니다.`;
  if (patentCount) narrative += ` 특히 발명자·출원인 기준으로 일치하는 특허 흔적 ${patentCount}건이 확인됩니다.`;
  if (persona.occupation !== '직업을 충분히 추정하기 어려움') narrative += ` 공개 기록만 보면 ‘${persona.occupation}’이 높습니다.`;
  if (top.length) narrative += ` 반복되는 관심 주제는 ${top.join(', ')}입니다.`;
  if (persona.styles[0]) narrative += ` 온라인 흔적은 ‘${persona.styles[0].label}’ 성격이 상대적으로 두드러집니다.`;
  const timeline = likely.filter(r => r.year).sort((a, b) => a.year - b.year).slice(0, 14).map(r => ({ year: r.year, title: r.title, category: r.category, confidence: r.confidence }));
  const grouped = {}; for (const r of likely.sort((a, b) => b.confidence - a.confidence)) (grouped[r.category] ||= []).push(r);
  if (github) {
    grouped.developer ||= [];
    grouped.developer.unshift({ title: `GitHub @${github.user.login}`, snippet: [github.user.name, github.user.bio, github.user.company, `${github.user.public_repos} public repos`].filter(Boolean).join(' · '), category: 'developer', confidence: 98, domain: 'github.com', year: new Date(github.user.created_at).getFullYear() });
  }
  return { score, confidence, narrative, keywords: top, persona, grouped, timeline, stats: { likely: likely.length, total: enriched.length, domains: domains.length, categories: categories.length, patents: patentCount }, sources: { patents: true, naver: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET), kakao: Boolean(process.env.KAKAO_REST_API_KEY), publicWeb: true } };
}
async function scan(input) {
  if (input.selfAudit !== 'yes') throw new Error('본인 또는 본인의 동의를 받은 검색만 이용할 수 있습니다.');
  const name = clean(input.name, 80); if (!name) throw new Error('이름은 필수입니다.');
  const hints = {
    name,
    ageBand: clean(input.ageBand, 20), company: clean(input.company, 100), school: clean(input.school, 100),
    role: clean(input.role, 100), region: clean(input.region, 80), nickname: clean(input.nickname, 80),
    social: clean(input.social, 180), github: clean(input.github, 50), keyword: clean(input.keyword, 100)
  };
  const core = [name, hints.company, hints.school, hints.role, hints.region, hints.nickname].filter(Boolean).join(' ');
  const broad = [name, hints.company, hints.school].filter(Boolean).map(x => `"${x}"`).join(' ');
  const jobs = [
    patentSearch(name, hints.company, 50),
    duckSearch(broad || `"${name}"`, 10),
    duckSearch(`"${name}" ${hints.company || ''} ${hints.role || ''}`.trim(), 8),
    crossrefSearch(name, hints, 5),
    naverSearch(core),
    kakaoSearch(core)
  ];
  if (hints.nickname || hints.social) jobs.push(duckSearch(`"${name}" ${hints.nickname || ''} ${hints.social || ''}`.trim(), 8));
  if (hints.company) jobs.push(duckSearch(`"${name}" "${hints.company}" site:linkedin.com OR site:blog.naver.com OR site:instagram.com OR site:facebook.com`, 8));
  const ghPromise = githubLookup(hints.github);
  const [batches, github] = await Promise.all([Promise.all(jobs.map(p => Promise.resolve(p).catch(() => []))), ghPromise]);
  const dedupe = new Map();
  for (const r of batches.flat()) {
    if (!r || !r.url) continue;
    const key = r.patentId ? `patent:${r.patentId}` : r.url.replace(/[#?].*$/, '');
    if (!dedupe.has(key)) dedupe.set(key, r);
  }
  return { input: hints, report: buildReport(hints, [...dedupe.values()], github) };
}
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(body);
}
function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  file = path.normalize(file).replace(/^\.\.(\/|\\)/, '');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return sendJson(res, 403, { error: 'Forbidden' });
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(full); const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300' }); res.end(data);
  });
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && u.pathname === '/health') return sendJson(res, 200, { ok: true, version: '0.4.0' });
  if (req.method === 'POST' && u.pathname === '/api/scan') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > MAX_BODY) req.destroy(); });
    req.on('end', async () => {
      try { const data = JSON.parse(body || '{}'); const result = await scan(data); sendJson(res, 200, result); }
      catch (e) { sendJson(res, 400, { error: e.message || '검색에 실패했습니다.' }); }
    });
    return;
  }
  if (req.method === 'GET') return serveStatic(req, res, u.pathname);
  res.writeHead(405); res.end('Method not allowed');
});
if (require.main === module) server.listen(PORT, () => console.log(`Footprint listening on ${PORT}`));
module.exports = { clean, categoryOf, calcConfidence, extractYear, keywordProfile, inferPersona, parseCsv, parsePatentCsv, buildReport };
