'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/feedback  { uid, verdictId, type, comment }
// 纠错反馈入口，进人工复核队列
router.post('/', async (req, res) => {
  const uid = (req.body.uid || 'anonymous').toString();
  const { verdictId, type, comment } = req.body;
  if (!verdictId || !type) {
    return res.json({ ok: false, code: 4005, msg: '参数不全' });
  }
  await pool.query(
    `INSERT INTO feedback (uid, verdict_id, type, comment, created_at) VALUES ($1,$2,$3,$4,$5)`,
    [uid, String(verdictId), type, comment || '', Date.now()]
  );
  return res.json({ ok: true });
});

module.exports = router;
