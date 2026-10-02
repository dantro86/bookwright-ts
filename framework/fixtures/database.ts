import { test as core } from './core.ts';
import { DbBookingSteps } from '../db/bookings/booking-steps.ts';
import { loadDatabaseConfig, type DatabaseConfig } from '../db/config.ts';
import { Database } from '../db/database.ts';

export interface DatabaseWorkerFixtures {
  readonly databaseConfig: DatabaseConfig;
  /**
   * MySQL through the SSH bastion. Lazy: the tunnel and pool open on the first query of the worker
   * and close in order (pool, SSH channels, SSH client) when the worker ends.
   */
  readonly database: Database;
}

export interface DatabaseTestFixtures {
  readonly dbBookingSteps: DbBookingSteps;
}

export const test = core.extend<DatabaseTestFixtures, DatabaseWorkerFixtures>({
  databaseConfig: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      await use(loadDatabaseConfig());
    },
    { scope: 'worker' },
  ],

  database: [
    async ({ databaseConfig }, use) => {
      const database = Database.throughBastion(databaseConfig);
      await use(database);
      await database.close();
    },
    { scope: 'worker' },
  ],

  dbBookingSteps: async ({ database, teardown }, use) => {
    await use(new DbBookingSteps(database.bookings, teardown));
  },
});
