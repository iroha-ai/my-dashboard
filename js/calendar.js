import { CONFIG } from './config.js';
import {
  addDays,
  clear,
  el,
  formatTime,
  isSameDay,
  showMessage,
  startOfDay,
  weekdayLabel,
} from './util.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let requestSignIn = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`スクリプトを読み込めません: ${src}`));
    document.head.appendChild(s);
  });
}

// 常時表示なので、期限が切れる前に黙って取り直す。
// 取り直せないときだけ、画面から手動で繋ぎ直せるようにする。
async function getAccessToken({ interactive = false } = {}) {
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  if (!tokenClient) {
    await loadScript(GIS_SRC);
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.googleClientId,
      scope: SCOPE,
      callback: () => {},
    });
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      accessToken = response.access_token;
      tokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
      resolve(accessToken);
    };
    tokenClient.error_callback = (err) => reject(new Error(err?.type || 'auth_failed'));
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function fetchEvents(token, timeMin, timeMax) {
  const all = [];

  for (const calendarId of CONFIG.calendarIds) {
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events` +
      `?timeMin=${encodeURIComponent(timeMin.toISOString())}` +
      `&timeMax=${encodeURIComponent(timeMax.toISOString())}` +
      '&singleEvents=true&orderBy=startTime&maxResults=250';

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`カレンダー取得に失敗 (${res.status})`);
    }
    const data = await res.json();
    all.push(...(data.items || []));
  }

  return all;
}

function normalize(event) {
  const allDay = Boolean(event.start?.date);
  const start = new Date(event.start?.dateTime || `${event.start?.date}T00:00:00`);
  const end = new Date(
    event.end?.dateTime || `${event.end?.date || event.start?.date}T00:00:00`
  );
  const title = event.summary || '(件名なし)';
  const description = event.description || '';

  // タイトルのキーワードに加え、説明欄に駅すぱあと（経路検索）由来の
  // 自動生成マーカーがある予定（＝移動・外出の予定）も来客・外出として拾う。
  const isVisitor =
    CONFIG.visitorKeywords.some((kw) => title.includes(kw)) ||
    CONFIG.visitorDescriptionMarkers.some((kw) => description.includes(kw));

  return {
    title,
    start,
    end,
    allDay,
    location: event.location || '',
    isVisitor,
  };
}

function renderPickup(node, events, kind) {
  clear(node);

  if (!events.length) {
    node.appendChild(el('li', 'placeholder', 'この一週間は予定なし'));
    return;
  }

  const today = new Date();
  for (const ev of events) {
    const li = el('li');
    const item = el('div', `pickup-item is-${kind}`);

    const when = isSameDay(ev.start, today)
      ? '今日'
      : `${ev.start.getMonth() + 1}/${ev.start.getDate()}（${weekdayLabel(ev.start)}）`;
    item.appendChild(
      el('div', 'pickup-time', ev.allDay ? `${when} 終日` : `${when} ${formatTime(ev.start)}`)
    );
    item.appendChild(el('div', 'pickup-title', ev.title));
    if (ev.location) {
      item.appendChild(el('div', 'pickup-place', ev.location));
    }

    li.appendChild(item);
    node.appendChild(li);
  }
}

function renderToday(events) {
  const list = document.getElementById('today-list');
  const count = document.getElementById('today-count');
  clear(list);

  if (!events.length) {
    list.appendChild(el('li', 'placeholder', '今日の予定はありません'));
    count.textContent = '';
    return;
  }

  count.textContent = `${events.length}件`;
  const now = new Date();

  for (const ev of events) {
    const li = el(
      'li',
      `today-item${ev.isVisitor ? ' is-visitor' : ''}${ev.end < now ? ' is-past' : ''}`
    );

    li.appendChild(
      ev.allDay
        ? el('div', 'today-time is-allday', '終日')
        : el('div', 'today-time', `${formatTime(ev.start)}–${formatTime(ev.end)}`)
    );

    const main = el('div', 'today-main');
    main.appendChild(el('div', 'today-title', ev.title));
    if (ev.location) main.appendChild(el('div', 'today-place', ev.location));
    li.appendChild(main);

    list.appendChild(li);
  }
}

function renderWeek(events, from) {
  const node = document.getElementById('week-list');
  clear(node);

  // 今日は中央に大きく出しているので、この欄は翌日から weekDays 日ぶんを並べる。
  for (let i = 1; i <= CONFIG.weekDays; i += 1) {
    const day = addDays(from, i);
    const dayEvents = events.filter((ev) => isSameDay(ev.start, day));

    const row = el('div', 'week-day');
    const dow = day.getDay();
    const label = el(
      'div',
      `week-label${dow === 6 ? ' is-sat' : ''}${dow === 0 ? ' is-sun' : ''}`,
      `${day.getMonth() + 1}/${day.getDate()}（${weekdayLabel(day)}）`
    );
    row.appendChild(label);

    const box = el('div', 'week-events');
    if (!dayEvents.length) {
      box.appendChild(el('span', 'week-empty', '—'));
    } else {
      for (const ev of dayEvents) {
        const chip = el('span', `week-event${ev.isVisitor ? ' is-visitor' : ''}`);
        if (!ev.allDay) chip.appendChild(el('span', 't', formatTime(ev.start)));
        chip.appendChild(document.createTextNode(ev.title));
        box.appendChild(chip);
      }
    }
    row.appendChild(box);
    node.appendChild(row);
  }
}

function renderAll(rawEvents) {
  const events = rawEvents.map(normalize).sort((a, b) => a.start - b.start);
  const today = new Date();
  const from = startOfDay(today);

  renderToday(events.filter((ev) => isSameDay(ev.start, today)));
  renderWeek(events, from);
  renderPickup(
    document.getElementById('visitor-list'),
    events.filter((ev) => ev.isVisitor),
    'visitor'
  );
}

function showCalendarMessage(message, isError) {
  for (const id of ['today-list', 'visitor-list', 'week-list']) {
    showMessage(document.getElementById(id), message, isError);
  }
  document.getElementById('today-count').textContent = '';
}

export async function updateCalendar(onStatus) {
  // 動作確認用。?demo=1 を付けると、認証せずサンプルの予定でレイアウトを確認できる。
  if (new URLSearchParams(location.search).get('demo') === '1') {
    const { DEMO_EVENTS } = await import('./demo-events.js');
    renderAll(DEMO_EVENTS());
    onStatus?.('calendar', 'デモ表示中', false);
    return;
  }

  if (!CONFIG.googleClientId) {
    showCalendarMessage('GoogleクライアントIDが未設定です', true);
    onStatus?.('calendar', 'カレンダー未設定', true);
    return;
  }

  const from = startOfDay(new Date());
  // 翌日から weekDays 日ぶんを出すので、今日ぶんを足した範囲を取りにいく。
  const to = addDays(from, CONFIG.weekDays + 1);

  try {
    const token = await getAccessToken();
    renderAll(await fetchEvents(token, from, to));
    onStatus?.('calendar', null, false);
    requestSignIn = null;
  } catch (err) {
    console.error('カレンダーの取得に失敗', err);
    accessToken = null;

    // 黙って取り直せなかったときは、押せば繋ぎ直せる状態にしておく。
    requestSignIn = async () => {
      try {
        const token = await getAccessToken({ interactive: true });
        renderAll(await fetchEvents(token, from, to));
        onStatus?.('calendar', null, false);
        requestSignIn = null;
      } catch (retryErr) {
        // ポップアップを閉じた・許可しなかった等。押し直せる状態のまま、理由だけ出す。
        console.error('カレンダーへの接続に失敗', retryErr);
        onStatus?.('calendar', 'カレンダーへの接続に失敗しました', true, requestSignIn);
      }
    };
    showCalendarMessage('カレンダーに接続できていません', true);
    onStatus?.('calendar', 'カレンダー未接続', true, requestSignIn);
  }
}
