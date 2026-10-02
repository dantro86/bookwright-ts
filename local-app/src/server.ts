import { z } from 'zod';
import { buildApp } from './app.ts';
import { ROOMS } from './rooms.ts';
import { MemoryStore } from './store.ts';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  SEED_USER_EMAIL: z.email(),
  SEED_USER_PASSWORD: z.string().min(8),
  SEED_USER_NAME: z.string().min(1).default('Demo User'),
});

const parsed = Env.safeParse(process.env, { reportInput: false });
if (!parsed.success) {
  console.error(`invalid local-app environment:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}
const env = parsed.data;

const app = await buildApp({
  store: new MemoryStore(ROOMS),
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
