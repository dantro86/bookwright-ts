import type { TestData } from '../../test-data/test-data.ts';
import { SEEDED_ROOMS } from '../rooms/room-expectations.ts';
import type { NewBookingRecord } from './bookings-repository.ts';

/** A booking row for an existing owner; the guest name carries a per-test token. */
export function bookingRecord(testData: TestData, userId: string): NewBookingRecord {
  const dates = testData.dateRange(1, 10);
  return {
    userId,
    roomId: testData.pick(SEEDED_ROOMS).id,
    guestName: `${testData.firstName()} ${testData.unique(testData.lastName())}`,
    checkin: dates.start,
    checkout: dates.end,
  };
}
