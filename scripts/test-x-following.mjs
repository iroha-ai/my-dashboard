#!/usr/bin/env node
import assert from 'node:assert/strict';

const {
  mergeXHandles,
  normalizeXHandle,
  parseXHandles,
  updateXFollowing,
} = await import('../js/x-following.js');

assert.equal(normalizeXHandle('@sample_user'), 'sample_user');
assert.equal(normalizeXHandle('https://x.com/sample_user'), 'sample_user');
assert.equal(
  normalizeXHandle('https://twitter.com/sample_user/status/123?ref=test'),
  'sample_user'
);
assert.equal(normalizeXHandle('https://x.com/home'), '');
assert.equal(normalizeXHandle('not-valid-handle'), '');
assert.equal(normalizeXHandle('abcdefghijklmnop'), '');

assert.deepEqual(
  parseXHandles('@sample_user, https://x.com/second_user\nSAMPLE_USER、@third_user'),
  ['sample_user', 'second_user', 'third_user']
);

assert.deepEqual(
  mergeXHandles(['sample_user', 'second_user'], ['SAMPLE_USER', 'third_user']),
  ['sample_user', 'second_user', 'third_user']
);

class FakeNode {
  constructor(tagName = '') {
    this.tagName = tagName;
    this.children = [];
    this.className = '';
    this.dataset = {};
    this.disabled = false;
    this.value = '';
    this._textContent = '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
  }

  addEventListener() {}

  setAttribute(name, value) {
    this[name] = value;
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

const nodes = {
  'x-following-account': new FakeNode('select'),
  'x-following-remove': new FakeNode('button'),
  'x-following-form': new FakeNode('form'),
  'x-following-input': new FakeNode('input'),
  'x-following-message': new FakeNode('div'),
  'x-following-status': new FakeNode('span'),
  'x-following-timeline': new FakeNode('div'),
};

globalThis.document = {
  head: new FakeNode('head'),
  createElement: (tagName) => new FakeNode(tagName),
  getElementById: (id) => nodes[id] || null,
};
globalThis.localStorage = {
  getItem: () => null,
  removeItem: () => {},
  setItem: () => {},
};
globalThis.location = { search: '?demo=1' };

let completed = false;
await updateXFollowing((key, message, isError) => {
  completed = key === 'xFollowing' && message === null && isError === false;
});
assert.equal(completed, true);
assert.equal(nodes['x-following-status'].textContent, 'デモ');
assert.match(nodes['x-following-timeline'].textContent, /@sample_account/);

console.log('Xフォロー中アカウントの正規化テスト: OK');
