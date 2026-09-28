'use strict';

const { Pool } = require('pg');

// 解析 PostgreSQL 连接配置：
//   1) DATABASE_URL（完整连接串，pg 原生支持，云托管关联数据库 / Supabase 常填此项）
//   2) DB_CONNECTION_STRING（同上别名）
//   3) 拆字段 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
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
    '[db] 未检测到数据库连接配置：请在环境变量设置 DATABASE_URL（云托管关联数据库 / Supabase 连接串），否则无法访问 PostgreSQL。'
  );
}

// serverless（Vercel）下连接数要小，避免打满 Supabase 连接池；
// 同时设置连接/空闲超时，避免函数实例被吊死。
const poolConfig = Object.assign({}, cfg || { host: 'localhost', port: 5432 });
poolConfig.max = parseInt(process.env.PG_POOL_MAX, 10) || (process.env.VERCEL === '1' ? 5 : 10);
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 8000;

const pool = new Pool(poolConfig);
pool.on('error', (e) => console.error('[db] pool error', e.message));

module.exports = { pool };
