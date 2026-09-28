'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { pool } = require('../db');
const { FREE_QUOTA } = require('../config');
const { publicVerdict } = require('../format');

// 内容指纹：去空白/标点后 sha256 前 16 位
function fingerprint(text) {
  const norm = (text || '')
    .replace(/\s+/g, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  return crypto.createHash('sha256').update(norm, 'utf8').digest('hex').slice(0, 16);
}

// 简易每日限流：abuse 表按 uid+日期计数（upsert 自增）
async function checkQuota(uid) {
  const day = new Date().toISOString().slice(0, 10);
  const id = `${uid}_${day}`;
  const { rows } = await pool.query('SELECT count FROM abuse WHERE id=$1', [id]);
  const count = rows[0] ? rows[0].count : 0;
  if (count >= FREE_QUOTA) {
    return { ok: false, code: 4001, msg: '今天次数用完啦，明天再来' };
  }
  await pool
    .query(
      `INSERT INTO abuse (id, uid, day, count, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET count = abuse.count + 1, updated_at = EXCLUDED.updated_at`,
      [id, uid, day, count + 1, Date.now()]
    )
    .catch(() => {});
  return { ok: true };
}

// POST /api/analyze  { text, uid }
// 返回：{ ok:true, cached:true, verdictId, verdict } 或 { ok:true, cached:false, jobId }
router.post('/', async (req, res) => {
  const uid = (req.body.uid || 'anonymous').toString();
  const text = (req.body.text || '').trim();
  if (text.length < 5) {
    return res.json({ ok: false, code: 4000, msg: '内容太短，说不清楚，多复制点文字吧' });
  }
  let useText = text;
  if (text.length > 5000) {
    // 截断：前 3000 + 后 1000
    useText = text.slice(0, 3000) + text.slice(-1000);
  }

  const quota = await checkQuota(uid);
  if (!quota.ok) return res.json(quota);

  const fp = fingerprint(useText);
  const now = Date.now();

  // 查缓存（精确命中 + TTL）
  const { rows: hits } = await pool.query('SELECT * FROM verdicts WHERE fingerprint=$1 LIMIT 1', [fp]);
  if (hits.length) {
    const v = hits[0];
    if (!v.expires_at || now < v.expires_at) {
      await pool.query('UPDATE verdicts SET hit_count = COALESCE(hit_count,0)+1 WHERE id=$1', [v.id]).catch(() => {});
      return res.json({ ok: true, cached: true, verdictId: String(v.id), verdict: publicVerdict(v) });
    }
  }

  // 未命中：建 job（raw_text 生产环境应加密存储，此处明文仅骨架）
  const { rows: ins } = await pool.query(
    `INSERT INTO jobs (uid, fingerprint, input_type, raw_text, stage, status, created_at, updated_at)
     VALUES ($1,$2,'text',$3,0,'pending',$4,$5) RETURNING id`,
    [uid, fp, useText, now, now]
  );
  const jobId = String(ins[0].id);

  // worker 定时器会在数秒内异步处理；前端轮询 getVerdict({jobId}) 取结论
  return res.json({ ok: true, cached: false, jobId });
});

module.exports = router;
