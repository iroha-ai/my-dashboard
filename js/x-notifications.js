import { CONFIG } from './config.js?v=20260824-x-notifications-private';
import {
  getGoogleAccessToken,
  resetGoogleAccessToken,
} from './calendar.js?v=20260824-x-notifications-private';
import { clear, el, showMessage } from './util.js?v=20260824-x-notifications-private';

const MAX_ITEMS = 8;
const FILE_ID_STORAGE_KEY = 'my-dashboard:x-notifications-drive-file-id';
const TYPE_LABELS = {
  post: 'ポスト',
  mention: 'メンション',
  reply: '返信',
  like: 'いいね',
  repost: 'リポスト',
  follow: 'フォロー',
  other: '通知',
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeXUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) {
      return '';
    }
    return url.href;
  } catch {
    return '';
  }
}

function timestamp(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

export function normalizeXNotifications(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const seen = new Set();
  const normalized = [];

  for (const raw of items) {
    const summary = cleanText(raw?.summary || raw?.text);
    if (!summary) continue;
    const actor = cleanText(raw?.actor || raw?.account || 'X');
    const occurredAt = cleanText(raw?.occurredAt || raw?.createdAt);
    const link = safeXUrl(raw?.link || raw?.url);
    const type = TYPE_LABELS[raw?.type] ? raw.type : 'other';
    const key = cleanText(raw?.id) || link || `${actor}|${summary}|${occurredAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ id: key, type, actor, summary, occurredAt, link });
  }

  return normalized
    .sort((a, b) => timestamp(b.occurredAt) - timestamp(a.occurredAt))
    .slice(0, MAX_ITEMS);
}

function formatNotificationTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '--:--';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function setSourceStatus(payload) {
  const node = document.getElementById('x-notification-status');
  if (!node) return;
  const date = new Date(payload?.updatedAt || '');
  node.textContent = Number.isNaN(date.getTime())
    ? ''
    : `更新 ${new Intl.DateTimeFormat('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)}`;
}

export function renderXNotifications(payload) {
  const list = document.getElementById('x-notification-list');
  if (!list) return;
  clear(list);
  setSourceStatus(payload);

  if (payload?.status === 'awaiting_first_sync') {
    showMessage(list, 'X通知の初回同期を待っています', false);
    return;
  }
  if (payload?.status === 'error') {
    showMessage(list, payload.message || 'X通知の同期に失敗しました', true);
    return;
  }

  const items = normalizeXNotifications(payload);
  if (!items.length) {
    showMessage(list, '新しいX通知はありません', false);
    return;
  }

  for (const item of items) {
    const li = el('li', 'x-notification-item');
    const row = item.link ? document.createElement('a') : document.createElement('div');
    row.className = 'x-notification-row';
    if (item.link) {
      row.href = item.link;
      row.target = '_blank';
      row.rel = 'noopener';
    }
    row.appendChild(el('span', 'x-notification-time', formatNotificationTime(item.occurredAt)));
    const body = el('span', 'x-notification-body');
    body.appendChild(el('span', 'x-notification-type', `【${TYPE_LABELS[item.type]}】`));
    body.appendChild(document.createTextNode(`${item.actor}：${item.summary}`));
    row.appendChild(body);
    li.appendChild(row);
    list.appendChild(li);
  }
}

function storedFileId() {
  try {
    return localStorage.getItem(FILE_ID_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveFileId(fileId) {
  try {
    localStorage.setItem(FILE_ID_STORAGE_KEY, fileId);
  } catch {
    // 保存できない場合も、その表示中は取得結果を使える。
  }
}

function forgetFileId() {
  try {
    localStorage.removeItem(FILE_ID_STORAGE_KEY);
  } catch {
    // 次回に再検索されるだけなので、削除失敗は無視する。
  }
}

async function fetchPrivateNotifications(token, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = new Error(`X通知の取得に失敗 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function findPrivateNotificationFile(token) {
  const name = CONFIG.xNotificationsDriveFileName;
  if (!name) throw new Error('X通知の非公開ファイル名が未設定です');
  const escapedName = name.replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name = '${escapedName}' and appProperties has { key='dashboardRole' and value='x-notification-alerts' } and trashed = false`,
    spaces: 'drive',
    pageSize: '10',
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime)',
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = new Error(`X通知ファイルの検索に失敗 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return data.files?.[0]?.id || '';
}

async function createPrivateNotificationFile(token) {
  const name = CONFIG.xNotificationsDriveFileName;
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/json',
      appProperties: { dashboardRole: 'x-notification-alerts' },
    }),
  });
  if (!response.ok) {
    const error = new Error(`X通知ファイルの作成に失敗 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  const file = await response.json();
  const initialPayload = {
    schemaVersion: 1,
    status: 'awaiting_first_sync',
    updatedAt: null,
    items: [],
  };
  const upload = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(file.id)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initialPayload),
    }
  );
  if (!upload.ok) {
    const error = new Error(`X通知ファイルの初期化に失敗 (${upload.status})`);
    error.status = upload.status;
    throw error;
  }
  return file.id;
}

async function resolvePrivateNotificationFile(token) {
  let fileId = storedFileId();
  if (fileId) {
    try {
      return { fileId, payload: await fetchPrivateNotifications(token, fileId) };
    } catch (err) {
      if (err?.status !== 404) throw err;
      forgetFileId();
      fileId = '';
    }
  }

  fileId = await findPrivateNotificationFile(token);
  if (!fileId) fileId = await createPrivateNotificationFile(token);
  saveFileId(fileId);
  return { fileId, payload: await fetchPrivateNotifications(token, fileId) };
}

async function refreshNotifications(onStatus, { interactive = false } = {}) {
  const token = await getGoogleAccessToken({ interactive, force: interactive });
  const { payload } = await resolvePrivateNotificationFile(token);
  renderXNotifications(payload);
  onStatus?.('xNotifications', null, false);
}

function demoPayload() {
  const now = new Date();
  return {
    status: 'updated',
    updatedAt: now.toISOString(),
    items: [
      {
        id: 'demo-post',
        type: 'post',
        actor: '@sample_account',
        summary: '通知オンにしているアカウントが新しいポストを公開しました。',
        occurredAt: now.toISOString(),
        link: 'https://x.com/',
      },
      {
        id: 'demo-mention',
        type: 'mention',
        actor: '@another_account',
        summary: 'あなたに関連する新しい通知があります。',
        occurredAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        link: 'https://x.com/notifications',
      },
    ],
  };
}

export async function updateXNotifications(onStatus) {
  if (new URLSearchParams(location.search).get('demo') === '1') {
    renderXNotifications(demoPayload());
    onStatus?.('xNotifications', 'X通知デモ表示中', false);
    return;
  }

  try {
    await refreshNotifications(onStatus);
  } catch (err) {
    console.error('X通知の取得に失敗', err);
    const list = document.getElementById('x-notification-list');
    const needsReconnect = err?.status === 401 || err?.status === 403 || /auth|popup|token/i.test(err?.message || '');
    const reconnect = needsReconnect
      ? async () => {
          try {
            resetGoogleAccessToken();
            await refreshNotifications(onStatus, { interactive: true });
          } catch (retryErr) {
            console.error('X通知への再接続に失敗', retryErr);
            showMessage(list, 'X通知の非公開データへ接続できません', true);
            onStatus?.('xNotifications', 'X通知への接続に失敗', true, reconnect);
          }
        }
      : null;
    showMessage(
      list,
      needsReconnect ? 'Googleへ再接続するとX通知を表示できます' : 'X通知を取得できませんでした',
      true
    );
    onStatus?.(
      'xNotifications',
      needsReconnect ? 'X通知はGoogle再接続が必要' : 'X通知の更新に失敗',
      true,
      reconnect
    );
  }
}
