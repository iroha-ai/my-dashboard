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
import { renderTasks, showTasksMessage, updateTasks } from './tasks.js?v=20260810-done-tasks2';
import { updateNewsDigest } from './news.js?v=20260809-news-status';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
// タスク欄（Google Tasks）、定時ニュース欄（Gmail）も同じ画面に出すため、
// カレンダーと合わせて要求する。2026-08-07 にスコープへ tasks.readonly を、
// 2026-08-08 に gmail.readonly を追加した。既存の同意には含まれていないため、
// 追加後の初回接続だけは「接続する」を押し直す必要がある。
//
// 【gmail.readonlyについて】本当に必要なのは件名・日時だけ（本文は使わない）
// なので、最初は最小権限の gmail.metadata を使う予定だった。しかし
// gmail.metadata スコープは messages.list の q パラメータ（検索クエリ）に
// 対応しておらず、「件名に定時ニュースダイジェストを含むメールだけ」を
// サーバー側で絞り込めない。全メールを取得してクライアント側で絞り込むのは
// 非現実的なため、gmail.readonly（本文も読める、より広いスコープ）を使っている。
// 実際の使用は件名・日時の取得のみ（js/news.js参照）。
const SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly ' +
  'https://www.googleapis.com/auth/tasks.readonly ' +
  'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let requestSignIn = null;

// トークンをlocalStorageにも持たせる（2026-08-09追加）。
// これまではJS変数だけに保持していたため、ページを再読み込みするたびに
// トークンがまだ有効（最長1時間）でも毎回サインインをやり直す必要があった。
// リロード直後にlocalStorageから復元できれば、有効期限内は「接続する」を
// 押し直さずに済む。読み取り専用スコープ（calendar/tasks/gmail.readonly）の
// 短命トークンなので、常時表示のこの端末向けにはlocalStorage保持で許容している。
const TOKEN_STORAGE_KEY = 'my-dashboard:google-token';

function saveTokenToStorage() {
  try {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ accessToken, tokenExpiresAt })
    );
  } catch {
    // localStorageが使えない環境（プライベートモード等）では黙って諦める。
    // 保持できないだけで、従来どおり毎回サインインすれば動作は変わらない。
  }
}

function loadTokenFromStorage() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return;
    const { accessToken: savedToken, tokenExpiresAt: savedExpiry } = JSON.parse(raw);
    if (savedToken && Date.now() < savedExpiry - 60_000) {
      accessToken = savedToken;
      tokenExpiresAt = savedExpiry;
    }
  } catch {
    // 壊れた値が入っていた場合も無視して、通常のサインインフローに任せる。
  }
}

function clearTokenStorage() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 消せなくても実害はない（次回読み込み時に期限切れとして無視されるだけ）。
  }
}

loadTokenFromStorage();

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
      // サードパーティCookie制限下でも無言の再取得（prompt:''）が通りやすくなる
      // よう、FedCMベースの取得を試みる（2026-08-09追加）。非対応ブラウザでは
      // 無視され、従来の挙動にフォールバックする。
      use_fedcm_for_prompt: true,
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
      saveTokenToStorage();
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

  // タイトルに「移動」を含む予定は紫扱い。来客・外出（駅すぱあと等の自動生成含む）とは
  // 別枠にするため、来客・外出の判定より先に見て、該当したらそちらを優先する。
  const isTransit = CONFIG.transitKeywords.some((kw) => title.includes(kw));

  // タイトルのキーワードに加え、説明欄に駅すぱあと（経路検索）由来の
  // 自動生成マーカーがある予定（＝移動・外出の予定）も来客・外出として拾う。
  const isVisitor =
    !isTransit &&
    (CONFIG.visitorKeywords.some((kw) => title.includes(kw)) ||
      CONFIG.visitorDescriptionMarkers.some((kw) => description.includes(kw)));

  // Google Tasksの疑似イベント（説明欄にGoogleの定型文が入る）かどうか。
  const isTaskEvent = CONFIG.taskDescriptionMarkers.some((kw) => description.includes(kw));

  return {
    title,
    start,
    end,
    allDay,
    location: event.location || '',
    isVisitor,
    isTransit,
    isTaskEvent,
  };
}

