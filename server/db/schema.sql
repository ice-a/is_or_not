-- 辨是非 · PostgreSQL 表结构（云托管后端使用，public schema）
-- 若云托管关联的 PostgreSQL 还是空库，可手动执行本文件初始化。
-- 已有的 CloudBase PostgreSQL（postgres-c9a8ru10）已包含这些表，无需重复执行。

CREATE TABLE IF NOT EXISTS public.jobs (
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
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_uid_status_created ON public.jobs (uid, status, created_at);

CREATE TABLE IF NOT EXISTS public.verdicts (
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
CREATE INDEX IF NOT EXISTS idx_verdicts_fingerprint ON public.verdicts (fingerprint);

CREATE TABLE IF NOT EXISTS public.abuse (
  id         TEXT    PRIMARY KEY,
  openid     TEXT,
  uid        TEXT,
  day        TEXT,
  count      INT     NOT NULL DEFAULT 0,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.users (
  openid     TEXT    PRIMARY KEY,
  uid        TEXT,
  created_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.sources (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org      TEXT,
  title    TEXT,
  url      TEXT,
  keywords JSONB   DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openid     TEXT,
  uid        TEXT,
  verdict_id TEXT,
  type       TEXT,
  comment    TEXT,
  created_at BIGINT
);

-- 打赏 / 虚拟支付记录（金额以「分」存储，避免浮点误差）
CREATE TABLE IF NOT EXISTS public.tips (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid        TEXT    NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  message    TEXT,
  channel    TEXT    NOT NULL DEFAULT 'demo', -- demo=演示直录；virtualpay=微信虚拟支付
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tips_uid_created ON public.tips (uid, created_at);
