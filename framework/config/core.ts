import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { STANDS, defineSection, loadSection, setting, type Environment } from './section.ts';

export const RUN_SEED_ENV = 'BW_RUN_SEED';

export const coreSection = defineSection({
  name: 'core',
  envPrefix: '',
  shape: {
    stand: z.enum(STANDS),
    runSeed: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'expected 1-64 characters [A-Za-z0-9_-]'),
    teardownFailOnError: setting.boolean(),
  },
  defaults: {
    stand: 'local',
    teardownFailOnError: true,
  },
});

export type CoreConfig = z.output<z.ZodObject<typeof coreSection.shape>>;

export function loadCoreConfig(env: Environment = process.env): CoreConfig {
  return loadSection(coreSection, env);
}

/**
 * Called from the runner process before workers start: workers inherit the environment, so every
 * worker derives data from the same run seed. An explicit `BW_RUN_SEED` always wins.
 */
export function ensureRunSeed(env: NodeJS.ProcessEnv = process.env): string {
  env[RUN_SEED_ENV] ??= randomBytes(6).toString('hex');
  return env[RUN_SEED_ENV];
}
