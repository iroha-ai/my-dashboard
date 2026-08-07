const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function weekdayLabel(date) {
  return WEEKDAYS[date.getDay()];
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function showMessage(node, message, isError = false) {
  clear(node);
  node.appendChild(el('div', isError ? 'load-error' : 'placeholder', message));
}

// fetch の失敗を握りつぶさず、呼び出し側が状態を出せるようにする。
export async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

// 一定間隔で走らせる。初回は即時に実行する。
export function runPeriodically(fn, intervalMs) {
  const tick = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(err);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}
