-- Deterministic seed data. Ids, names and dates are fixed so tests can assert exact rows.
INSERT INTO rooms (id, name, capacity, nightly_eur) VALUES
  (101, 'Single', 1, 79.00),
  (102, 'Double', 2, 109.00),
  (201, 'Twin',   2, 115.00),
  (202, 'Family', 4, 189.00),
  (301, 'Suite',  2, 249.00);

-- Archive account owning historical bookings. Its password hash is not a valid scrypt hash, so it
-- can never sign in.
INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'archive@bookwright.test', 'Archive', 'disabled',
   '2030-01-01 00:00:00.000');

INSERT INTO bookings (id, user_id, room_id, guest_name, checkin, checkout) VALUES
  (1, '00000000-0000-4000-8000-000000000001', 101, 'Ada Lovelace',  '2030-02-01', '2030-02-04'),
  (2, '00000000-0000-4000-8000-000000000001', 202, 'Grace Hopper',  '2030-03-10', '2030-03-15'),
  (3, '00000000-0000-4000-8000-000000000001', 301, 'Alan Turing',   '2030-04-20', '2030-04-21');
