PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER NOT NULL PRIMARY KEY,
  mbid VARCHAR(36) NULL,
  name VARCHAR(255) NULL,
  artist_id INTEGER NOT NULL,
  album_id INTEGER NOT NULL)

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER NOT NULL PRIMARY KEY,
  name VARCHAR(255) NULL,
  mbid VARCHAR(36) NULL)

INSERT OR IGNORE INTO artists (id, name, mbid)
  VALUES (1, 'Unknown', NULL);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER NOT NULL PRIMARY KEY,
  name VARCHAR(255) NULL,
  mbid VARCHAR(36) NULL,
  releasedate INTEGER NULL,
  artist_id INTEGER NOT NULL)

INSERT OR IGNORE INTO albums (id, name, mbid, releasedate, artist_id)
  VALUES (1, 'Unknown', NULL, NULL, 1);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER NOT NULL PRIMARY KEY,
  mbid VARCHAR(36) NULL,
  name VARCHAR(255) NULL,
  artist_id INTEGER NOT NULL,
  album_id INTEGER NOT NULL)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER NOT NULL PRIMARY KEY,
  name VARCHAR(45) NULL)

CREATE TABLE IF NOT EXISTS plays (
  id INTEGER NOT NULL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  date INTEGER NULL)

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER NOT NULL PRIMARY KEY,
  from_time INTEGER NULL,
  to_time INTEGER NULL,
  start_time INTEGER NULL,
  stop_time INTEGER NULL)