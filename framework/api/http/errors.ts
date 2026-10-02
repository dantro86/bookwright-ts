import { redactText, sanitizeError } from '../../diagnostics/redaction.ts';

/** Identifies one API call in diagnostics. `url` must already be redacted. */
export interface CallDescription {
  readonly operation: string;
  readonly method: string;
  readonly url: string;
}

function describe(call: CallDescription): string {
  return `${call.operation} (${call.method} ${call.url})`;
}

/** The request never produced an HTTP response: DNS, connection, TLS, timeout or disconnect. */
export class ApiCallError extends Error {
  override readonly name = 'ApiCallError';
  readonly call: CallDescription;

  constructor(call: CallDescription, cause: unknown) {
    const safeCause = sanitizeError(cause);
    super(`${describe(call)} failed before a response was received: ${safeCause.message}`, {
      cause: safeCause,
    });
    this.call = call;
  }
}

/** An HTTP response arrived but broke the contract: wrong status, malformed body or schema. */
export class UnexpectedResponseError extends Error {
  override readonly name = 'UnexpectedResponseError';
  readonly call: CallDescription;
  readonly expectedStatus: number;
  readonly actualStatus: number;
  /** Redacted, bounded body; `undefined` when the format is unknown or the body was malformed. */
  readonly responseBody: string | undefined;

  constructor(details: {
    call: CallDescription;
    expectedStatus: number;
    actualStatus: number;
    problem: string;
    responseBody: string | undefined;
  }) {
    super(
      [
        `${describe(details.call)}: ${redactText(details.problem)}`,
        `  expected status: ${details.expectedStatus}, actual status: ${details.actualStatus}`,
        `  response body: ${details.responseBody ?? '[omitted: unknown or malformed format]'}`,
      ].join('\n'),
    );
    this.call = details.call;
    this.expectedStatus = details.expectedStatus;
    this.actualStatus = details.actualStatus;
    this.responseBody = details.responseBody;
  }
}

/** A lookup that the scenario requires to succeed found no (or more than one) match. */
export class RequiredEntityNotFoundError extends Error {
  override readonly name = 'RequiredEntityNotFoundError';
  readonly entity: string;
  readonly criterion: string;
  readonly source: string;
  readonly count: number;

  constructor(details: { entity: string; criterion: string; source: string; count: number }) {
    super(
      `Required ${details.entity} not found: expected exactly 1 match for ${redactText(details.criterion)} ` +
        `from ${details.source}, got ${details.count}`,
    );
    this.entity = details.entity;
    this.criterion = details.criterion;
    this.source = details.source;
    this.count = details.count;
  }
}

export type SafeContext = Readonly<Record<string, string | number | boolean>>;

/** A create/update/delete business operation failed; the original error is kept as `cause`. */
export class BusinessOperationError extends Error {
  override readonly name = 'BusinessOperationError';
  readonly operation: string;
  readonly context: SafeContext;

  constructor(operation: string, context: SafeContext, cause: unknown) {
    const contextText = Object.entries(context)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ');
    const safeCause = cause instanceof Error ? cause : sanitizeError(cause);
    super(
      redactText(
        `${operation} failed${contextText ? ` [${contextText}]` : ''}: ${safeCause.message}`,
      ),
      {
        cause: safeCause,
      },
    );
    this.operation = operation;
    this.context = context;
  }
}

/** Runs a business operation and wraps any failure in a {@link BusinessOperationError}. */
export async function businessOperation<T>(
  operation: string,
  context: SafeContext,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new BusinessOperationError(operation, context, error);
  }
}
