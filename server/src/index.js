'use strict';

const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { startWorker } = require('./worker');
const { WORKER_INTERVAL } = require('./config');
const analyze = require('./routes/analyze');
const getVerdict = require('./routes/getVerdict');
const feedback = require('./routes/feedback');
const history = require('./routes/history');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 健康检查（云托管探测 / 负载均衡用）
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// API 路由（与小程序 callFunction(name) 一一对应：/api/<name>）
app.use('/api/analyze', analyze);
app.use('/api/getVerdict', getVerdict);
app.use('/api/feedback', feedback);
app.use('/api/history', history);

// 404
app.use((req, res) => res.status(404).json({ ok: false, code: 404, msg: 'not found' }));

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[express] error', err);
  res.status(500).json({ ok: false, code: 500, msg: '服务器开小差了' });
});

const PORT = parseInt(process.env.PORT, 10) || 80;
app.listen(PORT, () => {
  console.log('[server] listening on', PORT);
  startWorker(WORKER_INTERVAL);
});

module.exports = app;
