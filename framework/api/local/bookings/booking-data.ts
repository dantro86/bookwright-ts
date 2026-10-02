import type { TestData } from '../../../test-data/test-data.ts';
import type { NewLocalBooking } from './booking-schemas.ts';

/** Room ids seeded by the local app (local-app/src/rooms.ts). */
export const LOCAL_ROOM_IDS = [101, 102, 201, 202, 301] as const;

export function localBookingRequest(
  testData: TestData,
  overrides: Partial<NewLocalBooking> = {},
): NewLocalBooking {
  const dates = testData.dateRange(1, 10);
  return {
    roomId: testData.pick(LOCAL_ROOM_IDS),
    guestName: `${testData.firstName()} ${testData.unique(testData.lastName())}`,
    checkin: dates.start,
    checkout: dates.end,
    ...overrides,
  };
}
