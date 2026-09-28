'use strict';

// 任务编排：claim job → AI 定级 → verify(官方库) → 写 verdicts
// 兼容两种运行环境：
//   - 常驻容器（云托管 / CloudBase Run）：用 startWorker 的定时器扫描 pending；
//   - 无服务器（Vercel）：无常驻进程，由 getVerdict 调 processJobById 惰性处理。
const { pool } = require('./db');
const { callAI } = require('./ai');
const { ruleEngine, matchOfficial } = require('./rules');
const { ANALYZE_SYS } = require('./prompt');
const { AI } = require('./config');

// 任务超过该时长仍处 running 视为超时残留（被 serverless 冷杀/进程崩溃），允许重新认领。
// 既能恢复卡死的 job，又避免并发轮询重复认领同一条（见 processJobById）。
const STALE_MS = 60000;

// 原子认领一个待处理任务（多实例部署时用 FOR UPDATE SKIP LOCKED 避免重复处理）。
// 认领条件：pending，或 running 但已超时（updated_at 早于 now-STALE_MS）。
async function claimNextJob() {
  const now = Date.now();
  const { rows } = await pool.query(
    `UPDATE jobs SET status='running', stage=1, updated_at=$2
     WHERE id = (
       SELECT id FROM jobs
       WHERE status='pending' OR (status='running' AND updated_at < $3)
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING id, fingerprint, raw_text, uid`,
    [now, now - STALE_MS]
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

  // 合并 prompt：一次调用同时完成判定 + 老年化改写（Vercel 单轮也能产出友好文案）
  let ai = await callAI(ANALYZE_SYS, text);
  if (!ai || !ai.verdict) {
    return degrade(job);
  }

  const sources = matchOfficial(text);
  const matchedOfficial = sources.length > 0;
  // 硬约束：判「假」必须附官方来源，否则降级为「说不准」。
  // 降级时一并把 oneLine 改写为中性表述，避免"结论说不准、标题却写假消息"的自相矛盾。
  if (ai.verdict === 'false' && !matchedOfficial) {
    ai.verdict = 'unverified';
    ai.oneLine = '现在查不清，先别照着做';
  }

  return writeVerdict(job.id, job.fingerprint, {
    claim: ai.claim || text.slice(0, 20),
    verdict: ai.verdict,
    channel: ai.channel || 'text',
    intent: ai.intent || '转述',
    oneLine: ai.oneLine || '现在查不清，先别照着做',
    reasons: ai.reasons || [],
    actions: ai.actions || [],
    sources,
    riskPredicates: ai.riskPredicates || [],
    model: AI.MODEL,
    degraded: false,
  });
}

// 原子认领并处理指定 job（serverless 下由 getVerdict 调用）。
// 认领条件同 claimNextJob：pending，或超时残留的 running。
// 返回 { ok, verdictId, degraded } 或被其他实例认领/非待处理时返回 null（前端继续轮询）。
async function processJobById(id) {
  const now = Date.now();
  const { rows } = await pool.query(
    `UPDATE jobs SET status='running', stage=1, updated_at=$2
     WHERE id=$1 AND (status='pending' OR (status='running' AND updated_at < $3))
     RETURNING id, fingerprint, raw_text, uid`,
    [Number(id), now, now - STALE_MS]
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
