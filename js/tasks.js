import { clear, el, isSameDay, showMessage } from './util.js';

// Google Tasks（デフォルトのタスクリストのみ）。calendar.js が取得した
// アクセストークンをそのまま使い回すので、ここでは認証を持たない。
const TASKS_URL =
  'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks' +
  '?showCompleted=true&showHidden=false&maxResults=100';

function renderTask(task) {
  const li = el('li');
  const isDone = task.status === 'completed';
  const item = el('div', `pickup-item is-task${isDone ? ' is-done' : ''}`);

  item.appendChild(el('div', 'pickup-title', task.title || '(タイトルなし)'));
  if (task.notes) {
    item.appendChild(el('div', 'pickup-place', task.notes));
  }

  li.appendChild(item);
  return li;
}

export function renderTasks(rawTasks) {
  const node = document.getElementById('task-list');
  if (!node) return;

  // 来客・外出と同じく今日ぶんだけに絞る。期限なしのタスクはここには出さない。
  // 完了済みも今日締切なら表示は残し、renderTask側で取り消し線を付ける。
  const today = new Date();
  const tasks = rawTasks.filter(
    (t) => t.due && isSameDay(new Date(t.due), today)
  );

  clear(node);
  if (!tasks.length) {
    node.appendChild(el('li', 'placeholder', '今日締切のタスクはなし'));
  } else {
    for (const task of tasks) node.appendChild(renderTask(task));
  }
}

export async function updateTasks(token, onStatus) {
  const node = document.getElementById('task-list');
  if (!node) return;

  try {
    const res = await fetch(TASKS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      // 原因（権限不足・リスト無し等）を画面だけで判断できるよう、
      // Google側のエラーメッセージまで拾って出す。
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) detail = `${res.status} ${body.error.message}`;
      } catch {
        // 本文がJSONでない場合はステータスコードのみで諦める。
      }
      throw new Error(detail);
    }
    const data = await res.json();

    renderTasks(data.items || []);
    onStatus?.('tasks', null, false);
  } catch (err) {
    console.error('タスクの取得に失敗', err);
    showMessage(node, `タスクを取得できませんでした（${err.message}）`, true);
    onStatus?.('tasks', 'タスクの取得に失敗', true);
  }
}

export function showTasksMessage(message, isError) {
  const node = document.getElementById('task-list');
  if (node) showMessage(node, message, isError);
}
