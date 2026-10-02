import type { z } from 'zod';
import { defineSection, loadSection, setting, type Environment } from '../../config/section.ts';

/**
 * restful-booker ships fixed, publicly documented demo credentials (admin / password123). They are
 * not production secrets; they still travel as `Secret` so diagnostics never print them.
 */
export const restfulBookerSection = defineSection({
  name: 'restful-booker',
  envPrefix: 'RESTFUL_BOOKER',
  shape: {
    baseUrl: setting.url(),
    username: setting.string(),
    password: setting.secret(),
    readinessTimeoutMs: setting.positiveInt(),
    readinessIntervalMs: setting.positiveInt(),
  },
  defaults: {
    username: 'admin',
    password: 'password123',
    readinessTimeoutMs: 60_000,
    readinessIntervalMs: 1_000,
  },
  stands: {
    // `local`: baseUrl is exported by scripts/local-stand.sh after Docker publishes a dynamic port.
    prod: { baseUrl: 'https://restful-booker.herokuapp.com' },
  },
});

export type RestfulBookerConfig = z.output<z.ZodObject<typeof restfulBookerSection.shape>>;

export function loadRestfulBookerConfig(env: Environment = process.env): RestfulBookerConfig {
  return loadSection(restfulBookerSection, env);
}
