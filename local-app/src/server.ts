import { z } from 'zod';
import { buildApp } from './app.ts';
import { MySqlStore } from './mysql-store.ts';
import { ROOMS } from './rooms.ts';
import { MemoryStore, type Store } from './store.ts';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  SEED_USER_EMAIL: z.email(),
  SEED_USER_PASSWORD: z.string().min(8),
  SEED_USER_NAME: z.string().min(1).default('Demo User'),
  // Without DB_HOST the app keeps state in memory (handy for local debugging).
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1).default('bookwright'),
  DB_USER: z.string().min(1).default('bookwright'),
  DB_PASSWORD: z.string().default(''),
});

const parsed = Env.safeParse(process.env, { reportInput: false });
if (!parsed.success) {
  console.error(`invalid local-app environment:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}
const env = parsed.data;

const store: Store =
  env.DB_HOST === undefined
    ? new MemoryStore(ROOMS)
    : new MySqlStore({
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      });

const app = await buildApp({
  store,
  defaultSessionTtlSeconds: env.SESSION_TTL_SECONDS,
  seedUsers: [
    {
      email: env.SEED_USER_EMAIL,
      password: env.SEED_USER_PASSWORD,
      displayName: env.SEED_USER_NAME,
    },
  ],
  logger: true,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: '0.0.0.0', port: env.PORT });
