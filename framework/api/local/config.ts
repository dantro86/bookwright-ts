import type { z } from 'zod';
import { defineSection, loadSection, setting, type Environment } from '../../config/section.ts';

/**
 * The local booking app exists only on the `local` stand. Its seeded account is a documented,
 * non-production demo credential shared with docker/compose.yaml.
 */
export const localAppSection = defineSection({
  name: 'local-app',
  envPrefix: 'LOCAL_APP',
  availableOn: ['local'],
  shape: {
    baseUrl: setting.url(),
    existingUserEmail: setting.string(),
    existingUserPassword: setting.secret(),
  },
  defaults: {
    existingUserEmail: 'demo.user@bookwright.test',
    existingUserPassword: 'demo-password-not-a-secret',
  },
});

export type LocalAppConfig = z.output<z.ZodObject<typeof localAppSection.shape>>;

export function loadLocalAppConfig(env: Environment = process.env): LocalAppConfig {
  return loadSection(localAppSection, env);
}
