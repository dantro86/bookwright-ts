/** Stable local-app authentication contract values. */
export const LOCAL_AUTH_EXPECTATIONS = {
  invalidCredentials: 'invalid_credentials',
  missingSession: 'session_missing',
  invalidSession: 'session_invalid',
  expiredSession: 'session_expired',
} as const;
