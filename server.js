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

function htmlDecode(s='') {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s='') {
  return htmlDecode(s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function unwrapDuckUrl(href='') {
  const decoded = htmlDecode(href);
  try {
    const u = new URL(decoded.startsWith('//') ? 'https:' + decoded : decoded, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : u.href;
  } catch { return decoded; }
}

async function fetchText(url, opts = {}, timeoutMs = 8500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FootprintSelfAudit/0.2; +https://github.com/shoon94parkk-del/Footprint)',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.7',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function duckSearch(query, limit = 8) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const out = [];
  const re = /<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const href = unwrapDuckUrl(m[1]);
    if (!/^https?:\/\//i.test(href)) continue;
    out.push({ title: stripTags(m[2]), url: href, snippet: stripTags(m[3]), source: 'web' });
  }
  return out;
}

async function crossrefSearch(name, hints, limit = 5) {
  const q = [name, hints.company, hints.school, hints.role].filter(Boolean).join(' ');
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${limit}&select=DOI,title,author,published,URL,publisher`;
  const text = await fetchText(url, { headers: { accept: 'application/json' } });
  const json = JSON.parse(text);
  return (json.message?.items || []).map(item => {
    const year = item.published?.['date-parts']?.[0]?.[0] || null;
    const authors = (item.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ')).join(', ');
    return {
      title: (item.title || [])[0] || '학술 자료',
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
      snippet: [authors, item.publisher, year].filter(Boolean).join(' · '),
      year,
      source: 'academic'
    };
  }).filter(x => x.url);
}

async function githubLookup(username) {
  if (!username) return null;
  const safe = username.replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(safe)) return null;
  const headers = { accept: 'application/vnd.github+json' };
  const [userText, reposText] = await Promise.all([
    fetchText(`https://api.github.com/users/${encodeURIComponent(safe)}`, { headers }),
    fetchText(`https://api.github.com/users/${encodeURIComponent(safe)}/repos?sort=updated&per_page=6`, { headers })
  ]);
  const user = JSON.parse(userText);
  const repos = JSON.parse(reposText);
  return {
    user: {
      login: user.login, name: user.name, bio: user.bio, company: user.company, location: user.location,
      blog: user.blog, html_url: user.html_url, public_repos: user.public_repos, followers: user.followers,
      created_at: user.created_at
    },
    repos: Array.isArray(repos) ? repos.map(r => ({name:r.name, url:r.html_url, description:r.description, language:r.language, updated_at:r.updated_at, stars:r.stargazers_count})) : []
  };
}

function domainOf(url='') { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; } }

function categoryOf(r) {
  const d = domainOf(r.url).toLowerCase();
  const t = `${r.title} ${r.snippet}`.toLowerCase();
  if (d.includes('patents.google') || d.includes('kipris') || t.includes('patent') || t.includes('특허')) return 'patent';
  if (d.includes('github.com')) return 'developer';
  if (d.includes('linkedin.com')) return 'career';
  if (r.source === 'academic' || d.includes('doi.org') || d.includes('researchgate') || d.includes('orcid')) return 'academic';
  if (/news|newspaper|press|기사|뉴스/.test(t)) return 'news';
  return 'web';
}

function calcConfidence(r, hints) {
  const hay = `${r.title} ${r.snippet} ${r.url}`.toLowerCase();
  let s = 42;
  const checks = [
    [hints.company, 22], [hints.school, 15], [hints.role, 12], [hints.region, 8], [hints.github, 20], [hints.keyword, 10]
  ];
  for (const [v, pts] of checks) if (v && hay.includes(v.toLowerCase())) s += pts;
  if (categoryOf(r) === 'patent' && hints.company) s += 6;
  if (s > 96) s = 96;
  return s;
}

function extractYear(r) {
  if (r.year) return r.year;
  const text = `${r.title} ${r.snippet}`;
  const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => Number(m[1])).filter(y => y >= 1980 && y <= 2035);
  return years[0] || null;
}

function keywordProfile(results) {
  const text = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  const dict = [
    ['반도체', ['semiconductor','반도체']], ['웨이퍼', ['wafer','웨이퍼']], ['본딩', ['bonding','본딩']],
    ['잉크젯', ['inkjet','잉크젯']], ['프린팅', ['printing','프린팅']], ['엔지니어링', ['engineer','engineering','엔지니어']],
    ['특허', ['patent','특허']], ['소프트웨어', ['software','developer','github','개발']], ['연구', ['research','연구']],
    ['AI', ['artificial intelligence','machine learning',' llm ',' ai ']]
  ];
  return dict.filter(([, terms]) => terms.some(x => text.includes(x))).map(([k]) => k).slice(0, 6);
}

