'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isGreeting } = require('../functions/_chatbot_brain');

test('실제 인사말을 인식한다', () => {
  for (const message of ['안녕하세요', '반갑습니다', '잘 부탁드립니다', '하이', 'hello!', '처음이에요']) {
    assert.equal(isGreeting(message), true, message);
  }
});

test('인사 키워드가 포함된 일반 문장을 인사로 오인하지 않는다', () => {
  for (const message of ['하이브리드 자전거 있나요?', '처음부터 다시 설명해주세요', '안녕히 계세요']) {
    assert.equal(isGreeting(message), false, message);
  }
});
