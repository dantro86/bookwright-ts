import { expect } from '@playwright/test';
import { test } from '../../../framework/fixtures/core.ts';

const noop = (): Promise<void> => Promise.resolve();
const broken = (): Promise<void> => Promise.reject(new Error('cleanup exploded password=hunter2'));

test('lifo order', ({ teardown }) => {
  teardown.register('first', noop);
  teardown.register('second', noop);
  teardown.register('third', noop);
});

test('passing test with failing cleanup', ({ teardown }) => {
  teardown.register('before broken', noop);
  teardown.register('broken', broken);
  teardown.register('after broken', noop);
});

test('failing test keeps its primary failure', ({ teardown }) => {
  teardown.register('broken', broken);
  throw new Error('primary failure');
});

test('cleanup runs after a failed assertion', ({ teardown }) => {
  teardown.register('release resource', noop);
  expect(1, 'intentional assertion failure').toBe(2);
});