// Google Calendar の終日予定は end.date が「翌日の 00:00」（終了日は含まない）になる。
// 開始日だけで判定すると、連日の休暇や日またぎ予定が2日目から消えてしまうため、
// 対象日の範囲と予定の範囲が重なるかで表示対象を決める。
function occursOnDay(event, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return event.start < dayEnd && event.end > dayStart;
}

function displayTimeForDay(event, day) {
  if (event.allDay) return '終日';
  return isSameDay(event.start, day) ? formatTime(event.start) : '継続';
}

// 来客・外出は今日ぶんだけに絞っているので、日付表示は不要（時刻のみ）。
function renderPickup(node, events, kind) {
  clear(node);

  if (!events.length) {
    node.appendChild(el('li', 'placeholder', '今日の予定はなし'));
    return;
  }

  for (const ev of events) {
    const li = el('li');
    const item = el('div', `pickup-item is-${kind}`);

    item.appendChild(el('div', 'pickup-time', displayTimeForDay(ev, new Date())));
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
      `today-item${ev.isVisitor ? ' is-visitor' : ''}${ev.isTransit ? ' is-transit' : ''}${ev.isTaskEvent ? ' is-task' : ''}${ev.end < now ? ' is-past' : ''}`
    );

    li.appendChild(
      ev.allDay
        ? el('div', 'today-time is-allday', '終日')
        : el(
            'div',
            'today-time',
            isSameDay(ev.start, now) ? `${formatTime(ev.start)}–${formatTime(ev.end)}` : '継続中'
          )
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
    const dayEvents = events.filter((ev) => occursOnDay(ev, day));

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
        const chip = el(
          'span',
          `week-event${ev.isVisitor ? ' is-visitor' : ''}${ev.isTransit ? ' is-transit' : ''}${ev.isTaskEvent ? ' is-task' : ''}`
        );
        chip.appendChild(el('span', 't', displayTimeForDay(ev, day)));
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

  const todayEvents = events.filter((ev) => occursOnDay(ev, today));
  renderToday(todayEvents);
  renderWeek(events, from);
  renderPickup(
    document.getElementById('visitor-list'),
    todayEvents.filter((ev) => ev.isVisitor),
    'visitor'
  );
}

// ?demo=1 用。実IDが無くリンク先を持てないので、テキストのみで並べる。
function renderDemoNews(items) {
  const list = document.getElementById('news-digest-list');
  if (!list) return;
  clear(list);
  for (const item of items) {
    list.appendChild(el('li', 'news-digest-item', item.label));
  }
}

function showCalendarMessage(message, isError) {
  for (const id of ['today-list', 'visitor-list', 'week-list']) {
    showMessage(document.getElementById(id), message, isError);
  }
  showTasksMessage(message, isError);
  document.getElementById('today-count').textContent = '';
}

export async function updateCalendar(onStatus) {
  // 動作確認用。?demo=1 を付けると、認証せずサンプルの予定でレイアウトを確認できる。
  if (new URLSearchParams(location.search).get('demo') === '1') {
    const { DEMO_EVENTS, DEMO_TASKS, DEMO_NEWS } = await import('./demo-events.js');
    renderAll(DEMO_EVENTS());
    renderTasks(DEMO_TASKS());
    renderDemoNews(DEMO_NEWS());
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
    await updateNewsDigest(token, onStatus);
    await updateTasks(token, onStatus);
  } catch (err) {
    console.error('カレンダーの取得に失敗', err);
    accessToken = null;
    clearTokenStorage();

    // 黙って取り直せなかったときは、押せば繋ぎ直せる状態にしておく。
    requestSignIn = async () => {
      try {
        const token = await getAccessToken({ interactive: true });
        renderAll(await fetchEvents(token, from, to));
        onStatus?.('calendar', null, false);
        requestSignIn = null;
        await updateNewsDigest(token, onStatus);
        await updateTasks(token, onStatus);
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
