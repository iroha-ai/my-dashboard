import { clear, el, showMessage } from './util.js?v=20260825-x-following-widget';

const ACCOUNTS_STORAGE_KEY = 'my-dashboard:x-following-accounts:v1';
const SELECTED_STORAGE_KEY = 'my-dashboard:x-following-selected:v1';
const X_WIDGET_SCRIPT_ID = 'x-widgets-script';
const X_WIDGET_SRC = 'https://platform.twitter.com/widgets.js';
const RESERVED_PATHS = new Set([
  'compose',
  'explore',
  'home',
  'i',
  'messages',
  'notifications',
  'search',
  'settings',
]);

let widgetsRequest = null;
let controlsBound = false;
let currentOnStatus = null;

export function normalizeXHandle(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';

  text = text
    .replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, '')
    .replace(/^(?:www\.)?(?:x\.com|twitter\.com)\//i, '')
    .replace(/^@/, '');

  const handle = text.split(/[/?#]/, 1)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return '';
  if (RESERVED_PATHS.has(handle.toLowerCase())) return '';
  return handle;
}

export function parseXHandles(value) {
  const seen = new Set();
  const handles = [];
  for (const part of String(value ?? '').split(/[\s,、;；]+/)) {
    const handle = normalizeXHandle(part);
    const key = handle.toLowerCase();
    if (!handle || seen.has(key)) continue;
    seen.add(key);
    handles.push(handle);
  }
  return handles;
}

export function mergeXHandles(current, additions) {
  return parseXHandles([...(current || []), ...(additions || [])].join(' '));
}

function loadAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]');
    return parseXHandles(Array.isArray(parsed) ? parsed.join(' ') : '');
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    return true;
  } catch {
    return false;
  }
}

function loadSelectedHandle(accounts) {
  try {
    const saved = normalizeXHandle(localStorage.getItem(SELECTED_STORAGE_KEY));
    const match = accounts.find((handle) => handle.toLowerCase() === saved.toLowerCase());
    if (match) return match;
  } catch {
    // 保存値が読めなくても、先頭アカウントを表示すればよい。
  }
  return accounts[0] || '';
}

function saveSelectedHandle(handle) {
  try {
    if (handle) localStorage.setItem(SELECTED_STORAGE_KEY, handle);
    else localStorage.removeItem(SELECTED_STORAGE_KEY);
  } catch {
    // 選択状態だけのため、保存できなくても表示は継続する。
  }
}

function setPanelStatus(message) {
  const node = document.getElementById('x-following-status');
  if (node) node.textContent = message || '';
}

function showPanelMessage(message, isError = false) {
  const node = document.getElementById('x-following-message');
  if (!node) return;
  node.textContent = message || '';
  node.className = isError
    ? 'x-following-message is-error'
    : 'x-following-message';
}

function renderAccountControls(accounts, selectedHandle) {
  const select = document.getElementById('x-following-account');
  const removeButton = document.getElementById('x-following-remove');
  if (!select) return;

  clear(select);
  if (!accounts.length) {
    const option = el('option', '', 'アカウント未設定');
    option.value = '';
    select.appendChild(option);
  } else {
    for (const handle of accounts) {
      const option = el('option', '', `@${handle}`);
      option.value = handle;
      select.appendChild(option);
    }
    select.value = selectedHandle;
  }
  select.disabled = accounts.length === 0;
  if (removeButton) removeButton.disabled = accounts.length === 0;
}

function ensureXWidgets() {
  if (globalThis.twttr?.widgets?.load) return Promise.resolve(globalThis.twttr);
  if (widgetsRequest) return widgetsRequest;

  widgetsRequest = new Promise((resolve, reject) => {
    const finish = () => {
      if (globalThis.twttr?.widgets?.load) {
        resolve(globalThis.twttr);
        return;
      }
      if (globalThis.twttr?.ready) {
        globalThis.twttr.ready((twttr) => resolve(twttr));
        return;
      }
      reject(new Error('Xウィジェットを初期化できませんでした'));
    };

    const existing = document.getElementById(X_WIDGET_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Xウィジェットを読み込めませんでした')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.id = X_WIDGET_SCRIPT_ID;
    script.src = X_WIDGET_SRC;
    script.async = true;
    script.charset = 'utf-8';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Xウィジェットを読み込めませんでした')),
      { once: true }
    );
    document.head.appendChild(script);
  }).catch((error) => {
    widgetsRequest = null;
    throw error;
  });

  return widgetsRequest;
}

