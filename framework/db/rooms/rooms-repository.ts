import { z } from 'zod';
import { RequiredEntityNotFoundError } from '../../api/http/errors.ts';
import type { QueryRunner } from '../database.ts';

const RoomRow = z
  .object({
    id: z.number().int(),
    name: z.string(),
    capacity: z.number().int(),
    nightly_eur: z.number(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    nightlyEur: row.nightly_eur,
  }));

export type Room = z.output<typeof RoomRow>;

export class RoomsRepository {
  readonly #db: QueryRunner;

  constructor(db: QueryRunner) {
    this.#db = db;
  }

  async listAll(): Promise<readonly Room[]> {
    return this.#db.rows(
      'rooms.listAll',
      'SELECT id, name, capacity, nightly_eur FROM rooms ORDER BY id',
      [],
      RoomRow,
    );
  }

  async findById(id: number): Promise<Room | undefined> {
    const rows = await this.#db.rows(
      'rooms.findById',
      'SELECT id, name, capacity, nightly_eur FROM rooms WHERE id = ?',
      [id],
      RoomRow,
    );
    return rows[0];
  }

  async requireById(id: number): Promise<Room> {
    const room = await this.findById(id);
    if (room === undefined) {
      throw new RequiredEntityNotFoundError({
        entity: 'room',
        criterion: `id=${id}`,
        source: 'rooms.findById',
        count: 0,
      });
    }
    return room;
  }
}
