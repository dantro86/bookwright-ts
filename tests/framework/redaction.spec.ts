import { expect, test } from '@playwright/test';
import { inspect } from 'node:util';
import {
  REDACTED,
  redactBody,
  redactHeaders,
  redactText,
  redactUrl,
  redactValue,
  sanitizeError,
  truncate,
} from '../../framework/diagnostics/redaction.ts';
import { Secret } from '../../framework/diagnostics/secret.ts';

test.describe('redaction', () => {
  test('secrets never leak through string, JSON or inspection', () => {
    const secret = Secret.of('hunter2-password');
    expect(String(secret)).toBe(REDACTED);
    expect(JSON.stringify({ secret })).toBe(`{"secret":"${REDACTED}"}`);
    expect(inspect({ secret })).not.toContain('hunter2');
  });

  test('known secret values are scrubbed from free text', () => {
    Secret.of('tok-abcdef123456');
    expect(redactText('server echoed tok-abcdef123456 back')).toBe(
      `server echoed ${REDACTED} back`,
    );
  });

  test('credential-shaped text is scrubbed', () => {
    expect(redactText('Authorization: Bearer abc.def.ghi')).toBe(
      `Authorization: Bearer ${REDACTED}`,
    );
    expect(redactText('password=pa55&user=bob')).toBe(`password=${REDACTED}&user=bob`);
    expect(redactText('{"token": "t0k3n"}')).toBe(`{"token": ${REDACTED}}`);
    expect(
      redactText('-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----'),
    ).toBe(REDACTED);
  });

  test('URLs lose credentials and sensitive query parameters', () => {
    expect(redactUrl('https://user:pw@api.test/booking?token=abc&firstname=Ada')).toBe(
      `https://${REDACTED}@api.test/booking?token=${REDACTED}&firstname=Ada`,
    );
    expect(redactUrl('/booking?session_id=xyz&page=2')).toBe(
      `/booking?session_id=${REDACTED}&page=2`,
    );
  });

  test('sensitive headers are masked case-insensitively', () => {
    expect(
      redactHeaders({
        Cookie: 'token=abc',
        'set-cookie': 'sid=1',
        Authorization: 'Basic x',
        'X-Api-Key': 'k',
        Accept: 'json',
      }),
    ).toEqual({
      Cookie: REDACTED,
      'set-cookie': REDACTED,
      Authorization: REDACTED,
      'X-Api-Key': REDACTED,
      Accept: 'json',
    });
  });

  test('objects are masked by key at any depth', () => {
    expect(
      redactValue({
        user: { name: 'ada', password: 'x', nested: [{ sessionId: 'y', ok: 1 }] },
        key: Secret.of('zz-top-secret'),
      }),
    ).toEqual({
      user: { name: 'ada', password: REDACTED, nested: [{ sessionId: REDACTED, ok: 1 }] },
      key: REDACTED,
    });
  });

  test('bodies: JSON and forms are redacted, unknown or malformed formats are omitted', () => {
    expect(redactBody('{"token":"abc","id":1}', 'application/json; charset=utf-8')).toBe(
      JSON.stringify({ token: REDACTED, id: 1 }, null, 2),
    );
    expect(redactBody('username=a&password=b', 'application/x-www-form-urlencoded')).toBe(
      `username=a&password=${REDACTED}`,
    );
    expect(redactBody('{not json', 'application/json')).toBeUndefined();
    expect(redactBody('<html>token</html>', 'text/html')).toBeUndefined();
    expect(redactBody('\u0000binary', undefined)).toBeUndefined();
  });

  test('long diagnostics are bounded', () => {
    expect(truncate('x'.repeat(10), 4)).toBe('xxxx… [truncated 6 chars]');
  });

  test('errors are copied with scrubbed message, stack and cause chain', () => {
    Secret.of('very-secret-cause');
    const original = new Error('outer password=abc', {
      cause: new Error('inner very-secret-cause'),
    });
    const safe = sanitizeError(original);
    expect(safe.message).toBe(`outer password=${REDACTED}`);
    expect((safe.cause as Error).message).toBe(`inner ${REDACTED}`);
    expect(safe.stack).not.toContain('password=abc');
  });
});
