import { CONFIG } from './config.js';
import { startClock } from './clock.js';
import { updateCalendar } from './calendar.js';
import { updateMarket } from './market.js';
import { updateTrain } from './train.js';
import { updateWeather } from './weather.js';
import { clear, el, runPeriodically } from './util.js';

// 何かが取れていないとき、常時表示だと気づけない。
// ヘッダー右端にだけ、短く出す。
const statuses = new Map();

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

startClock();

runPeriodically(() => updateCalendar(setStatus), CONFIG.intervals.calendar);
runPeriodically(() => updateWeather(setStatus), CONFIG.intervals.weather);
runPeriodically(() => updateMarket(setStatus), CONFIG.intervals.market);
runPeriodically(() => updateTrain(setStatus), CONFIG.intervals.train);
