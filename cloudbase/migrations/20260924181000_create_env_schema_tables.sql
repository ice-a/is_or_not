CREATE SCHEMA IF NOT EXISTS "dev-d4g97a4h5772bec4a";

CREATE TABLE IF NOT EXISTS "dev-d4g97a4h5772bec4a".jobs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openid      TEXT    NOT NULL DEFAULT '',
  uid         TEXT    NOT NULL DEFAULT '',
  fingerprint TEXT    NOT NULL,
  input_type  TEXT    NOT NULL DEFAULT 'text',
  raw_text    TEXT,
  stage       INT     NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'pending',
  err_stage   TEXT    NOT NULL DEFAULT '',
  verdict_id  TEXT    NOT NULL DEFAULT '',
  created_at  BIGINT  NOT NULL,
  updated_at  BIGINT  NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_status_created ON "dev-d4g97a4h5772bec4a".jobs (status, created_at);
CREATE INDEX IF NOT EXISTS jobs_uid_status_created ON "dev-d4g97a4h5772bec4a".jobs (uid, status, created_at);

CREATE TABLE IF NOT EXISTS "dev-d4g97a4h5772bec4a".verdicts (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint      TEXT    NOT NULL,
  channel          TEXT,
  claim            TEXT,
  verdict          TEXT    NOT NULL,
  intent           TEXT,
  one_line         TEXT,
  reasons          JSONB   NOT NULL DEFAULT '[]'::jsonb,
  actions          JSONB   NOT NULL DEFAULT '[]'::jsonb,
  sources          JSONB   NOT NULL DEFAULT '[]'::jsonb,
  risk_predicates  JSONB   NOT NULL DEFAULT '[]'::jsonb,
  confidence_internal TEXT  DEFAULT 'mid',
  model            TEXT,
  hit_count        INT     NOT NULL DEFAULT 0,
  expires_at       BIGINT,
  created_at       BIGINT
);
CREATE INDEX IF NOT EXISTS verdicts_fingerprint ON "dev-d4g97a4h5772bec4a".verdicts (fingerprint);

CREATE TABLE IF NOT EXISTS "dev-d4g97a4h5772bec4a".abuse (
  id         TEXT    PRIMARY KEY,
  openid     TEXT,
  uid        TEXT,
  day        TEXT,
  count      INT     NOT NULL DEFAULT 0,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS "dev-d4g97a4h5772bec4a".users (
  openid     TEXT    PRIMARY KEY,
  uid        TEXT,
  created_at BIGINT
);

CREATE TABLE IF NOT EXISTS "dev-d4g97a4h5772bec4a".sources (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org      TEXT,
  title    TEXT,
  url      TEXT,
  keywords JSONB   DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS "dev-d4g97a4h5772bec4a".feedback (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openid     TEXT,
  uid        TEXT,
  verdict_id TEXT,
  correct    BOOLEAN DEFAULT false,
  note       TEXT,
  created_at BIGINT
);
