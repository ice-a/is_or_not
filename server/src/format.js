'use strict';

// 只对外暴露结论，绝不返回原始输入文本（分享直达也只给结论）
function publicVerdict(v) {
  return {
    claim: v.claim,
    verdict: v.verdict,
    oneLine: v.one_line,
    reasons: v.reasons || [],
    actions: v.actions || [],
    sources: v.sources || [],
    intent: v.intent,
    channel: v.channel,
  };
}

module.exports = { publicVerdict };
