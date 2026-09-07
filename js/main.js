// ?v= はこのファイルだけでなく、js/*.js の import すべてで同じ値に揃えること
// （js/calendar.js の冒頭コメント参照。付け忘れると古いキャッシュを掴んで落ちる）。
import { CONFIG } from './config.js?v=20260905-ai-usage-windows';
import { startAiUsage } from './ai-usage.js?v=20260905-ai-usage-windows';
import { startClock } from './clock.js?v=20260905-ai-usage-windows';
import { updateCalendar } from './calendar.js?v=20260905-ai-usage-windows';
import { updateTrain } from './train.js?v=20260905-ai-usage-windows';
import { updateWeather } from './weather.js?v=20260905-ai-usage-windows';
import { updateNewsDigest } from './news.js?v=20260905-ai-usage-windows';
import { updateYahooSportsNews } from './yahoo-sports-news.js?v=20260905-ai-usage-windows';
import { updateXFollowing } from './x-following.js?v=20260905-ai-usage-windows';
import { clear, el, runPeriodically } from './util.js?v=20260905-ai-usage-windows';

// 何かが取れていないとき、常時表示だと気づけない。
// ヘッダー右端にだけ、短く出す。
const statuses = new Map();
const updatedAt = new Map();

function formatTime(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function renderUpdatedAt() {
  const node = document.getElementById('updated-at');
  if (!node) return;

  const time = (key) => updatedAt.has(key) ? formatTime(updatedAt.get(key)) : '--:--';
  node.textContent =
    `更新　予定等 ${time('calendar')}｜天気 ${time('weather')}｜運行 ${time('train')}｜ニュース ${time('news')}｜X ${time('xFollowing')}`;
}

function markUpdated(key) {
  updatedAt.set(key, new Date());
  renderUpdatedAt();
}

function renderStatus() {
  const strip = document.getElementById('status-strip');
  clear(strip);

  for (const [, entry] of statuses) {
    if (!entry.message) continue;
    strip.appendChild(
      el('span', entry.isError ? 'status-error' : '', entry.message)
    );
    if (entry.action) {
      const button = el('button', 'status-action', entry.actionLabel || '接続する');
      button.addEventListener('click', () => entry.action());
      strip.appendChild(button);
    }
  }
}

function setStatus(key, message, isError, action = null, actionLabel = '接続する') {
  statuses.set(key, { message, isError, action, actionLabel });
  renderStatus();
}

const FAILURE_LABELS = {
  calendar: '予定等の更新に失敗',
  weather: '天気の更新に失敗',
  train: '運行情報の更新に失敗',
  news: '定時ニュースの更新に失敗',
  yahooSportsNews: 'サッカー・モータースポーツニュースの更新に失敗',
  xFollowing: 'X投稿の更新に失敗',
};

// runPeriodically は例外を console.error するだけなので、想定外の例外が出ると
// 画面は「読み込み中」のまま黙って止まる。各 update 側でも失敗表示を出しているが、
// そこをすり抜けた分をヘッダーのステータス欄に必ず出す最後の砦としてここで捕まえる
// （2026-08-13追加。取れていないことに気づけないのが一番まずいため）。
async function updateAndStamp(key, update) {
  let completed = false;
  const trackStatus = (statusKey, message, isError, action = null, actionLabel = '接続する') => {
    setStatus(statusKey, message, isError, action, actionLabel);
    if (statusKey === key) completed = !isError;
  };

  try {
    await update(trackStatus);
  } catch (err) {
    console.error(`${key} の更新に失敗`, err);
    setStatus(key, FAILURE_LABELS[key] || `${key} の更新に失敗`, true);
    return;
  }
  if (completed) markUpdated(key);
}

startClock();
startAiUsage(CONFIG.aiUsageApiUrl);
renderUpdatedAt();

runPeriodically(async () => {
  await updateAndStamp('news', updateNewsDigest);
}, CONFIG.intervals.newsHeadlines);

runPeriodically(async () => {
  await updateAndStamp('calendar', updateCalendar);
}, CONFIG.intervals.calendar);

runPeriodically(async () => {
  await updateAndStamp('weather', updateWeather);
}, CONFIG.intervals.weather);

runPeriodically(async () => {
  await updateAndStamp('train', updateTrain);
}, CONFIG.intervals.train);

runPeriodically(async () => {
  await updateAndStamp('yahooSportsNews', updateYahooSportsNews);
}, CONFIG.intervals.yahooSportsNews);

runPeriodically(async () => {
  await updateAndStamp('xFollowing', updateXFollowing);
}, CONFIG.intervals.xFollowing);
