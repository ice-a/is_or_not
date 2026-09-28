-- 辨是非小程序 · 辨是非云环境(cloud1-d6gr1uc5m2f0a0102) 建表 + 授权
-- 用法：微信开发者工具 → 云开发 → 数据库(PostgreSQL) → SQL 执行，整段粘贴运行一次。
-- 说明：app.rdb() 以 anon 角色连接，必须对 public 下的表/序列授予读写权限，否则 INSERT 报 permission denied。
--       表已含 feedback.type / feedback.comment（合并了原 20260924190000 迁移）。

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
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint       TEXT    NOT NULL,
  channel           TEXT,
  claim             TEXT,
  verdict           TEXT    NOT NULL,
  intent            TEXT,
  one_line          TEXT,
  reasons           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  actions           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  sources           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  risk_predicates   JSONB   NOT NULL DEFAULT '[]'::jsonb,
  confidence_internal TEXT  DEFAULT 'mid',
  model             TEXT,
  hit_count         INT     NOT NULL DEFAULT 0,
  expires_at        BIGINT,
  created_at        BIGINT
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
  correct    BOOLEAN DEFAULT false,
  note       TEXT,
  type       TEXT,
  comment    TEXT,
  created_at BIGINT
);

-- ===== 授权：app.rdb() 以 anon 连接，需授予读写 =====
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
