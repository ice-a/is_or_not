'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// 惰性建表：首次打赏前确保 tips 表存在（用户没手动跑 schema.sql 也能直接用）。
// 仅执行一次（缓存 Promise），幂等（IF NOT EXISTS）。
let ensureTablePromise = null;
function ensureTipsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(
        `CREATE TABLE IF NOT EXISTS public.tips (
          id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          uid          TEXT    NOT NULL DEFAULT '',
          amount_cents INTEGER NOT NULL DEFAULT 0,
          message      TEXT,
          channel      TEXT    NOT NULL DEFAULT 'demo',
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      )
      .catch((e) => {
        ensureTablePromise = null; // 允许下次重试
        throw e;
      });
  }
  return ensureTablePromise;
}

// POST /api/tip  { uid, amount, message? }
// 演示模式（默认）：直接把打赏记录写入 tips 表，不产生真实扣款。
// 适合 MVP 快速验证交互；后续接微信虚拟支付后改用 /api/tip/sign。
router.post('/', async (req, res) => {
  const uid = (req.body.uid || 'anonymous').toString();
  const amount = Number(req.body.amount);
  const message = (req.body.message || '').toString().slice(0, 200);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return res.json({ ok: false, code: 4001, msg: '金额不合法' });
  }

  try {
    await ensureTipsTable();
    await pool.query(
      `INSERT INTO tips (uid, amount_cents, message, channel)
       VALUES ($1, $2, $3, 'demo')`,
      [uid, Math.round(amount * 100), message]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('[tip] insert failed:', e.message);
    return res.json({ ok: false, code: 5000, msg: '记录失败，请稍后再试' });
  }
});

// POST /api/tip/sign  { uid, amount }
// 微信小程序虚拟支付签名接口（wx.requestVirtualPayment）。
// 真实接入需要：
//   1) 小程序后台开通「虚拟支付」能力并创建对应道具（如「打赏-咖啡」）；
//   2) 在云托管/服务端配置虚拟支付商户私钥、appid 等，并按官方规则生成 paySign；
//   3) 前端 config.USE_VIRTUAL_PAY=true 时走该签名路径。
// 当前未配置密钥，返回未启用，前端自动降级为演示直录。
router.post('/sign', async (req, res) => {
  const configured = !!process.env.VIRTUAL_PAY_KEY;
  if (!configured) {
    return res.json({ ok: false, code: 4010, msg: '虚拟支付未配置，当前为演示模式' });
  }
  // TODO: 用 process.env.VIRTUAL_PAY_KEY 等按微信官方规则生成签名参数并返回给前端。
  // 返回字段示例：{ ok:true, signData: { prepayId, paySign, signature, ... } }
  return res.json({ ok: false, code: 4011, msg: '签名逻辑待接入' });
});

module.exports = router;
