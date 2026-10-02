import type { BookingRecord, RoomRecord, UserRecord } from './store.ts';

export const SESSION_COOKIE = 'bw_session';

/** Notices shown on the login page, keyed by the `reason` query parameter. */
export const LOGIN_NOTICES: Readonly<Record<string, string>> = {
  session_missing: 'Please sign in to continue.',
  session_invalid: 'Your session is not valid. Please sign in again.',
  session_expired: 'Your session has expired. Please sign in again.',
  invalid_credentials: 'Email or password is incorrect.',
  signed_out: 'You have signed out.',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)} · Bookwright</title></head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

export function loginPage(reason: string | undefined): string {
  const notice = reason === undefined ? undefined : LOGIN_NOTICES[reason];
  return layout(
    'Sign in',
    `<h1>Sign in</h1>
${notice === undefined ? '' : `<p role="status" data-test="login-notice">${escapeHtml(notice)}</p>`}
<form method="post" action="/login">
  <label>Email <input name="email" type="email" autocomplete="username" required></label>
  <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>`,
  );
}

export function bookingsPage(
  user: UserRecord,
  bookings: readonly BookingRecord[],
  roomName: (roomId: number) => RoomRecord['name'] | undefined,
): string {
  const rows = bookings
    .map(
      (booking) => `<li data-test="booking" data-booking-id="${booking.id}">
    <span data-test="booking-guest">${escapeHtml(booking.guestName)}</span>
    <span data-test="booking-room">${escapeHtml(roomName(booking.roomId) ?? `Room ${booking.roomId}`)}</span>
    <span data-test="booking-dates">${booking.checkin} → ${booking.checkout}</span>
  </li>`,
    )
    .join('\n  ');
  return layout(
    'My bookings',
    `<h1>My bookings</h1>
<p data-test="signed-in-user">Signed in as ${escapeHtml(user.displayName)}</p>
${
  bookings.length === 0
    ? '<p data-test="empty-bookings">You have no bookings yet.</p>'
    : `<ul aria-label="Bookings">\n  ${rows}\n</ul>`
}
<form method="post" action="/logout"><button type="submit">Sign out</button></form>`,
  );
}
