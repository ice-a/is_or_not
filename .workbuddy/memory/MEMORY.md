# 辨是非小程序 · 项目长期记忆

原生微信小程序 + 微信云开发，面向老年用户的谣言/骗局识别工具（MVP）。

## 结构
- 前端四页：home / result / history / mine（tabBar 仅 3 项：查一查 / 历史 / 我的）。
- 组件：verdict-card（结论卡）。
- 服务/工具：services/analyze、services/history、utils/cloud、utils/watch、utils/format、utils/localEngine。

## 当前状态（2026-09-24）
- 前端闭环已完成，含本地规则引擎降级（`config.FORCE_LOCAL=true` 开发演示开关）。
- 后端云函数（analyze / worker / getVerdict / feedback 等）尚未实现。

## 上线前置
- 填 `CLOUD_ENV` + `FORCE_LOCAL=false` + 实现云函数 + 大模型 API + ICP 备案 + 类目「工具-信息查询」。

## 关键约定（来自 docs/架构方案.md）
- 结论仅 3 档（false / true / unverified），禁止百分比、置信度数字。
- 医疗健康类一律降为 unverified（R5 风险）。
- 结果页须显式标注「本结论由人工智能生成，仅供参考」。
- 来源仅白名单域名可点；"假"必须附官方来源，否则强制降为说不准。
- 适老化：正文 ≥18px、最小点击热区 56px、长辈模式整体放大。
