import type { Room } from './rooms-repository.ts';

/** Rooms seeded by docker/mysql/init/002-seed.sql. */
export const SEEDED_ROOMS: readonly Room[] = Object.freeze([
  { id: 101, name: 'Single', capacity: 1, nightlyEur: 79 },
  { id: 102, name: 'Double', capacity: 2, nightlyEur: 109 },
  { id: 201, name: 'Twin', capacity: 2, nightlyEur: 115 },
  { id: 202, name: 'Family', capacity: 4, nightlyEur: 189 },
  { id: 301, name: 'Suite', capacity: 2, nightlyEur: 249 },
]);
