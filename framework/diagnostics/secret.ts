import { inspect } from 'node:util';

export const REDACTED = '[REDACTED]';

/** Values shorter than this are not scrubbed from free text: masking them would destroy diagnostics. */
const MIN_SCRUBBABLE_LENGTH = 4;

const knownSecretValues = new Set<string>();

/**
 * A secret-bearing string. The raw value is reachable only through {@link Secret.reveal}; string
 * conversion, JSON serialization and `util.inspect` all yield a redacted marker.
 *
 * Every secret is also remembered so free-text redaction can scrub it from error messages and
 * response bodies that echo it back.
 */
export class Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(value: string): Secret {
    if (value.length >= MIN_SCRUBBABLE_LENGTH) {
      knownSecretValues.add(value);
    }
    return new Secret(value);
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return `Secret(${REDACTED})`;
  }
}

export function knownSecrets(): ReadonlySet<string> {
  return knownSecretValues;
}
