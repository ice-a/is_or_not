'use strict';

const { Pool } = require('pg');

// 解析 PostgreSQL 连接配置：
//   1) DATABASE_URL（完整连接串，pg 原生支持，云托管关联数据库常注入）
//   2) DB_CONNECTION_STRING（同上别名）
//   3) 拆字段 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE 或 DB_HOST/DB_PORT/...
function buildConfig() {
  const ssl = process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined;
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }
  if (process.env.DB_CONNECTION_STRING) {
    return { connectionString: process.env.DB_CONNECTION_STRING, ssl };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  const port = parseInt(process.env.PGPORT || process.env.DB_PORT, 10) || 5432;
  const user = process.env.PGUSER || process.env.DB_USER;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  const database = process.env.PGDATABASE || process.env.DB_NAME;
  if (host && user) {
    return { host, port, user, password, database, ssl };
  }
  return null;
}

const cfg = buildConfig();
if (!cfg) {
  console.error(
    '[db] 未检测到数据库连接配置：请在云托管「环境变量」设置 DATABASE_URL（关联数据库后会自动注入），否则无法访问 PostgreSQL。'
  );
}

// 即使没配也先建 Pool，避免启动直接崩溃；真正查询时再报错提示。
const pool = new Pool(cfg || { host: 'localhost', port: 5432 });
pool.on('error', (e) => console.error('[db] pool error', e.message));

module.exports = { pool };
