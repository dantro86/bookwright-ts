import type { BookingWithRoom } from './bookings-repository.ts';

export const ARCHIVE_USER_ID = '00000000-0000-4000-8000-000000000001';

/** Bookings seeded by docker/mysql/init/002-seed.sql, as the typed join returns them. */
export const SEEDED_ARCHIVE_BOOKINGS: readonly BookingWithRoom[] = Object.freeze([
  {
    id: 1,
    userId: ARCHIVE_USER_ID,
    roomId: 101,
    guestName: 'Ada Lovelace',
    checkin: '2030-02-01',
    checkout: '2030-02-04',
    roomName: 'Single',
    nights: 3,
    totalEur: 237,
  },
  {
    id: 2,
    userId: ARCHIVE_USER_ID,
    roomId: 202,
    guestName: 'Grace Hopper',
    checkin: '2030-03-10',
    checkout: '2030-03-15',
    roomName: 'Family',
    nights: 5,
    totalEur: 945,
  },
  {
    id: 3,
    userId: ARCHIVE_USER_ID,
    roomId: 301,
    guestName: 'Alan Turing',
    checkin: '2030-04-20',
    checkout: '2030-04-21',
    roomName: 'Suite',
    nights: 1,
    totalEur: 249,
  },
]);
