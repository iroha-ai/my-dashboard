import { clear, el, formatMonthDay, showMessage, weekdayLabel } from './util.js';

// Google Tasks（デフォルトのタスクリストのみ）。calendar.js が取得した
// アクセストークンをそのまま使い回すので、ここでは認証を持たない。
const TASKS_URL =
  'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks' +
  '?showCompleted=false&showHidden=false&maxResults=100';

function sortTasks(tasks) {
  // 期限のあるものを先に、期限順。期限なしは後ろにまとめる。
  return [...tasks].sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return new Date(a.due) - new Date(b.due);
  });
}

function renderTask(task) {
  const li = el('li');
  const item = el('div', 'pickup-item is-task');

  if (task.due) {
    // Tasks APIの due は日付のみの意味を持つ（時刻は常に00:00 UTC）。
    const d = new Date(task.due);
    item.appendChild(
      el('div', 'pickup-time', `${formatMonthDay(d)}（${weekdayLabel(d)}）まで`)
    );
  }

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

  const tasks = sortTasks(rawTasks.filter((t) => t.status !== 'completed'));

  clear(node);
  if (!tasks.length) {
    node.appendChild(el('li', 'placeholder', '未完了のタスクはありません'));
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
