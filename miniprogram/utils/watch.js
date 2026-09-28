// miniprogram/utils/watch.js
// PostgreSQL 云函数无实时 watch，改为轮询 getVerdict({jobId})：
// 处理中返回 { pending:true, stage }，完成后返回 { verdictId, verdict }。
// 单页面只应保留一个 poller，卸载时务必 close()。
const { callFunction } = require('./cloud');

// 轮询任务进度，直到拿到结论或超时
function pollJob(jobId, { onTick, onDone, intervalMs = 1500, max = 40 }) {
  let n = 0;
  let timer = null;
  const tick = async () => {
    n += 1;
    try {
      const res = await callFunction('getVerdict', { jobId });
      if (res.pending) {
        onTick && onTick({ stage: res.stage || 0, status: res.status });
        if (n < max) timer = setTimeout(tick, intervalMs);
        else onDone && onDone({ timeout: true });
      } else if (res.verdictId) {
        onDone && onDone({ verdictId: res.verdictId, verdict: res.verdict, degraded: !!res.degraded });
      } else {
        onDone && onDone({ error: res });
      }
    } catch (e) {
      if (n < max) timer = setTimeout(tick, intervalMs);
      else onDone && onDone({ error: e });
    }
  };
  timer = setTimeout(tick, intervalMs);
  return { close: () => { if (timer) clearTimeout(timer); } };
}

// 兼容原 watchJob 用法：PG 无实时，统一走轮询
function watchJob(jobId, opts) {
  return pollJob(jobId, opts);
}

module.exports = { watchJob, pollJob };
