'use strict';

// 任务编排：claim job → AI 定级 → verify(官方库) → simplify(老年化) → 写 verdicts
// 兼容两种运行环境：
//   - 常驻容器（云托管 / CloudBase Run）：用 startWorker 的定时器扫描 pending；
//   - 无服务器（Vercel）：无常驻进程，由 getVerdict 调 processJobById 惰性处理。
const { pool } = require('./db');
const { callAI } = require('./ai');
const { ruleEngine, matchOfficial } = require('./rules');
const { ANALYZE_SYS, SIMPLIFY_SYS } = require('./prompt');
const { AI } = require('./config');

// 原子认领一个待处理任务（多实例部署时用 FOR UPDATE SKIP LOCKED 避免重复处理）。
// 兼容 'pending' 与 'running'（上次处理超时残留），防止任务卡死。
async function claimNextJob() {
  const now = Date.now();
  const { rows } = await pool.query(
    `UPDATE jobs SET status='running', stage=1, updated_at=$2
     WHERE id = (
       SELECT id FROM jobs WHERE status IN ('pending','running') ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING id, fingerprint, raw_text, uid`,
    [now]
  );
  return rows[0];
}

// 写 verdicts（snake_case 列）
async function writeVerdict(jobId, fingerprint, v) {
  const ttlDays = v.verdict === 'false' ? 7 : v.verdict === 'true' ? 30 : 1;
  const expiresAt = Date.now() + ttlDays * 86400000;
  const { rows } = await pool.query(
    `INSERT INTO verdicts
      (fingerprint, channel, claim, verdict, intent, one_line, reasons, actions, sources, risk_predicates, confidence_internal, model, hit_count, expires_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'mid',$11,0,$12,$13)
     RETURNING id`,
    [
      fingerprint,
      v.channel,
      v.claim,
      v.verdict,
      v.intent,
      v.oneLine,
      JSON.stringify(v.reasons || []),
      JSON.stringify(v.actions || []),
      JSON.stringify(v.sources || []),
      JSON.stringify(v.riskPredicates || []),
      v.model,
      expiresAt,
      Date.now(),
    ]
  );
  const verdictId = String(rows[0].id);
  await pool.query(
    `UPDATE jobs SET status=$1, verdict_id=$2, stage=4, updated_at=$3 WHERE id=$4`,
    [v.degraded ? 'degraded' : 'done', verdictId, Date.now(), Number(jobId)]
  );
  return { ok: true, verdictId, degraded: v.degraded };
}

// 降级写库（status=degraded，标"规则判定，未经AI复核"）
async function degrade(job) {
  const r = ruleEngine(job.raw_text || '');
  return writeVerdict(job.id, job.fingerprint, {
    ...r,
    claim: (job.raw_text || '').slice(0, 20),
    channel: 'text',
    riskPredicates: [],
    model: 'rule-engine',
    degraded: true,
  });
}

// 处理单个 job
async function processJob(job) {
  const text = job.raw_text || '';

  let ai = await callAI(ANALYZE_SYS, text);
  if (!ai || !ai.verdict) {
    return degrade(job);
  }

  const sources = matchOfficial(text);
  const matchedOfficial = sources.length > 0;
  // 硬约束：判「假」必须附官方来源，否则降级为「说不准」
  if (ai.verdict === 'false' && !matchedOfficial) {
    ai.verdict = 'unverified';
  }

  let final = ai;
  // Vercel(serverless) 省掉二次改写调用以压低延迟、避免超过函数超时；常驻容器保留 SIMPLIFY
  if (process.env.VERCEL !== '1') {
    const simp = await callAI(SIMPLIFY_SYS, JSON.stringify(ai));
    if (simp && simp.oneLine) final = simp;
  }

  return writeVerdict(job.id, job.fingerprint, {
    claim: ai.claim || text.slice(0, 20),
    verdict: ai.verdict,
    channel: ai.channel || 'text',
    intent: ai.intent || '转述',
    oneLine: final.oneLine || ai.oneLine,
    reasons: final.reasons || ai.reasons || [],
    actions: final.actions || ai.actions || [],
    sources,
    riskPredicates: ai.riskPredicates || [],
    model: AI.MODEL,
    degraded: false,
  });
}

// 原子认领并处理指定 job（serverless 下由 getVerdict 调用）。
// 返回 { ok, verdictId, degraded } 或被其他实例认领/已完成时返回 null。
async function processJobById(id) {
  const { rows } = await pool.query(
    `UPDATE jobs SET status='running', stage=1, updated_at=$2
     WHERE id=$1 AND status IN ('pending','running')
     RETURNING id, fingerprint, raw_text, uid`,
    [Number(id), Date.now()]
  );
  const job = rows[0];
  if (!job) return null;
  try {
    return await processJob(job);
  } catch (e) {
    console.error('[worker] processJobById err', e && e.message);
    await pool
      .query(`UPDATE jobs SET status='failed', updated_at=$1 WHERE id=$2`, [Date.now(), job.id])
      .catch(() => {});
    return null;
  }
}

// 单次扫描：认领并尽力处理（最多 5 个，避免单次阻塞过久）
async function scanOnce() {
  let job;
  try {
    job = await claimNextJob();
  } catch (e) {
    console.error('[worker] claim err', e.message);
    return 0;
  }
  if (!job) return 0;
  try {
    await processJob(job);
  } catch (e) {
    console.error('[worker] process err', e.message);
    await pool
      .query(`UPDATE jobs SET status='failed', updated_at=$1 WHERE id=$2`, [Date.now(), job.id])
      .catch(() => {});
  }
  return 1;
}

// 启动后台扫描定时器（仅常驻容器用；Vercel 下由 index.js 跳过）
function startWorker(intervalMs) {
  if (process.env.DISABLE_WORKER === '1') {
    console.log('[worker] DISABLE_WORKER=1，跳过后台任务处理');
    return;
  }
  const interval = intervalMs || 5000;
  setInterval(async () => {
    try {
      let n = 0;
      for (let i = 0; i < 5; i++) {
        const c = await scanOnce();
        if (!c) break;
        n += c;
      }
      if (n) console.log('[worker] processed', n);
    } catch (e) {
      console.error('[worker] loop err', e.message);
    }
  }, interval);
  console.log('[worker] started, interval', interval, 'ms');
}

module.exports = { startWorker, processJob, processJobById, scanOnce };
