import { REDACTED, Secret, knownSecrets } from './secret.ts';

export { REDACTED };

export const MAX_DIAGNOSTIC_LENGTH = 2_000;
const MAX_DEPTH = 8;

const SENSITIVE_KEY =
  /pass(word|wd|phrase)?|secret|token|authori[sz]ation|cookie|session|api[-_]?key|private[-_]?key|credential/i;

const TEXT_PATTERNS: readonly [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`],
  [
    /("?(?:[\w-]*(?:pass(?:word)?|secret|token|session|api[-_]?key)[\w-]*)"?\s*[:=]\s*)("[^"]*"|[^\s&,;"}]+)/gi,
    `$1${REDACTED}`,
  ],
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function truncate(text: string, maxLength = MAX_DIAGNOSTIC_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}… [truncated ${text.length - maxLength} chars]`;
}

/** Scrubs known secret values and well-known credential shapes from free text. */
export function redactText(text: string): string {
  let result = text;
  for (const secret of knownSecrets()) {
    result = result.replaceAll(secret, REDACTED);
  }
  for (const [pattern, replacement] of TEXT_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function redactUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, 'http://relative.invalid');
  } catch {
    return redactText(url);
  }
  const relative = parsed.origin === 'http://relative.invalid';
  if (parsed.username || parsed.password) {
    parsed.username = REDACTED;
    parsed.password = '';
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (isSensitiveKey(key)) {
      parsed.searchParams.set(key, REDACTED);
    }
  }
  const serialized = relative
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : parsed.toString();
  return redactText(safeDecode(serialized));
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function redactHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveKey(name) ? REDACTED : redactText(value),
    ]),
  );
}

/**
 * Returns a deep copy with sensitive keys masked, secrets hidden and strings scrubbed. Nesting
 * deeper than `maxDepth` is replaced by a marker.
 */
export function redactValue(value: unknown, maxDepth = MAX_DEPTH): unknown {
  return redactAt(value, 0, maxDepth);
}

function redactAt(value: unknown, depth: number, maxDepth: number): unknown {
  if (value instanceof Secret) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= maxDepth) {
    return '[max depth]';
  }
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redactAt(item, depth + 1, maxDepth));
  }
  if (isSensitiveNameValuePair(value)) {
    return { ...value, value: REDACTED };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redactAt(item, depth + 1, maxDepth),
    ]),
  );
}

/** HAR- and trace-style header or cookie entries: `{ name: 'Cookie', value: '...' }`. */
function isSensitiveNameValuePair(value: object): value is { name: string; value: unknown } {
  return (
    'name' in value &&
    'value' in value &&
    typeof value.name === 'string' &&
    isSensitiveKey(value.name)
  );
}

/**
 * Converts a response or request body into a safe, bounded diagnostic string.
 * Only JSON, form-encoded and plain-text bodies are rendered; anything unknown or malformed is
 * omitted (returns `undefined`) instead of being attached unsafely.
 */
export function redactBody(body: string, contentType: string | undefined): string | undefined {
  if (body.length === 0) {
    return '';
  }
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'application/json' || type.endsWith('+json')) {
    try {
      return truncate(JSON.stringify(redactValue(JSON.parse(body)), null, 2));
    } catch {
      return undefined;
    }
  }
  if (type === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(body);
    for (const key of [...params.keys()]) {
      if (isSensitiveKey(key)) {
        params.set(key, REDACTED);
      }
    }
    return truncate(redactText(params.toString()));
  }
  if (type === 'text/plain') {
    return truncate(redactText(body));
  }
  return undefined;
}

/** Copies an error with a scrubbed message and stack, keeping a sanitized cause chain. */
export function sanitizeError(error: unknown, depth = 0): Error {
  if (!(error instanceof Error)) {
    return new Error(redactText(String(error)));
  }
  const cause =
    error.cause !== undefined && depth < MAX_DEPTH
      ? sanitizeError(error.cause, depth + 1)
      : undefined;
  const copy = new Error(redactText(error.message), cause ? { cause } : undefined);
  copy.name = error.name;
  if (error.stack !== undefined) {
    copy.stack = redactText(error.stack);
  }
  return copy;
}
