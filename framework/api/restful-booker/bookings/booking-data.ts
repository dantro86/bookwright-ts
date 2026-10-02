import type { TestData } from '../../../test-data/test-data.ts';
import type { Booking } from './booking-schemas.ts';

const ADDITIONAL_NEEDS = ['Breakfast', 'Late checkout', 'Airport transfer', 'Extra pillow'];

/**
 * A unique, deterministic booking payload. The surname carries a per-test token so parallel tests
 * and repeated runs never collide in searches.
 */
export function bookingRequest(testData: TestData, overrides: Partial<Booking> = {}): Booking {
  const dates = testData.dateRange(1, 14);
  return {
    firstname: testData.firstName(),
    lastname: testData.unique(testData.lastName()),
    totalprice: testData.int(50, 2_000),
    depositpaid: testData.boolean(),
    bookingdates: { checkin: dates.start, checkout: dates.end },
    additionalneeds: testData.pick(ADDITIONAL_NEEDS),
    ...overrides,
  };
}
