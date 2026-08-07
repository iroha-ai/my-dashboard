#!/usr/bin/env node
// GitHub Actions から5分ごとに走らせ、相場JSONを標準出力へ書き出す。
//
// 取得先の考え方:
//   - APIキーが要らないもので賄えるところは、そのまま賄う
//   - ドル円と日経平均は Twelve Data（要APIキー）を使う
//   - キーが無いときもドル円だけは前日終値で埋め、日経平均は未取得として残す
// 1銘柄でも落ちたときに全体を巻き添えにしないよう、失敗は銘柄ごとに閉じ込める。

const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY || '';
const TIMEOUT_MS = 15_000;

const SYMBOLS = [
  { id: 'usdjpy', label: 'ドル円', decimals: 2 },
  { id: 'n225', label: '日経平均', decimals: 0 },
  { id: 'xrp', label: 'XRP/USD', decimals: 4 },
  { id: 'xlm', label: 'XLM/USD', decimals: 4 },
  { id: 'gold', label: '金（XAU/USD）', decimals: 2 },
  { id: 'silver', label: '銀（XAG/USD）', decimals: 2 },
];

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'my-dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function monthDay(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// --- 暗号資産（キー不要） ---
async function fetchCrypto() {
  const data = await getJson(
    'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=ripple,stellar&vs_currencies=usd&include_last_updated_at=true'
  );
  return {
    xrp: { value: data?.ripple?.usd, at: data?.ripple?.last_updated_at },
    xlm: { value: data?.stellar?.usd, at: data?.stellar?.last_updated_at },
  };
}

// --- 金・銀（キー不要） ---
async function fetchMetal(symbol) {
  const data = await getJson(`https://api.gold-api.com/price/${symbol}`);
  if (typeof data?.price !== 'number') throw new Error('価格が取れませんでした');
  return { value: data.price, at: data.updatedAt };
}

// --- Twelve Data（要APIキー） ---
async function fetchTwelveData(symbols) {
  const query = encodeURIComponent(symbols.join(','));
  const data = await getJson(
    `https://api.twelvedata.com/price?symbol=${query}&apikey=${TWELVEDATA_KEY}`
  );
  if (data?.status === 'error') throw new Error(data.message || 'APIエラー');

  // 1銘柄だけを頼むと入れ子にならずに返ってくるため、形を揃える。
  const table = symbols.length === 1 ? { [symbols[0]]: data } : data;
  const out = {};
  for (const symbol of symbols) {
    const price = Number(table?.[symbol]?.price);
    out[symbol] = Number.isFinite(price) ? price : null;
  }
  return out;
}

// --- ドル円のキー無しでの代替（前日終値） ---
async function fetchUsdJpyDaily() {
  const data = await getJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY');
  const value = data?.rates?.JPY;
  if (typeof value !== 'number') throw new Error('レートが取れませんでした');
  return { value, note: `終値・${monthDay(data.date)}` };
}

async function main() {
  const results = new Map();
  const fail = (id, reason) => results.set(id, { ok: false, reason });
  const ok = (id, value, note) => results.set(id, { ok: true, value, note });

  // 暗号資産
  try {
    const crypto = await fetchCrypto();
    for (const id of ['xrp', 'xlm']) {
      if (typeof crypto[id].value === 'number') ok(id, crypto[id].value, null);
      else fail(id, '価格が取れませんでした');
    }
  } catch (err) {
    fail('xrp', `取得失敗: ${err.message}`);
    fail('xlm', `取得失敗: ${err.message}`);
  }

  // 金・銀
  for (const [id, symbol] of [
    ['gold', 'XAU'],
    ['silver', 'XAG'],
  ]) {
    try {
      const metal = await fetchMetal(symbol);
      ok(id, metal.value, null);
    } catch (err) {
      fail(id, `取得失敗: ${err.message}`);
    }
  }

  // ドル円・日経平均
  if (TWELVEDATA_KEY) {
    try {
      const prices = await fetchTwelveData(['USD/JPY', 'N225']);
      if (prices['USD/JPY'] !== null) ok('usdjpy', prices['USD/JPY'], null);
      if (prices['N225'] !== null) ok('n225', prices['N225'], null);
    } catch (err) {
      console.error(`Twelve Data の取得に失敗: ${err.message}`);
    }
  }

  if (!results.has('usdjpy')) {
    try {
      const daily = await fetchUsdJpyDaily();
      ok('usdjpy', daily.value, daily.note);
    } catch (err) {
      fail('usdjpy', `取得失敗: ${err.message}`);
    }
  }

  if (!results.has('n225')) {
    fail(
      'n225',
      TWELVEDATA_KEY ? '契約プランが指数に未対応の可能性' : 'APIキー未設定'
    );
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    items: SYMBOLS.map((s) => ({ ...s, ...(results.get(s.id) || { ok: false, reason: '未取得' }) })),
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  const missing = payload.items.filter((i) => !i.ok).map((i) => i.id);
  if (missing.length) {
    console.error(`取得できなかった銘柄: ${missing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
