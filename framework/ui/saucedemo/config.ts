import type { z } from 'zod';
import { defineSection, loadSection, setting, type Environment } from '../../config/section.ts';

/** Sauce Demo publishes its demo accounts and shared password on the login page itself. */
export const sauceDemoSection = defineSection({
  name: 'saucedemo',
  envPrefix: 'SAUCE_DEMO',
  shape: {
    baseUrl: setting.url(),
    standardUsername: setting.string(),
    lockedOutUsername: setting.string(),
    password: setting.secret(),
  },
  defaults: {
    baseUrl: 'https://www.saucedemo.com',
    standardUsername: 'standard_user',
    lockedOutUsername: 'locked_out_user',
    password: 'secret_sauce',
  },
});

export type SauceDemoConfig = z.output<z.ZodObject<typeof sauceDemoSection.shape>>;

export function loadSauceDemoConfig(env: Environment = process.env): SauceDemoConfig {
  return loadSection(sauceDemoSection, env);
}
