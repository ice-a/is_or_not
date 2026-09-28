'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { publicVerdict } = require('../format');

// 按 verdictId 返回公开结论
async function getVerdictById(id) {
  const { rows } = await pool.query('SELECT * FROM verdicts WHERE id=$1 LIMIT 1', [Number(id)]);
  const v = rows[0];
  if (!v) return null;
  return { verdictId: String(v.id), verdict: publicVerdict(v) };
}

// POST /api/getVerdict  { jobId } 或 { verdictId }
// jobId 模式返回轮询进度（pending / 结论）；verdictId 模式直接返回结论
router.post('/', async (req, res) => {
  // 轮询模式：按 jobId 返回任务进度 / 结论
  if (req.body.jobId) {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1 LIMIT 1', [Number(req.body.jobId)]);
    const job = rows[0];
    if (!job) return res.json({ ok: false, code: 404, msg: '任务不存在' });
    if (job.status === 'pending' || job.status === 'running') {
      return res.json({ ok: true, pending: true, stage: job.stage || 0, status: job.status });
    }
    if (job.status === 'failed') return res.json({ ok: false, code: 410, msg: '分析失败，请重试' });
    if (!job.verdict_id) return res.json({ ok: false, code: 404, msg: '结论缺失' });
    const found = await getVerdictById(job.verdict_id);
    if (!found) return res.json({ ok: false, code: 404, msg: '记录不存在或已过期' });
    return res.json({ ok: true, verdictId: found.verdictId, verdict: found.verdict, degraded: job.status === 'degraded' });
  }

  // 直接按 verdictId
  const verdictId = req.body.verdictId;
  if (!verdictId) return res.json({ ok: false, code: 4004, msg: '缺少 verdictId' });
  const found = await getVerdictById(verdictId);
  if (!found) return res.json({ ok: false, code: 404, msg: '记录不存在或已过期' });
  return res.json({ ok: true, verdictId: found.verdictId, verdict: found.verdict });
});

module.exports = router;
