#!/usr/bin/env node
import assert from 'node:assert/strict';

const { combineSportsNews, getKeywordInfo } = await import('../js/yahoo-sports-news.js');

const soccer = [
  { title: '横浜F・マリノスが新体制を発表', link: 'https://example.com/s1' },
  { title: 'Jリーグの試合結果', link: 'https://example.com/s2' },
];
const motorsports = [
  { title: '角田裕毅がF1テストに参加', link: 'https://example.com/m1' },
  { title: '世界ラリー選手権の結果', link: 'https://example.com/m2' },
];

const combined = combineSportsNews(soccer, motorsports, 4);
assert.deepEqual(
  combined.map((item) => [item.category, item.link]),
  [
    ['soccer', 'https://example.com/s1'],
    ['motorsports', 'https://example.com/m1'],
    ['soccer', 'https://example.com/s2'],
    ['motorsports', 'https://example.com/m2'],
  ]
);

assert.deepEqual(getKeywordInfo(combined[0]), {
  keyword: 'マリノス',
  className: 'is-purple-highlight',
});
assert.deepEqual(getKeywordInfo(combined[1]), {
  keyword: '角田',
  className: 'is-yellow-highlight',
});
assert.deepEqual(getKeywordInfo(combined[2]), {
  keyword: 'サッカー',
  className: 'is-general-highlight',
});
assert.deepEqual(getKeywordInfo(combined[3]), {
  keyword: 'モータースポーツ',
  className: 'is-general-highlight',
});

console.log('サッカー・モータースポーツ混合表示テスト: OK');
