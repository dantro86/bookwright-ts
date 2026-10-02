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

/** In-memory state for the local booking app. Phase 4 moves persistence to MySQL. */
export class MemoryStore {
  readonly #users = new Map<string, UserRecord>();
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #bookings = new Map<number, BookingRecord>();
  readonly #rooms: ReadonlyMap<number, RoomRecord>;
  #nextBookingId = 1;

  constructor(rooms: readonly RoomRecord[]) {
    this.#rooms = new Map(rooms.map((room) => [room.id, room]));
  }

  findUserByEmail(email: string): UserRecord | undefined {
    return [...this.#users.values()].find((user) => user.email === email);
  }

  findUser(id: string): UserRecord | undefined {
    return this.#users.get(id);
  }

  userCount(): number {
    return this.#users.size;
  }

  createUser(user: Omit<UserRecord, 'id' | 'createdAt'>): UserRecord {
    const record = { ...user, id: randomUUID(), createdAt: new Date().toISOString() };
    this.#users.set(record.id, record);
    return record;
  }

  /** Deletes the user together with everything the user owns. */
  deleteUser(id: string): void {
    this.#users.delete(id);
    for (const [token, session] of this.#sessions) {
      if (session.userId === id) this.#sessions.delete(token);
    }
    for (const [bookingId, booking] of this.#bookings) {
      if (booking.userId === id) this.#bookings.delete(bookingId);
    }
  }

  sessionCount(): number {
    return this.#sessions.size;
  }

  createSession(userId: string, expiresAt: number): SessionRecord {
    const record = { token: randomBytes(24).toString('base64url'), userId, expiresAt };
    this.#sessions.set(record.token, record);
    return record;
  }

  findSession(token: string): SessionRecord | undefined {
    return this.#sessions.get(token);
  }

  deleteSession(token: string): void {
    this.#sessions.delete(token);
  }

  findRoom(id: number): RoomRecord | undefined {
    return this.#rooms.get(id);
  }

  createBooking(booking: Omit<BookingRecord, 'id'>): BookingRecord {
    const record = { ...booking, id: this.#nextBookingId++ };
    this.#bookings.set(record.id, record);
    return record;
  }

  findBooking(id: number): BookingRecord | undefined {
    return this.#bookings.get(id);
  }

  listBookings(userId: string): readonly BookingRecord[] {
    return [...this.#bookings.values()].filter((booking) => booking.userId === userId);
  }

  deleteBooking(id: number): void {
    this.#bookings.delete(id);
  }
}
