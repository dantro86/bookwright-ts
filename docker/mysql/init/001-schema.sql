-- Deterministic schema of the local booking app. Applied once by the MySQL entrypoint on an empty
-- data directory; every stand starts from a fresh volume.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE rooms (
  id          INT          NOT NULL PRIMARY KEY,
  name        VARCHAR(40)  NOT NULL UNIQUE,
  capacity    TINYINT      NOT NULL,
  nightly_eur DECIMAL(8,2) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  display_name  VARCHAR(80)  NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at    DATETIME(3)  NOT NULL
) ENGINE = InnoDB;

CREATE TABLE sessions (
  token      VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE bookings (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  room_id    INT          NOT NULL,
  guest_name VARCHAR(120) NOT NULL,
  checkin    DATE         NOT NULL,
  checkout   DATE         NOT NULL,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms (id),
  CONSTRAINT chk_bookings_dates CHECK (checkout > checkin),
  INDEX idx_bookings_user (user_id)
) ENGINE = InnoDB AUTO_INCREMENT = 1000;