function appendProfileLink(container, handle, className = 'x-following-profile-link') {
  const link = el('a', className, `@${handle}をXで開く`);
  link.href = `https://x.com/${encodeURIComponent(handle)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  container.appendChild(link);
  return link;
}

async function renderProfileTimeline(handle) {
  const container = document.getElementById('x-following-timeline');
  if (!container) return;

  clear(container);
  const timeline = el('a', 'twitter-timeline', `@${handle}の公開投稿を表示`);
  timeline.href = `https://x.com/${encodeURIComponent(handle)}`;
  timeline.dataset.theme = 'dark';
  timeline.dataset.height = '320';
  timeline.dataset.chrome = 'noheader nofooter noborders transparent';
  timeline.dataset.dnt = 'true';
  timeline.setAttribute('aria-label', `@${handle}の公開投稿`);
  container.appendChild(timeline);

  try {
    const twttr = await ensureXWidgets();
    await twttr.widgets.load(container);
    setPanelStatus(`@${handle}`);
    showPanelMessage('公開投稿を5分ごとに再読込。この端末の設定だけを使用。');
  } catch (error) {
    console.error('X公開投稿の表示に失敗', error);
    clear(container);
    showMessage(container, 'Xの投稿を埋め込めませんでした', true);
    appendProfileLink(container, handle);
    setPanelStatus('表示失敗');
    showPanelMessage('広告ブロックや追跡防止設定でXウィジェットが止まることがあります。', true);
    throw error;
  }
}

function renderEmptyState() {
  const container = document.getElementById('x-following-timeline');
  if (container) {
    showMessage(
      container,
      '上の欄へ @アカウント名 またはXプロフィールURLを追加してください'
    );
  }
  setPanelStatus('未設定');
  showPanelMessage('登録先はこの端末内だけ。複数は空白・改行・読点で追加できます。');
}

async function renderCurrentSelection(onStatus) {
  const accounts = loadAccounts();
  const selectedHandle = loadSelectedHandle(accounts);
  renderAccountControls(accounts, selectedHandle);

  if (!selectedHandle) {
    renderEmptyState();
    onStatus?.('xFollowing', null, false);
    return;
  }

  try {
    await renderProfileTimeline(selectedHandle);
    onStatus?.('xFollowing', null, false);
  } catch {
    onStatus?.('xFollowing', 'X投稿の表示に失敗', true);
  }
}

function bindControls() {
  if (controlsBound) return;
  const form = document.getElementById('x-following-form');
  const input = document.getElementById('x-following-input');
  const select = document.getElementById('x-following-account');
  const removeButton = document.getElementById('x-following-remove');
  if (!form || !input || !select || !removeButton) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const additions = parseXHandles(input.value);
    if (!additions.length) {
      showPanelMessage('@アカウント名かXプロフィールURLを入力してください。', true);
      return;
    }

    const accounts = mergeXHandles(loadAccounts(), additions);
    if (!saveAccounts(accounts)) {
      showPanelMessage('このブラウザへアカウント設定を保存できませんでした。', true);
      return;
    }
    saveSelectedHandle(additions[0]);
    input.value = '';
    await renderCurrentSelection(currentOnStatus);
  });

  select.addEventListener('change', async () => {
    const handle = normalizeXHandle(select.value);
    saveSelectedHandle(handle);
    await renderCurrentSelection(currentOnStatus);
  });

  removeButton.addEventListener('click', async () => {
    const selected = normalizeXHandle(select.value);
    const accounts = loadAccounts().filter(
      (handle) => handle.toLowerCase() !== selected.toLowerCase()
    );
    saveAccounts(accounts);
    saveSelectedHandle(accounts[0] || '');
    await renderCurrentSelection(currentOnStatus);
  });

  controlsBound = true;
}

function renderDemo(onStatus) {
  const container = document.getElementById('x-following-timeline');
  if (container) {
    clear(container);
    const card = el('div', 'x-following-demo');
    card.appendChild(el('span', 'x-following-demo-label', '【公開投稿】'));
    card.appendChild(el('span', '', '@sample_account：新しい投稿の表示例です。'));
    container.appendChild(card);
  }
  setPanelStatus('デモ');
  showPanelMessage('本番では登録した公開アカウントのX公式タイムラインを表示します。');
  onStatus?.('xFollowing', null, false);
}

export async function updateXFollowing(onStatus) {
  currentOnStatus = onStatus;
  bindControls();

  if (new URLSearchParams(location.search).get('demo') === '1') {
    renderDemo(onStatus);
    return;
  }

  await renderCurrentSelection(onStatus);
}