function buildReport(input, results, github) {
  const hints = input;
  const enriched = results.map(r => ({...r, category: categoryOf(r), confidence: calcConfidence(r, hints), domain: domainOf(r.url), year: extractYear(r)}));
  const likely = enriched.filter(r => r.confidence >= 58);
  const categories = [...new Set(likely.map(r => r.category))];
  const domains = [...new Set(likely.map(r => r.domain).filter(Boolean))];
  const keywords = keywordProfile(likely);
  const hintCount = ['company','school','role','region','github','keyword'].filter(k => input[k]).length;
  const score = Math.min(92, Math.round(18 + likely.length * 3.2 + categories.length * 7 + Math.min(domains.length, 8) * 2 + hintCount * 3));
  const confidence = Math.min(95, Math.round(45 + hintCount * 7 + Math.min(likely.length, 8) * 3));
  const catNames = {patent:'특허·발명',developer:'개발 활동',career:'경력 프로필',academic:'논문·연구',news:'기사·언론',web:'공개 웹'};
  const strongest = categories.slice(0,3).map(c => catNames[c]);
  let narrative = `${input.name}이라는 이름으로 공개 웹을 탐색한 결과`;
  if (input.company) narrative += `, ${input.company}와 연결되는 흔적을 우선 대조했고`;
  narrative += ` ${likely.length}개의 비교적 관련성이 높은 흔적을 찾았습니다.`;
  if (strongest.length) narrative += ` 주된 노출 영역은 ${strongest.join(', ')}입니다.`;
  if (keywords.length) narrative += ` 검색 결과에서 반복적으로 나타난 주제는 ${keywords.join(', ')}입니다.`;
  narrative += ` 이 내용은 공개 정보의 자동 재구성이므로 각 항목의 신뢰도를 함께 확인해야 합니다.`;

  const timeline = likely.filter(r => r.year).sort((a,b) => a.year-b.year).slice(0, 10).map(r => ({year:r.year, title:r.title, category:r.category, url:r.url, confidence:r.confidence}));
  const grouped = {};
  for (const r of likely.sort((a,b)=>b.confidence-a.confidence)) (grouped[r.category] ||= []).push(r);
  if (github) {
    grouped.developer ||= [];
    grouped.developer.unshift({
      title: `GitHub @${github.user.login}`,
      url: github.user.html_url,
      snippet: [github.user.name, github.user.bio, github.user.company, `${github.user.public_repos} public repos`].filter(Boolean).join(' · '),
      category:'developer', confidence: 98, domain:'github.com', year: new Date(github.user.created_at).getFullYear()
    });
  }
  return {score, confidence, narrative, keywords, grouped, timeline, stats:{likely:likely.length, total:enriched.length, domains:domains.length, categories:categories.length}, github};
}

async function scan(input) {
  const name = clean(input.name, 80);
  if (!name) throw new Error('이름은 필수입니다.');
  const hints = {
    name,
    company: clean(input.company, 100), school: clean(input.school, 100), role: clean(input.role, 100),
    region: clean(input.region, 80), github: clean(input.github, 50), keyword: clean(input.keyword, 100)
  };
  const core = [name, hints.company, hints.school, hints.role, hints.region, hints.keyword].filter(Boolean).map(x => `"${x}"`).join(' ');
  const queries = [core];
  if (hints.company) queries.push(`"${name}" "${hints.company}" patent OR 특허`);
  if (hints.school || hints.role) queries.push(`"${name}" ${[hints.school,hints.role].filter(Boolean).join(' ')}`);

  const jobs = queries.slice(0,3).map(q => duckSearch(q, 7).catch(() => []));
  jobs.push(crossrefSearch(name, hints, 5).catch(() => []));
  const ghPromise = githubLookup(hints.github).catch(() => null);
  const batches = await Promise.all(jobs);
  const github = await ghPromise;
  const dedupe = new Map();
  for (const r of batches.flat()) if (r.url && !dedupe.has(r.url)) dedupe.set(r.url, r);
  return {input:hints, report:buildReport(hints, [...dedupe.values()], github)};
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  file = path.normalize(file).replace(/^\.\.(\/|\\)/, '');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return sendJson(res,403,{error:'Forbidden'});
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(full);
    const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'};
    res.writeHead(200, {'content-type':types[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-cache':'public, max-age=3600'});
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && u.pathname === '/health') return sendJson(res,200,{ok:true,version:'0.2.0'});
  if (req.method === 'POST' && u.pathname === '/api/scan') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > MAX_BODY) req.destroy(); });
    req.on('end', async () => {
      try { const data = JSON.parse(body || '{}'); const result = await scan(data); sendJson(res,200,result); }
      catch (e) { sendJson(res,400,{error:e.message || '검색에 실패했습니다.'}); }
    });
    return;
  }
  if (req.method === 'GET') return serveStatic(req,res,u.pathname);
  res.writeHead(405); res.end('Method not allowed');
});

if (require.main === module) server.listen(PORT, () => console.log(`Footprint listening on ${PORT}`));
module.exports = { clean, categoryOf, calcConfidence, keywordProfile, buildReport, extractYear };
