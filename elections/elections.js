// 参政党 開票ボード。data ブランチの sanseito-elections.json を読んで描く。
// JSON は PersonalVault 側の ops/scripts/election_monitor.py が作る（正本は
// PersonalVault の ops/methodology/参政党の選挙当落モニター.md）。
// 国政は選管データ（districts / proportional）、地方はニュース見出しの分類（items）。
import { CONFIG } from '../js/config.js?v=20261109-elections';
import { clear, el, fetchJson } from '../js/util.js?v=20261109-elections';

const LIVE_REFRESH_MS = 2 * 60 * 1000;
const REGULAR_REFRESH_MS = 10 * 60 * 1000;
const NEWS_MAX = 80;
const nf = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3 });

let filter = 'all';
let timer = null;

function fmtTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo',
  }).format(date);
}

function tile(label, big, unit, sub) {
  const box = el('div');
  box.appendChild(el('span', 'lab', label));
  const line = el('span', 'big num');
  line.appendChild(el('b', null, String(big)));
  if (unit) line.appendChild(el('small', null, unit));
  box.appendChild(line);
  if (sub) box.appendChild(el('span', 'sub', sub));
  return box;
}

function renderTally(data) {
  const node = document.getElementById('tally');
  clear(node);
  const nat = data.resultsTally?.['選挙区'] || {};
  const prop = data.resultsTally?.['比例'] || {};
  const t = data.tally || {};
  const local = (key) => t[key] || {};
  node.appendChild(tile('国政・選挙区', nat['当選'] ?? 0, `当選 / ${nat['候補者'] ?? 0}人`,
    `落選 ${nat['落選'] ?? 0}・開票中 ${nat['開票中'] ?? 0}`));
  node.appendChild(tile('国政・比例', prop['見込み議席'] ?? 0, '議席（見込み）',
    prop['得票'] ? `得票 ${nf.format(prop['得票'])}` : '選管データ未登録'));
  for (const [key, label] of [['都道府県議', '都道府県議'], ['市区町村議', '市区町村議'], ['首長', '首長']]) {
    const row = local(key);
    node.appendChild(tile(label, row['当選'] ?? 0, '当選の記事',
      `落選 ${row['落選'] ?? 0}・混在 ${row['当落混在'] ?? 0}`));
  }
}

function districtCard(d) {
  const card = el('article', 'card');
  card.dataset.mine = d.hasParty ? '1' : '0';
  const head = el('div', 'card-head');
  const left = el('div');
  left.appendChild(el('h3', null, d.name || d.id || '選挙区'));
  const rate = d.countedRate == null ? '開票率 不明' : (d.final ? '開票終了' : `開票率 ${d.countedRate}%`);
  left.appendChild(el('div', 'rate num', rate));
  head.appendChild(left);
  head.appendChild(el('span', 'seats', `定数 ${d.seats}`));
  card.appendChild(head);
  const progress = el('div', 'progress');
  const fill = el('i');
  fill.style.width = `${Math.max(0, Math.min(100, Number(d.countedRate) || 0))}%`;
  progress.appendChild(fill);
  card.appendChild(progress);

  const list = el('ol', 'cands');
  const top = Math.max(1, ...d.candidates.map((c) => Number(c.votes) || 0));
  d.candidates.forEach((c, i) => {
    if (i === d.seats && i < d.candidates.length) list.appendChild(el('li', 'cutline', '当選ライン'));
    const li = el('li', c.isParty ? 'cand is-party' : 'cand');
    li.appendChild(el('span', 'rank num', String(c.rank ?? i + 1)));
    const who = el('span', 'who');
    who.appendChild(el('b', null, c.name));
    if (c.party) who.appendChild(el('span', 'pty', c.party));
    if (c.status === '当選') who.appendChild(el('span', 'badge', d.final ? '当選' : '当確'));
    if (c.status === '落選') who.appendChild(el('span', 'badge out', '落選'));
    li.appendChild(who);
    const votes = el('span', 'votes num', nf.format(c.votes));
    votes.appendChild(el('small', null, `${c.share}%`));
    li.appendChild(votes);
    const bar = el('span', 'bar');
    const barFill = el('i');
    barFill.style.width = `${((Number(c.votes) || 0) / top * 100).toFixed(1)}%`;
    bar.appendChild(barFill);
    li.appendChild(bar);
    list.appendChild(li);
  });
  card.appendChild(list);
  if (d.sourceUrl) {
    const src = el('a', 'src', '選管の開票結果');
    src.href = d.sourceUrl; src.target = '_blank'; src.rel = 'noopener';
    card.appendChild(src);
  }
  return card;
}

