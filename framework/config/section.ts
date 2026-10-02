import { z } from 'zod';
import { Secret } from '../diagnostics/secret.ts';

export const STANDS = ['local', 'prod'] as const;
export type StandName = (typeof STANDS)[number];

export type Environment = Readonly<Record<string, string | undefined>>;

type RawValue = string | number | boolean;
type RawValues<Shape extends z.ZodRawShape> = { readonly [Key in keyof Shape]?: RawValue };

/** Field builders that accept both typed stand values and string environment overrides. */
export const setting = {
  string: () => z.string().trim().min(1),
  url: () => z.url({ protocol: /^https?$/ }),
  positiveInt: () => z.coerce.number().int().positive(),
  boolean: () => z.union([z.boolean(), z.stringbool()]),
  secret: () =>
    z
      .string()
      .min(1)
      .transform((value) => Secret.of(value)),
  oneOf: <const Values extends readonly [string, ...string[]]>(values: Values) => z.enum(values),
  optional: <Schema extends z.ZodType>(schema: Schema) => schema.optional(),
};

/**
 * A configuration section owned by one target or concern. Each section declares its own schema,
 * non-secret defaults and stand values beside its owner; there is no central settings catalog.
 */
export interface ConfigSection<Shape extends z.ZodRawShape> {
  /** Environment variable prefix after `BW_`, e.g. `RESTFUL_BOOKER` → `BW_RESTFUL_BOOKER_BASE_URL`. */
  readonly envPrefix: string;
  readonly name: string;
  readonly shape: Shape;
  readonly defaults?: RawValues<Shape>;
  readonly stands?: { readonly [Stand in StandName]?: RawValues<Shape> };
  /** Stands that provide this target at all; omitted means every stand. */
  readonly availableOn?: readonly StandName[];
  /** Cross-field rules; each returned string is one problem in the aggregated report. */
  readonly check?: (config: z.output<z.ZodObject<Shape>>) => readonly string[];
}

export function defineSection<Shape extends z.ZodRawShape>(
  section: ConfigSection<Shape>,
): ConfigSection<Shape> {
  return section;
}

export class ConfigValidationError extends Error {
  override readonly name = 'ConfigValidationError';
  readonly problems: readonly string[];

  constructor(sectionName: string, stand: string, problems: readonly string[]) {
    super(
      [
        `Invalid configuration for "${sectionName}" on stand "${stand}":`,
        ...problems.map((problem) => `  - ${problem}`),
        'Values are never printed. Set the listed environment variables or select another stand with BW_STAND.',
      ].join('\n'),
    );
    this.problems = problems;
  }
}

export function envName(
  section: Pick<ConfigSection<z.ZodRawShape>, 'envPrefix'>,
  key: string,
): string {
  const snake = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  return ['BW', section.envPrefix, snake].filter(Boolean).join('_');
}

export function isAvailable(
  section: Pick<ConfigSection<z.ZodRawShape>, 'availableOn'>,
  stand: StandName,
): boolean {
  return section.availableOn === undefined || section.availableOn.includes(stand);
}

export function resolveStand(env: Environment): StandName {
  const raw = env['BW_STAND'] ?? 'local';
  const parsed = z.enum(STANDS).safeParse(raw);
  if (!parsed.success) {
    throw new ConfigValidationError('stand', raw, [
      `BW_STAND: expected one of ${STANDS.join(', ')}`,
    ]);
  }
  return parsed.data;
}

/**
 * Resolves a section with precedence `environment > stand > defaults` and validates every field in
 * one pass, so a single error lists all missing or invalid settings.
 */
export function loadSection<Shape extends z.ZodRawShape>(
  section: ConfigSection<Shape>,
  env: Environment = process.env,
): z.output<z.ZodObject<Shape>> {
  const stand = resolveStand(env);
  if (!isAvailable(section, stand)) {
    throw new ConfigValidationError(section.name, stand, [
      `target is not available on this stand (available on: ${section.availableOn?.join(', ') ?? ''})`,
    ]);
  }
  const raw: Record<string, RawValue | undefined> = {};
  for (const key of Object.keys(section.shape)) {
    raw[key] =
      env[envName(section, key)] ?? section.stands?.[stand]?.[key] ?? section.defaults?.[key];
  }

  const result = z.object(section.shape).safeParse(raw, { reportInput: false });
  if (result.success) {
    const problems = section.check?.(result.data) ?? [];
    if (problems.length > 0) {
      throw new ConfigValidationError(section.name, stand, problems);
    }
    return result.data;
  }
  const problems = result.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? '');
    const reason = raw[key] === undefined ? 'required but not set' : issue.message;
    return `${key} (${envName(section, key)}): ${reason}`;
  });
  throw new ConfigValidationError(section.name, stand, problems);
}
