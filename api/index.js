'use strict';

// Vercel serverless 入口：复用 server/ 下的 Express 应用。
// Vercel 会把所有请求经 vercel.json 的 rewrite 转发到这里，
// 由 Express 内部按 /api/* 路由分发。
const app = require('../server/src/index');

module.exports = app;