function proportionalCard(block) {
  const card = el('article', 'prop');
  card.dataset.mine = block.parties.some((p) => p.isParty) ? '1' : '0';
  const head = el('div', 'card-head');
  head.appendChild(el('h3', null, block.name || block.id));
  const rate = block.countedRate == null ? '' : (block.final ? '開票終了' : `開票率 ${block.countedRate}%`);
  head.appendChild(el('span', 'seats', `定数 ${block.seats}${rate ? `・${rate}` : ''}`));
  card.appendChild(head);
  const wrap = el('div', 'tbl');
  const table = el('table');
  table.innerHTML = '<thead><tr><th>政党</th><th>得票数</th><th>得票率</th><th>見込み</th><th></th></tr></thead>';
  const body = el('tbody');
  for (const p of block.parties) {
    const tr = el('tr', p.isParty ? 'is-party' : '');
    tr.appendChild(el('td', null, p.party));
    tr.appendChild(el('td', 'num', nf.format(p.votes)));
    tr.appendChild(el('td', 'num', `${p.share}%`));
    tr.appendChild(el('td', 'num', String(p.seatsProjected)));
    const dotsCell = el('td', 'dots-cell');
    const dots = el('span', 'dots');
    for (let i = 0; i < p.seatsProjected; i += 1) dots.appendChild(el('i'));
    dotsCell.appendChild(dots);
    tr.appendChild(dotsCell);
    body.appendChild(tr);
  }
  table.appendChild(body);
  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

function renderNational(data) {
  const districts = document.getElementById('districts');
  const prop = document.getElementById('proportional');
  clear(districts); clear(prop);
  const ds = data.districts || [];
  const ps = data.proportional || [];
  if (!ds.length) districts.appendChild(el('div', 'empty', '国政選挙の選管データは登録されていません（選挙のときに登録します）'));
  ds.forEach((d) => districts.appendChild(districtCard(d)));
  if (!ps.length) prop.appendChild(el('div', 'empty', '比例ブロックの選管データは登録されていません'));
  ps.forEach((b) => prop.appendChild(proportionalCard(b)));
}

function renderNews(data) {
  const list = document.getElementById('news');
  clear(list);
  const items = (data.items || []).filter((i) => i.level !== '国政' || !(data.districts || []).length);
  if (!items.length) {
    list.appendChild(el('li', 'empty', '当落に関する見出しはまだありません'));
    return;
  }
  for (const item of items.slice(0, NEWS_MAX)) {
    const li = el('li');
    li.dataset.mine = '1';
    const outcomeClass = item.outcome === '当選' ? 'chip win' : (item.outcome === '落選' ? 'chip loss' : 'chip');
    li.appendChild(el('span', outcomeClass, item.outcome || '不明'));
    const level = [item.level, item.tier].filter(Boolean).join('・');
    li.appendChild(el('span', 'chip level', level || '不明'));
    // 見出しに参政党が出ない記事は、ほかの候補の当落なので「関連」として区別する（集計にも入れない）。
    if (item.partyInHeadline === false) li.classList.add('is-related');
    const a = el('a', null, item.title);
    if (item.partyInHeadline === false) a.prepend(el('span', 'chip', '関連'));
    a.href = item.link; a.target = '_blank'; a.rel = 'noopener';
    if (item.isNew) a.prepend(el('span', 'chip new', '新着'));
    li.appendChild(a);
    li.appendChild(el('span', 'when', [item.source, fmtTime(item.publishedAt || item.firstSeenAt)].filter(Boolean).join(' ・ ')));
    list.appendChild(li);
  }
}

function applyFilter() {
  document.querySelectorAll('[data-scope]').forEach((section) => {
    const scope = section.dataset.scope;
    section.hidden = !(filter === 'all' || filter === 'mine' || filter === scope);
  });
  document.querySelectorAll('.card, .prop').forEach((card) => {
    card.hidden = filter === 'mine' && card.dataset.mine === '0';
  });
}

function schedule(ms) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(load, ms);
}

async function load() {
  const updated = document.getElementById('updated');
  try {
    const data = await fetchJson(`${CONFIG.sanseitoElectionsDataUrl}?t=${Date.now()}`);
    if (!Array.isArray(data?.items) || Number(data.count) !== data.items.length) {
      throw new Error('JSONの形が想定と違います');
    }
    const live = data.mode === 'live';
    document.getElementById('live').hidden = !live;
    const label = data.live?.label ? `${data.live.label}　` : '';
    updated.textContent = `${label}最終更新 ${fmtTime(data.completedAt)}　次回の読み直し ${live ? '2分後' : '10分後'}`;
    updated.className = '';
    renderTally(data);
    renderNational(data);
    renderNews(data);
    applyFilter();
    if (data.disclaimer) document.getElementById('footer').textContent = data.disclaimer;
    schedule(live ? LIVE_REFRESH_MS : REGULAR_REFRESH_MS);
  } catch (err) {
    console.error('開票データの取得に失敗', err);
    if (String(err?.message || '').startsWith('404')) {
      updated.textContent = 'まだ開票データが公開されていません（PersonalVault 側の定時実行が初回を書くと表示されます）';
      updated.className = '';
      schedule(REGULAR_REFRESH_MS);
      return;
    }
    updated.textContent = `開票データを読めませんでした（${err.message}）。2分後にもう一度読みます`;
    updated.className = 'error';
    schedule(LIVE_REFRESH_MS);
  }
}

document.querySelectorAll('.filters button').forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.f;
    document.querySelectorAll('.filters button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    applyFilter();
  });
});

load();
