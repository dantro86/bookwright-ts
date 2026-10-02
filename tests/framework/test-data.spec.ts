import { expect, test } from '@playwright/test';
import { TestData, type TestIdentity } from '../../framework/test-data/test-data.ts';
import { bookingRequest } from '../../framework/api/restful-booker/bookings/booking-data.ts';

const identity = (testId: string, repeatEachIndex = 0): TestIdentity => ({
  testId,
  repeatEachIndex,
  file: `${process.cwd()}/tests/api/sample.spec.ts`,
  line: 12,
  project: { name: 'api' },
});

const sample = (data: TestData) => ({
  token: data.token(),
  unique: data.unique('user'),
  name: `${data.firstName()} ${data.lastName()}`,
  number: data.int(1, 1_000_000),
  dates: data.dateRange(1, 10),
});

test.describe('deterministic test data', () => {
  test('replays identical values for the same run seed and test identity', () => {
    const first = sample(TestData.forTest('seed-1', identity('abc')));
    const replay = sample(TestData.forTest('seed-1', identity('abc')));
    expect(replay).toEqual(first);
  });

  test('differs between tests, repetitions and run seeds', () => {
    const base = sample(TestData.forTest('seed-1', identity('abc')));
    expect(sample(TestData.forTest('seed-1', identity('xyz')))).not.toEqual(base);
    expect(sample(TestData.forTest('seed-1', identity('abc', 1)))).not.toEqual(base);
    expect(sample(TestData.forTest('seed-2', identity('abc')))).not.toEqual(base);
  });

  test('values do not depend on generation order of other tests', () => {
    const solo = sample(TestData.forTest('seed-1', identity('b')));
    sample(TestData.forTest('seed-1', identity('a')));
    const afterOther = sample(TestData.forTest('seed-1', identity('b')));
    expect(afterOther).toEqual(solo);
  });

  test('records an exact replay command', () => {
    const data = TestData.forTest('seed-1', identity('abc'), process.cwd());
    expect(data.replayCommand).toBe(
      'BW_RUN_SEED=seed-1 npx playwright test tests/api/sample.spec.ts:12 --project=api',
    );
    expect(data.testSeed).toMatch(/^[0-9a-f]{16}$/);
  });

  test('generates valid date ranges and domain payloads', () => {
    const data = TestData.forTest('seed-1', identity('dates'));
    for (let i = 0; i < 50; i++) {
      const { start, end } = data.dateRange(1, 14);
      expect(start < end).toBe(true);
    }
    const booking = bookingRequest(data);
    expect(booking.lastname).toMatch(/^[A-Za-z]+-[0-9a-f]{8}$/);
    expect(booking.bookingdates.checkin < booking.bookingdates.checkout).toBe(true);
  });
});

test('sample picks distinct items deterministically in original order', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];
  const first = TestData.forTest('seed-1', identity('sample')).sample(items, 3);
  expect(TestData.forTest('seed-1', identity('sample')).sample(items, 3)).toEqual(first);
  expect(new Set(first).size).toBe(3);
  expect([...first].sort()).toEqual(first);
  expect(() => TestData.forTest('seed-1', identity('sample')).sample(items, 7)).toThrow(RangeError);
});
