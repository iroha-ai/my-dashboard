import { clear, el } from './util.js?v=20260905-ai-usage';

const REFRESH_MS = 60_000;

function providerState(provider) {
  if (provider.status === 'error') return 'is-error';
  const remaining = provider.windows?.[0]?.remainingPercent;
  if (remaining != null && remaining <= 20) return 'is-low';
  if (remaining != null && remaining <= 50) return 'is-mid';
  return '';
}

function providerTitle(provider) {
  if (provider.status === 'error') return `${provider.label}: ${provider.error || '取得失敗'}`;
  const windows = (provider.windows || []).map((window) => {
    const reset = window.resetAt ? `、復活 ${window.resetAt}` : '';
    return `${window.label} ${window.remainingPercent ?? '—'}%${reset}`;
  });
  return `${provider.label}: ${windows.join('／') || '使用量なし'}`;
}

function renderProvider(provider) {
  const item = el('div', `ai-usage-provider ${providerState(provider)}`.trim());
  item.title = providerTitle(provider);

  const head = el('div', 'ai-usage-provider-head');
  head.appendChild(el('span', 'ai-usage-provider-name', provider.label));
  const remaining = provider.windows?.[0]?.remainingPercent;
  head.appendChild(el('span', 'ai-usage-provider-value', provider.status === 'error' ? '×' : remaining == null ? '—' : `${remaining}%`));
  item.appendChild(head);

  const bar = el('div', 'ai-usage-bar');
  const fill = document.createElement('span');
  fill.style.width = `${remaining ?? 0}%`;
  bar.appendChild(fill);
  item.appendChild(bar);
  return item;
}

function formatUpdatedAt(fetchedAt) {
  if (!fetchedAt) return '更新時刻なし';
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(fetchedAt));
}

export function startAiUsage(apiUrl) {
  const providers = document.getElementById('ai-usage-providers');
  const updated = document.getElementById('ai-usage-updated');
  const refresh = document.getElementById('ai-usage-refresh');
  if (!providers || !updated || !refresh || !apiUrl) return;

  async function load(force = false) {
    refresh.disabled = true;
    try {
      const url = new URL(apiUrl);
      if (force) url.searchParams.set('refresh', '1');
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      clear(providers);
      providers.append(...(data.providers || []).map(renderProvider));
      updated.textContent = `更新 ${formatUpdatedAt(data.fetchedAt)}`;
    } catch (err) {
      clear(providers);
      providers.appendChild(el('span', 'ai-usage-error', 'ローカル AI Usage に接続できません'));
      updated.textContent = '未接続';
      console.warn('AI Usage の取得に失敗', err);
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', () => void load(true));
  void load();
  setInterval(() => void load(), REFRESH_MS);
}
