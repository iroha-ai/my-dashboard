import { clear, el } from './util.js?v=20260825-soccer-motorsports';

const ACCOUNTS_STORAGE_KEY = 'my-dashboard:x-following-accounts:v1';
const SELECTED_STORAGE_KEY = 'my-dashboard:x-following-selected:v1';
const X_WINDOW_NAME = 'my-dashboard-x-following';
const X_WINDOW_FEATURES = [
  'popup=yes',
  'width=760',
  'height=900',
  'resizable=yes',
  'scrollbars=yes',
].join(',');
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

export function buildXProfileUrl(handle) {
  const normalized = normalizeXHandle(handle);
  return normalized ? `https://x.com/${encodeURIComponent(normalized)}` : '';
}

export function openXProfileWindow(handle, openWindow = globalThis.open) {
  const url = buildXProfileUrl(handle);
  if (!url || typeof openWindow !== 'function') return false;

  const popup = openWindow(url, X_WINDOW_NAME, X_WINDOW_FEATURES);
  if (!popup) return false;
  try {
    popup.opener = null;
  } catch {
    // 別ウィンドウは開けているため、openerを変更できなくても表示は継続する。
  }
  return true;
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
  const openButton = document.getElementById('x-following-open');
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
  if (openButton) {
    openButton.disabled = accounts.length === 0;
    openButton.textContent = selectedHandle
      ? `@${selectedHandle}の投稿を別ウィンドウで開く`
      : '選択中の投稿を別ウィンドウで開く';
  }
}

function renderEmptyState() {
  setPanelStatus('未設定');
  showPanelMessage('登録先はこの端末内だけ。追加すると別ウィンドウで開けます。');
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

  setPanelStatus(`@${selectedHandle}`);
  showPanelMessage('ダッシュボードを残したまま、Xを独立ウィンドウで開きます。');
  onStatus?.('xFollowing', null, false);
}

function bindControls() {
  if (controlsBound) return;
  const form = document.getElementById('x-following-form');
  const input = document.getElementById('x-following-input');
  const select = document.getElementById('x-following-account');
  const removeButton = document.getElementById('x-following-remove');
  const openButton = document.getElementById('x-following-open');
  if (!form || !input || !select || !removeButton || !openButton) return;

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

  openButton.addEventListener('click', () => {
    const handle = normalizeXHandle(select.value);
    if (!handle) {
      showPanelMessage('先に表示するXアカウントを選んでください。', true);
      return;
    }

    const opened = openXProfileWindow(handle, globalThis.open?.bind(globalThis));
    if (!opened) {
      showPanelMessage('別ウィンドウを開けませんでした。ポップアップを許可してください。', true);
      return;
    }
    showPanelMessage(`@${handle}を別ウィンドウで開きました。`);
  });

  controlsBound = true;
}

function renderDemo(onStatus) {
  renderAccountControls(['sample_account'], 'sample_account');
  setPanelStatus('デモ');
  showPanelMessage('本番では登録した公開アカウントを別ウィンドウで開きます。');
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
