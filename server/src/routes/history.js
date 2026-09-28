'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/history  { uid, action:'list', page, size } 或 { uid, action:'del', ids }
// 云端历史同步：list（分页）/ del（软删除）
router.post('/', async (req, res) => {
  const uid = (req.body.uid || 'anonymous').toString();
  const action = req.body.action;

  if (action === 'list') {
    const page = req.body.page || 0;
    const size = Math.min(req.body.size || 30, 50);
    const { rows } = await pool.query(
      `SELECT j.verdict_id, j.status, j.created_at,
              v.verdict, v.one_line, v.claim
       FROM jobs j
       LEFT JOIN verdicts v ON v.id = NULLIF(j.verdict_id, '')::bigint
       WHERE j.uid=$1 AND j.status IN ('done','degraded')
       ORDER BY j.created_at DESC LIMIT $2 OFFSET $3`,
      [uid, size, page * size]
    );
    const items = rows.map((j) => ({
      verdictId: j.verdict_id,
      status: j.status,
      createdAt: j.created_at,
      verdict: j.verdict || 'unverified',
      oneLine: j.one_line || '',
      preview: (j.claim || '').slice(0, 40),
    }));
    return res.json({ ok: true, items, hasMore: items.length === size });
  }

  if (action === 'del') {
    const ids = req.body.ids || [];
    if (ids.length) {
      await pool
        .query(`UPDATE jobs SET status='deleted' WHERE uid=$1 AND verdict_id = ANY($2)`, [uid, ids])
        .catch(() => {});
    }
    return res.json({ ok: true });
  }

  return res.json({ ok: false, code: 4006, msg: '未知 action' });
});

module.exports = router;
