import type { TestData } from '../../../test-data/test-data.ts';
import type { NewLocalBooking } from './booking-schemas.ts';

/** Rooms seeded by the local app (mirrors local-app/src/rooms.ts; the oracle never imports the SUT). */
export const LOCAL_ROOMS: Readonly<Record<number, string>> = Object.freeze({
  101: 'Single',
  102: 'Double',
  201: 'Twin',
  202: 'Family',
  301: 'Suite',
});

const LOCAL_ROOM_IDS = Object.keys(LOCAL_ROOMS).map(Number);

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
