import { CONFIG } from './config.js?v=20260812-transit-purple';
import { startClock } from './clock.js';
import { updateCalendar } from './calendar.js?v=20260812-transit-purple';
import { updateTrain } from './train.js';
import { updateWeather } from './weather.js?v=20260812-alert-severity-color';
import { updateDeliveryStatus } from './news.js?v=20260809-news-status';
import { clear, el, runPeriodically } from './util.js';

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
    `更新　予定等 ${time('calendar')}｜天気 ${time('weather')}｜運行 ${time('train')}`;
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
      const button = el('button', 'status-action', '接続する');
      button.addEventListener('click', () => entry.action());
      strip.appendChild(button);
    }
  }
}

function setStatus(key, message, isError, action = null) {
  statuses.set(key, { message, isError, action });
  renderStatus();
}

async function updateAndStamp(key, update) {
  let completed = false;
  const trackStatus = (statusKey, message, isError, action = null) => {
    setStatus(statusKey, message, isError, action);
    if (statusKey === key) completed = !isError;
  };

  await update(trackStatus);
  if (completed) markUpdated(key);
}

startClock();
renderUpdatedAt();

runPeriodically(async () => {
  await updateDeliveryStatus();
}, CONFIG.intervals.calendar);

runPeriodically(async () => {
  await updateAndStamp('calendar', updateCalendar);
}, CONFIG.intervals.calendar);

runPeriodically(async () => {
  await updateAndStamp('weather', updateWeather);
}, CONFIG.intervals.weather);

runPeriodically(async () => {
  await updateAndStamp('train', updateTrain);
}, CONFIG.intervals.train);
