import { z } from 'zod';
import { RequiredEntityNotFoundError } from '../../api/http/errors.ts';
import type { QueryRunner } from '../database.ts';

const BOOKING_COLUMNS = 'b.id, b.user_id, b.room_id, b.guest_name, b.checkin, b.checkout';

const BookingRow = z
  .object({
    id: z.number().int(),
    user_id: z.string(),
    room_id: z.number().int(),
    guest_name: z.string(),
    checkin: z.iso.date(),
    checkout: z.iso.date(),
  })
  .transform((row) => ({
    id: row.id,
    userId: row.user_id,
    roomId: row.room_id,
    guestName: row.guest_name,
    checkin: row.checkin,
    checkout: row.checkout,
  }));

const BookingWithRoomRow = z
  .object({ room_name: z.string(), nightly_eur: z.number(), nights: z.number().int() })
  .and(BookingRow.in)
  .transform((row) => ({
    ...BookingRow.parse(row),
    roomName: row.room_name,
    nights: row.nights,
    totalEur: Math.round(row.nights * row.nightly_eur * 100) / 100,
  }));

export type BookingRecord = z.output<typeof BookingRow>;
export type BookingWithRoom = z.output<typeof BookingWithRoomRow>;
export type NewBookingRecord = Omit<BookingRecord, 'id'>;

export class BookingsRepository {
  readonly #db: QueryRunner;

  constructor(db: QueryRunner) {
    this.#db = db;
  }

  /** Optional lookup: absence is an expected outcome (e.g. after deletion). */
  async findById(id: number): Promise<BookingRecord | undefined> {
    const rows = await this.#db.rows(
      'bookings.findById',
      `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.id = ?`,
      [id],
      BookingRow,
    );
    return rows[0];
  }

  async requireById(id: number): Promise<BookingRecord> {
    const booking = await this.findById(id);
    if (booking === undefined) {
      throw notFound(`id=${id}`, 'bookings.findById', 0);
    }
    return booking;
  }

  /** Typed join with rooms: room name, nights and total price computed by MySQL. */
  async requireWithRoom(id: number): Promise<BookingWithRoom> {
    const rows = await this.#db.rows(
      'bookings.withRoom',
      `SELECT ${BOOKING_COLUMNS}, r.name AS room_name, r.nightly_eur, DATEDIFF(b.checkout, b.checkin) AS nights
         FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.id = ?`,
      [id],
      BookingWithRoomRow,
    );
    const [row] = rows;
    if (rows.length !== 1 || row === undefined) {
      throw notFound(`id=${id}`, 'bookings.withRoom', rows.length);
    }
    return row;
  }

  async listWithRoomsByUser(userId: string): Promise<readonly BookingWithRoom[]> {
    return this.#db.rows(
      'bookings.listWithRoomsByUser',
      `SELECT ${BOOKING_COLUMNS}, r.name AS room_name, r.nightly_eur, DATEDIFF(b.checkout, b.checkin) AS nights
         FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.user_id = ?
        ORDER BY b.id`,
      [userId],
      BookingWithRoomRow,
    );
  }

  async insert(booking: NewBookingRecord): Promise<BookingRecord> {
    const { insertId } = await this.#db.execute(
      'bookings.insert',
      'INSERT INTO bookings (user_id, room_id, guest_name, checkin, checkout) VALUES (?, ?, ?, ?, ?)',
      [booking.userId, booking.roomId, booking.guestName, booking.checkin, booking.checkout],
    );
    return { ...booking, id: insertId };
  }

  /** Returns the number of deleted rows (0 when already absent). */
  async deleteById(id: number): Promise<number> {
    const { affectedRows } = await this.#db.execute(
      'bookings.deleteById',
      'DELETE FROM bookings WHERE id = ?',
      [id],
    );
    return affectedRows;
  }
}

function notFound(criterion: string, source: string, count: number): RequiredEntityNotFoundError {
  return new RequiredEntityNotFoundError({ entity: 'booking row', criterion, source, count });
}
