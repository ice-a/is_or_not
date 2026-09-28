# 辨是非小程序 · 项目长期记忆

原生微信小程序 + **Express 后端 + PostgreSQL**，面向老年用户的谣言/骗局识别工具（MVP）。后端同时兼容两种部署：**Vercel + Supabase（serverless，当前主选）** 与 **CloudBase 云托管（常驻容器）**。

## 架构（2026-09-28 重大调整）
- 后端为 `server/` 下的 Express 应用；已推送 GitHub `ice-a/is_or_not`（分支 main）。
- **双部署兼容关键点**：
  - 任务处理：`worker.js` 的 `processJobById(id)` 由 `getVerdict` 路由惰性调用（serverless 下无常驻进程也能跑）；常驻容器额外用 `startWorker()` 的 `setInterval` 扫描（仅当 `VERCEL!=='1'` 时启动）。
  - `index.js` 用 `require.main===module` 守卫 `app.listen`，被 `api/index.js` 引入（Vercel）时不监听端口。
  - `ai.js` 带 `AbortController` 超时（Vercel 默认 `AI_TIMEOUT=9000`），超时降级规则引擎，避免超函数 10s 限制。
  - Vercel 入口：`api/index.js` + `vercel.json`（全路由 rewrite → `/api/index`）；根 `package.json` 供 Vercel 安装 express/pg/cors。
- 前端四页：home / result / history / mine（tabBar 仅 3 项）。组件：verdict-card。
- 服务/工具：services/analyze、services/history、utils/cloud、utils/watch、utils/format、utils/localEngine。
- 前端调用：`config.USE_CLOUD_CONTAINER=true` → `wx.cloud.callContainer({path:'/api/'+name})`；`false` → `wx.request` 直连 `API_BASE`。`pollJob` 轮询 getVerdict（max 40×1.5s 重试）。
- AI：CloudBase AI 网关（OpenAI 兼容，模型 hy3），密钥仅存环境变量 `AI_KEY`。
- DB：PostgreSQL 经 `pg` 连接池，读 `DATABASE_URL`（Supabase pooler 串 + `DATABASE_SSL=1`；或云托管注入）。建表 `server/db/schema.sql`（public，BIGINT IDENTITY + JSONB）。
- 已删 `cloudfunctions/`（旧云函数含硬编码 JWT）；`cloudbase/` 为旧 PostgREST 遗留，不再使用。

## 当前状态（2026-09-28）
- 前端闭环完成（含本地规则引擎降级 `FORCE_LOCAL`）。
- 后端 Express 已重构为 serverless 兼容，全部 `node --check` 通过；待推 GitHub 并由 Vercel 关联部署。

## 上线前置（Vercel + Supabase）
- Supabase 建项目 → SQL Editor 跑 `server/db/schema.sql` → 复制 Transaction pooler 连接串。
- Vercel 关联 GitHub `ice-a/is_or_not`、框架默认（用 api/ + vercel.json）、环境变量：`DATABASE_URL`(pooler)、`DATABASE_SSL=1`、`VERCEL=1`、`AI_BASE_URL`/`AI_KEY`/`AI_MODEL=hy3`、`AI_TIMEOUT=9000`。
- 小程序端：`USE_CLOUD_CONTAINER=false` + `API_BASE=<Vercel 分配的域名>`（DevTools 勾「不校验合法域名」），或上线后配 request 合法域名。
- 仍须：大模型 API + ICP 备案 + 类目「工具-信息查询」。

## 关键约定（来自 docs/架构方案.md）
- 结论仅 3 档（false / true / unverified），禁止百分比、置信度数字。
- 医疗健康类一律降为 unverified（R5 风险）。
- 结果页须显式标注「本结论由人工智能生成，仅供参考」。
- 来源仅白名单域名可点；"假"必须附官方来源，否则强制降为说不准。
- 适老化：正文 ≥18px、最小点击热区 56px、长辈模式整体放大。
