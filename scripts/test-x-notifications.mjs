#!/usr/bin/env node
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tagName = '') {
    this.tagName = tagName;
    this.children = [];
    this.className = '';
    this._textContent = '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
  }

  get firstChild() {
    return this.children[0] || null;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join('');
  }
}

const list = new FakeNode('ul');
const status = new FakeNode('span');
globalThis.document = {
  createElement: (tagName) => new FakeNode(tagName),
  createTextNode: (text) => {
    const node = new FakeNode('#text');
    node.textContent = text;
    return node;
  },
  getElementById: (id) => ({
    'x-notification-list': list,
    'x-notification-status': status,
  })[id] || null,
};

const { normalizeXNotifications, renderXNotifications } =
  await import('../js/x-notifications.js');

const items = normalizeXNotifications({
  items: [
    {
      id: 'older',
      type: 'mention',
      actor: '  @older  ',
      summary: '  古い 通知  ',
      occurredAt: '2026-08-24T01:00:00.000Z',
      link: 'https://x.com/older/status/1',
    },
    {
      id: 'newer',
      type: 'post',
      actor: '@newer',
      summary: '新しい通知',
      occurredAt: '2026-08-24T02:00:00.000Z',
      link: 'https://x.com/newer/status/2',
    },
    {
      id: 'newer',
      type: 'post',
      actor: '@duplicate',
      summary: '重複通知',
      occurredAt: '2026-08-24T03:00:00.000Z',
      link: 'https://x.com/duplicate/status/3',
    },
    {
      id: 'unsafe',
      type: 'unknown',
      actor: '@unsafe',
      summary: '外部リンク',
      occurredAt: '2026-08-24T00:00:00.000Z',
      link: 'https://example.com/not-x',
    },
    { id: 'blank', summary: '   ' },
  ],
});

assert.equal(items.length, 3);
assert.deepEqual(items.map((item) => item.id), ['newer', 'older', 'unsafe']);
assert.equal(items[1].actor, '@older');
assert.equal(items[1].summary, '古い 通知');
assert.equal(items[2].type, 'other');
assert.equal(items[2].link, '');

renderXNotifications({
  status: 'updated',
  updatedAt: '2026-08-24T02:00:00.000Z',
  items: [items[0]],
});
assert.equal(list.children.length, 1);
assert.equal(list.children[0].className, 'x-notification-item');
assert.equal(list.children[0].children[0].tagName, 'a');
assert.match(list.children[0].textContent, /【ポスト】@newer：新しい通知/);

renderXNotifications({ status: 'awaiting_first_sync', items: [] });
assert.equal(list.children.length, 1);
assert.match(list.textContent, /初回同期/);

console.log('X通知の正規化・表示テスト: OK');
