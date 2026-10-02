import { test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { z } from 'zod';
import { redactBody, redactHeaders, redactUrl, redactValue } from '../../diagnostics/redaction.ts';
import { ApiCallError, UnexpectedResponseError, type CallDescription } from './errors.ts';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryParams = Readonly<Record<string, string | number | boolean>>;

/** One HTTP request, described declaratively so it can be executed and diagnosed safely. */
export interface ApiCall {
  readonly request: APIRequestContext;
  readonly operation: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly params?: QueryParams;
  readonly headers?: Readonly<Record<string, string>>;
  readonly data?: unknown;
  /** Per-request timeout; defaults to Playwright's request timeout. */
  readonly timeoutMs?: number;
}

/** Executes the call once and returns the response regardless of status. */
export async function response(call: ApiCall): Promise<APIResponse> {
  return inCallStep(call, () => send(call));
}

/** Executes the call once and fails with {@link UnexpectedResponseError} on any other status. */
export async function expectStatus(call: ApiCall, expectedStatus: number): Promise<void> {
  await inCallStep(call, async () => {
    const res = await send(call);
    await requireStatus(call, res, expectedStatus);
  });
}

/** Executes the call once, checks the status and returns the schema-validated JSON body. */
export async function body<Schema extends z.ZodType>(
  call: ApiCall,
  expectedStatus: number,
  schema: Schema,
): Promise<z.output<Schema>> {
  return inCallStep(call, async () => {
    const res = await send(call);
    await requireStatus(call, res, expectedStatus);
    return readBody(call, res, schema);
  });
}

/** Validates the JSON body of a response already obtained through {@link response}. */
export async function readBody<Schema extends z.ZodType>(
  call: ApiCall,
  res: APIResponse,
  schema: Schema,
): Promise<z.output<Schema>> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UnexpectedResponseError({
      call: describeCall(call),
      expectedStatus: res.status(),
      actualStatus: res.status(),
      problem: 'response body is not valid JSON',
      responseBody: undefined,
    });
  }
  const parsed = schema.safeParse(json, { reportInput: false });
  if (!parsed.success) {
    throw new UnexpectedResponseError({
      call: describeCall(call),
      expectedStatus: res.status(),
      actualStatus: res.status(),
      problem: `response body does not match the expected schema:\n${z.prettifyError(parsed.error)}`,
      responseBody: redactBody(text, res.headers()['content-type']),
    });
  }
  return parsed.data;
}

export function describeCall(call: ApiCall): CallDescription {
  return { operation: call.operation, method: call.method, url: redactUrl(urlOf(call)) };
}

/** Fails with {@link UnexpectedResponseError} unless a response obtained through {@link response} has the status. */
export async function requireStatus(
  call: ApiCall,
  res: APIResponse,
  expectedStatus: number,
): Promise<void> {
  if (res.status() === expectedStatus) {
    return;
  }
  throw new UnexpectedResponseError({
    call: describeCall(call),
    expectedStatus,
    actualStatus: res.status(),
    problem: 'unexpected HTTP status',
    responseBody: redactBody(await res.text(), res.headers()['content-type']),
  });
}

async function send(call: ApiCall): Promise<APIResponse> {
  let res: APIResponse;
  try {
    res = await call.request.fetch(call.path, {
      method: call.method,
      ...(call.params && { params: { ...call.params } }),
      ...(call.headers && { headers: { ...call.headers } }),
      ...(call.data !== undefined && { data: call.data }),
      ...(call.timeoutMs !== undefined && { timeout: call.timeoutMs }),
      failOnStatusCode: false,
      // Every call executes exactly once; waiting happens only at explicit polling boundaries.
      maxRetries: 0,
    });
  } catch (error) {
    await attachExchange(call, undefined);
    throw new ApiCallError(describeCall(call), error);
  }
  await attachExchange(call, res);
  return res;
}

function inCallStep<T>(call: ApiCall, action: () => Promise<T>): Promise<T> {
  const { method, url } = describeCall(call);
  return test.step(`${call.operation}: ${method} ${url}`, action);
}

async function attachExchange(call: ApiCall, res: APIResponse | undefined): Promise<void> {
  const exchange = {
    request: {
      method: call.method,
      url: redactUrl(res?.url() ?? urlOf(call)),
      headers: redactHeaders(call.headers ?? {}),
      body: call.data === undefined ? undefined : redactValue(call.data),
    },
    response: res && {
      status: res.status(),
      headers: redactHeaders(res.headers()),
      body: redactBody(await res.text(), res.headers()['content-type']) ?? '[omitted]',
    },
  };
  await test.info().attach(`${call.operation} exchange`, {
    body: JSON.stringify(exchange, null, 2),
    contentType: 'application/json',
  });
}

function urlOf(call: ApiCall): string {
  if (!call.params) {
    return call.path;
  }
  const query = new URLSearchParams(
    Object.entries(call.params).map(([key, value]): [string, string] => [key, String(value)]),
  );
  return `${call.path}?${query.toString()}`;
}
