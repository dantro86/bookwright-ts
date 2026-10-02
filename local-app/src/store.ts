import { randomBytes, randomUUID } from 'node:crypto';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly createdAt: string;
}

export interface SessionRecord {
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: number;
}

export interface RoomRecord {
  readonly id: number;
  readonly name: string;
}

export interface BookingRecord {
  readonly id: number;
  readonly userId: string;
  readonly roomId: number;
  readonly guestName: string;
  readonly checkin: string;
  readonly checkout: string;
}

export type NewUser = Omit<UserRecord, 'id' | 'createdAt'>;
export type NewBooking = Omit<BookingRecord, 'id'>;

/** Persistence port of the local app: in memory for in-process tests, MySQL on the stand. */
export interface Store {
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUser(id: string): Promise<UserRecord | undefined>;
  createUser(user: NewUser): Promise<UserRecord>;
  /** Deletes the user together with everything the user owns. */
  deleteUser(id: string): Promise<void>;
  createSession(userId: string, expiresAt: number): Promise<SessionRecord>;
  findSession(token: string): Promise<SessionRecord | undefined>;
  deleteSession(token: string): Promise<void>;
  listRooms(): Promise<readonly RoomRecord[]>;
  findRoom(id: number): Promise<RoomRecord | undefined>;
  createBooking(booking: NewBooking): Promise<BookingRecord>;
  findBooking(id: number): Promise<BookingRecord | undefined>;
  listBookings(userId: string): Promise<readonly BookingRecord[]>;
  deleteBooking(id: number): Promise<void>;
  close(): Promise<void>;
}

export function newSessionToken(): string {
  return randomBytes(24).toString('base64url');
}

export class MemoryStore implements Store {
  readonly #users = new Map<string, UserRecord>();
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #bookings = new Map<number, BookingRecord>();
  readonly #rooms: ReadonlyMap<number, RoomRecord>;
  #nextBookingId = 1;

  constructor(rooms: readonly RoomRecord[]) {
    this.#rooms = new Map(rooms.map((room) => [room.id, room]));
  }

  /** Test introspection: number of stored users. */
  userCount(): number {
    return this.#users.size;
  }

  /** Test introspection: number of stored sessions. */
  sessionCount(): number {
    return this.#sessions.size;
  }

  findUserByEmail(email: string): Promise<UserRecord | undefined> {
    return Promise.resolve([...this.#users.values()].find((user) => user.email === email));
  }

  findUser(id: string): Promise<UserRecord | undefined> {
    return Promise.resolve(this.#users.get(id));
  }

  createUser(user: NewUser): Promise<UserRecord> {
    const record = { ...user, id: randomUUID(), createdAt: new Date().toISOString() };
    this.#users.set(record.id, record);
    return Promise.resolve(record);
  }

  deleteUser(id: string): Promise<void> {
    this.#users.delete(id);
    for (const [token, session] of this.#sessions) {
      if (session.userId === id) this.#sessions.delete(token);
    }
    for (const [bookingId, booking] of this.#bookings) {
      if (booking.userId === id) this.#bookings.delete(bookingId);
    }
    return Promise.resolve();
  }

  createSession(userId: string, expiresAt: number): Promise<SessionRecord> {
    const record = { token: newSessionToken(), userId, expiresAt };
    this.#sessions.set(record.token, record);
    return Promise.resolve(record);
  }

  findSession(token: string): Promise<SessionRecord | undefined> {
    return Promise.resolve(this.#sessions.get(token));
  }

  deleteSession(token: string): Promise<void> {
    this.#sessions.delete(token);
    return Promise.resolve();
  }

  listRooms(): Promise<readonly RoomRecord[]> {
    return Promise.resolve([...this.#rooms.values()]);
  }

  findRoom(id: number): Promise<RoomRecord | undefined> {
    return Promise.resolve(this.#rooms.get(id));
  }

  createBooking(booking: NewBooking): Promise<BookingRecord> {
    const record = { ...booking, id: this.#nextBookingId++ };
    this.#bookings.set(record.id, record);
    return Promise.resolve(record);
  }

  findBooking(id: number): Promise<BookingRecord | undefined> {
    return Promise.resolve(this.#bookings.get(id));
  }

  listBookings(userId: string): Promise<readonly BookingRecord[]> {
    return Promise.resolve(
      [...this.#bookings.values()].filter((booking) => booking.userId === userId),
    );
  }

  deleteBooking(id: number): Promise<void> {
    this.#bookings.delete(id);
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
