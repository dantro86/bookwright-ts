/** Stable local-app UI texts. */
export const LOCAL_UI_TEXTS = {
  loginHeading: 'Sign in',
  bookingsHeading: 'My bookings',
  emptyBookings: 'You have no bookings yet.',
  notices: {
    session_missing: 'Please sign in to continue.',
    session_invalid: 'Your session is not valid. Please sign in again.',
    session_expired: 'Your session has expired. Please sign in again.',
    invalid_credentials: 'Email or password is incorrect.',
    signed_out: 'You have signed out.',
  },
} as const;

export type LoginNotice = keyof typeof LOCAL_UI_TEXTS.notices;

/** Cookie the local app reads its session token from; tests inject the API-issued token here. */
export const LOCAL_SESSION_COOKIE = 'bw_session';
