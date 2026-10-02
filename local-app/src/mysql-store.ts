import { randomUUID } from 'node:crypto';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import {
  newSessionToken,
  type BookingRecord,
  type NewBooking,
  type NewUser,
  type RoomRecord,
  type SessionRecord,
  type Store,
  type UserRecord,
} from './store.ts';

export interface MySqlOptions {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
}

interface SessionRow extends RowDataPacket {
  token: string;
  user_id: string;
  expires_at: Date;
}

interface RoomRow extends RowDataPacket {
  id: number;
  name: string;
}

interface BookingRow extends RowDataPacket {
  id: number;
  user_id: string;
  room_id: number;
  guest_name: string;
  checkin: string;
  checkout: string;
}

const toUser = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  passwordHash: row.password_hash,
  createdAt: row.created_at.toISOString(),
});

const toBooking = (row: BookingRow): BookingRecord => ({
  id: row.id,
  userId: row.user_id,
  roomId: row.room_id,
  guestName: row.guest_name,
  checkin: row.checkin,
  checkout: row.checkout,
});

/** MySQL persistence. Schema and seed live in docker/mysql/init. */
export class MySqlStore implements Store {
  readonly #pool: Pool;

  constructor(options: MySqlOptions) {
    this.#pool = mysql.createPool({
      ...options,
      connectionLimit: 10,
      timezone: 'Z',
      // DATE columns stay `YYYY-MM-DD` strings; DATETIME columns become Date objects.
      dateStrings: ['DATE'],
    });
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const [rows] = await this.#pool.execute<UserRow[]>('SELECT * FROM users WHERE email = ?', [
      email,
    ]);
    return rows[0] && toUser(rows[0]);
  }

  async findUser(id: string): Promise<UserRecord | undefined> {
    const [rows] = await this.#pool.execute<UserRow[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] && toUser(rows[0]);
  }

  async createUser(user: NewUser): Promise<UserRecord> {
    const record = { ...user, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.#pool.execute(
      'INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [
        record.id,
        record.email,
        record.displayName,
        record.passwordHash,
        new Date(record.createdAt),
      ],
    );
    return record;
  }

  async deleteUser(id: string): Promise<void> {
    // Sessions and bookings cascade through foreign keys.
    await this.#pool.execute('DELETE FROM users WHERE id = ?', [id]);
  }

  async createSession(userId: string, expiresAt: number): Promise<SessionRecord> {
    const record = { token: newSessionToken(), userId, expiresAt };
    await this.#pool.execute('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
      record.token,
      userId,
      new Date(expiresAt),
    ]);
    return record;
  }

  async findSession(token: string): Promise<SessionRecord | undefined> {
    const [rows] = await this.#pool.execute<SessionRow[]>(
      'SELECT * FROM sessions WHERE token = ?',
      [token],
    );
    const row = rows[0];
    return row && { token: row.token, userId: row.user_id, expiresAt: row.expires_at.getTime() };
  }

  async deleteSession(token: string): Promise<void> {
    await this.#pool.execute('DELETE FROM sessions WHERE token = ?', [token]);
  }

  async listRooms(): Promise<readonly RoomRecord[]> {
    const [rows] = await this.#pool.execute<RoomRow[]>('SELECT id, name FROM rooms ORDER BY id');
    return rows.map(({ id, name }) => ({ id, name }));
  }

  async findRoom(id: number): Promise<RoomRecord | undefined> {
    const [rows] = await this.#pool.execute<RoomRow[]>('SELECT id, name FROM rooms WHERE id = ?', [
      id,
    ]);
    return rows[0] && { id: rows[0].id, name: rows[0].name };
  }

  async createBooking(booking: NewBooking): Promise<BookingRecord> {
    const [result] = await this.#pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO bookings (user_id, room_id, guest_name, checkin, checkout) VALUES (?, ?, ?, ?, ?)',
      [booking.userId, booking.roomId, booking.guestName, booking.checkin, booking.checkout],
    );
    return { ...booking, id: result.insertId };
  }

  async findBooking(id: number): Promise<BookingRecord | undefined> {
    const [rows] = await this.#pool.execute<BookingRow[]>('SELECT * FROM bookings WHERE id = ?', [
      id,
    ]);
    return rows[0] && toBooking(rows[0]);
  }

  async listBookings(userId: string): Promise<readonly BookingRecord[]> {
    const [rows] = await this.#pool.execute<BookingRow[]>(
      'SELECT * FROM bookings WHERE user_id = ? ORDER BY id',
      [userId],
    );
    return rows.map(toBooking);
  }

  async deleteBooking(id: number): Promise<void> {
    await this.#pool.execute('DELETE FROM bookings WHERE id = ?', [id]);
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}
