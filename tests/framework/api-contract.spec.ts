import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { z } from 'zod';
import { body, expectStatus, response, type ApiCall } from '../../framework/api/http/contract.ts';
import {
  ApiCallError,
  BusinessOperationError,
  UnexpectedResponseError,
  businessOperation,
} from '../../framework/api/http/errors.ts';
import { REDACTED } from '../../framework/diagnostics/redaction.ts';
import { Secret } from '../../framework/diagnostics/secret.ts';
import { MockServer, json, raw } from './support/mock-server.ts';

const Item = z.object({ id: z.number(), name: z.string() }).strict();

const test = base.extend<{ mock: MockServer; mockRequest: APIRequestContext }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
  mock: async ({}, use) => {
    const mock = await MockServer.start();
    await use(mock);
    await mock.stop();
  },
  mockRequest: async ({ playwright, mock }, use) => {
    const request = await playwright.request.newContext({ baseURL: mock.url });
    await use(request);
    await request.dispose();
  },
});

function call(request: APIRequestContext, overrides: Partial<ApiCall> = {}): ApiCall {
  return { request, operation: 'read item', method: 'GET', path: '/item', ...overrides };
}

test.describe('API response contracts', () => {
  test('body() returns the schema-validated payload', async ({ mock, mockRequest }) => {
    mock.script('GET /item', json(200, { id: 1, name: 'lamp' }));
    await expect(body(call(mockRequest), 200, Item)).resolves.toEqual({ id: 1, name: 'lamp' });
  });

  test('status mismatch raises UnexpectedResponseError with a redacted body', async ({
    mock,
    mockRequest,
  }) => {
    mock.script('GET /item', json(500, { message: 'boom', token: 'leaked-token-value' }));

    const failure = await body(call(mockRequest), 200, Item).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnexpectedResponseError);
    expect(failure).toMatchObject({
      expectedStatus: 200,
      actualStatus: 500,
      call: { operation: 'read item' },
    });
    const message = (failure as Error).message;
    expect(message).toContain('boom');
    expect(message).toContain(REDACTED);
    expect(message).not.toContain('leaked-token-value');
  });

  test('malformed JSON is reported without attaching the body', async ({ mock, mockRequest }) => {
    mock.script('GET /item', raw(200, 'application/json', '{"id": 1, "name": '));

    const failure = await body(call(mockRequest), 200, Item).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnexpectedResponseError);
    expect((failure as UnexpectedResponseError).responseBody).toBeUndefined();
    expect((failure as Error).message).toContain('response body is not valid JSON');
  });

  test('schema mismatch names the failing path', async ({ mock, mockRequest }) => {
    mock.script('GET /item', json(200, { id: 'one', name: 'lamp' }));

    await expect(body(call(mockRequest), 200, Item)).rejects.toThrow(
      /does not match the expected schema[\s\S]*id/,
    );
  });

  test('a disconnect raises ApiCallError with a sanitized cause', async ({ mock, mockRequest }) => {
    mock.script('GET /item', { kind: 'disconnect' });

    const failure = await response(call(mockRequest)).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiCallError);
    expect((failure as Error).cause).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(
      /read item \(GET \/item\) failed before a response was received/,
    );
  });

  test('a timeout raises ApiCallError', async ({ mock, mockRequest }) => {
    mock.script('GET /item', { kind: 'hang' });

    await expect(response(call(mockRequest, { timeoutMs: 300 }))).rejects.toThrow(ApiCallError);
  });

  test('no implicit retries: a failing call is sent exactly once', async ({
    mock,
    mockRequest,
  }) => {
    mock.script('POST /item', json(503, { message: 'unavailable' }));

    await expect(expectStatus(call(mockRequest, { method: 'POST' }), 201)).rejects.toThrow(
      UnexpectedResponseError,
    );
    expect(mock.hits('POST /item')).toBe(1);

    mock.script('GET /item', { kind: 'disconnect' });
    await expect(response(call(mockRequest))).rejects.toThrow(ApiCallError);
    expect(mock.hits('GET /item')).toBe(1);
  });

  test('business operations keep the contract failure as cause', async ({ mock, mockRequest }) => {
    mock.script('POST /item', json(409, { message: 'duplicate' }));

    const failure = await businessOperation('create item', { name: 'lamp' }, () =>
      body(call(mockRequest, { method: 'POST', operation: 'create item' }), 201, Item),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BusinessOperationError);
    expect(failure).toMatchObject({ operation: 'create item', context: { name: 'lamp' } });
    expect((failure as Error).message).toMatch(
      /^create item failed \[name=lamp\]: create item \(POST \/item\)/,
    );
    expect((failure as Error).cause).toBeInstanceOf(UnexpectedResponseError);
  });

  test('eventual consistency resolves through an explicit poll', async ({ mock, mockRequest }) => {
    mock.script('GET /item', json(404, {}), json(404, {}), json(200, { id: 7, name: 'late' }));

    await expect
      .poll(async () => (await response(call(mockRequest))).status(), {
        message: 'item 7 to become visible',
        intervals: [10],
        timeout: 2_000,
      })
      .toBe(200);
    expect(mock.hits('GET /item')).toBe(3);
  });

  test('request/response attachments are redacted', async ({ mock, mockRequest }, testInfo) => {
    const secret = Secret.of('attachment-secret-value');
    mock.script(
      'POST /item',
      json(200, { id: 1, name: 'lamp', sessionToken: 'echoed-session-token' }),
    );

    await body(
      call(mockRequest, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret.reveal()}` },
        data: { name: 'lamp', password: secret.reveal() },
        params: { token: 'query-token-value' },
      }),
      200,
      Item.extend({ sessionToken: z.string() }),
    );

    const exchange = testInfo.attachments.find(
      (attachment) => attachment.name === 'read item exchange',
    );
    const text = exchange?.body?.toString('utf8') ?? '';
    expect(text).toContain(REDACTED);
    for (const leaked of ['attachment-secret-value', 'echoed-session-token', 'query-token-value']) {
      expect(text).not.toContain(leaked);
    }
  });
});
