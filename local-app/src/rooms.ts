import type { RoomRecord } from './store.ts';

/** Deterministic room catalog shared by every local stand. */
export const ROOMS: readonly RoomRecord[] = [
  { id: 101, name: 'Single' },
  { id: 102, name: 'Double' },
  { id: 201, name: 'Twin' },
  { id: 202, name: 'Family' },
  { id: 301, name: 'Suite' },
];
