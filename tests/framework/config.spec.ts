import { expect, test } from '@playwright/test';
import { inspect } from 'node:util';
import {
  ConfigValidationError,
  defineSection,
  envName,
  loadSection,
  setting,
} from '../../framework/config/section.ts';
import { REDACTED } from '../../framework/diagnostics/secret.ts';

const section = defineSection({
  name: 'sample',
  envPrefix: 'SAMPLE',
  shape: {
    baseUrl: setting.url(),
    apiKey: setting.secret(),
    timeoutMs: setting.positiveInt(),
    verbose: setting.boolean(),
  },
  defaults: { timeoutMs: 1_000, verbose: false },
  stands: {
    local: { baseUrl: 'http://localhost:1234', timeoutMs: 2_000 },
    prod: { baseUrl: 'https://prod.example.test' },
  },
});

test.describe('configuration', () => {
  test('derives environment variable names from section prefix and key', () => {
    expect(envName(section, 'baseUrl')).toBe('BW_SAMPLE_BASE_URL');
    expect(envName({ envPrefix: '' }, 'runSeed')).toBe('BW_RUN_SEED');
  });

  test('applies precedence: environment over stand over defaults', () => {
    const fromStand = loadSection(section, { BW_STAND: 'local', BW_SAMPLE_API_KEY: 'k-1234' });
    expect(fromStand).toMatchObject({
      baseUrl: 'http://localhost:1234',
      timeoutMs: 2_000,
      verbose: false,
    });

    const fromDefaults = loadSection(section, { BW_STAND: 'prod', BW_SAMPLE_API_KEY: 'k-1234' });
    expect(fromDefaults).toMatchObject({ baseUrl: 'https://prod.example.test', timeoutMs: 1_000 });

    const fromEnv = loadSection(section, {
      BW_STAND: 'local',
      BW_SAMPLE_API_KEY: 'k-1234',
      BW_SAMPLE_BASE_URL: 'http://override.test:9',
      BW_SAMPLE_TIMEOUT_MS: '5',
      BW_SAMPLE_VERBOSE: 'true',
    });
    expect(fromEnv).toMatchObject({
      baseUrl: 'http://override.test:9',
      timeoutMs: 5,
      verbose: true,
    });
  });

  test('reports every missing or invalid setting at once without printing values', () => {
    const leakingValue = 'not-a-url-but-a-secret-looking-value';
    const load = () =>
      loadSection(section, {
        BW_STAND: 'local',
        BW_SAMPLE_BASE_URL: leakingValue,
        BW_SAMPLE_TIMEOUT_MS: '-1',
      });

    expect(load).toThrow(ConfigValidationError);
    const error = (() => {
      try {
        load();
      } catch (caught) {
        return caught as ConfigValidationError;
      }
      throw new Error('expected a validation error');
    })();
    expect(error.problems).toHaveLength(3);
    expect(error.message).toContain('apiKey (BW_SAMPLE_API_KEY): required but not set');
    expect(error.message).toContain('baseUrl (BW_SAMPLE_BASE_URL)');
    expect(error.message).toContain('timeoutMs (BW_SAMPLE_TIMEOUT_MS)');
    expect(error.message).not.toContain(leakingValue);
  });

  test('rejects an unknown stand', () => {
    expect(() => loadSection(section, { BW_STAND: 'staging' })).toThrow(
      /BW_STAND: expected one of local, prod/,
    );
  });

  test('wraps secret settings so they never serialize', () => {
    const config = loadSection(section, {
      BW_STAND: 'local',
      BW_SAMPLE_API_KEY: 'super-secret-key',
    });
    expect(config.apiKey.reveal()).toBe('super-secret-key');
    expect(JSON.stringify(config)).not.toContain('super-secret-key');
    expect(String(config.apiKey)).toBe(REDACTED);
    expect(inspect(config)).not.toContain('super-secret-key');
  });
});
