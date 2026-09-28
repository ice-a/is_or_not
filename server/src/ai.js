'use strict';

const { AI } = require('./config');

// 从模型返回里稳健地抠出 JSON（兼容 ```json 围栏 / 前后多余文字）
function extractJSON(text) {
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s); // 解析失败由 callAI 的 try 捕获 → 返回 null 降级
}

// 调大模型（CloudBase AI 网关，OpenAI 兼容），返回解析后的 JSON 或 null（失败/超时降级）
async function callAI(systemPrompt, userPrompt) {
  if (!AI.KEY) {
    console.warn('[callAI] 未配置 AI_KEY，走本地规则引擎降级');
    return null;
  }
  const url = `${AI.BASE_URL.replace(/\/+$/, '')}/chat/completions`;
  // serverless（Vercel）下函数超时通常 10s，AI 调用必须设上限；
  // 超时即 abort → 返回 null → 上层降级规则引擎，避免函数被吊死导致无限轮询。
  const timeoutMs = parseInt(process.env.AI_TIMEOUT, 10) || (process.env.VERCEL === '1' ? 9000 : 25000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI.KEY}`,
      },
      body: JSON.stringify({
        model: AI.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('[callAI] HTTP', r.status, txt.slice(0, 400));
      return null;
    }
    const j = await r.json();
    const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!content) {
      console.error('[callAI] 空内容', JSON.stringify(j).slice(0, 200));
      return null;
    }
    return extractJSON(content);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      console.warn(`[callAI] 超时（>${timeoutMs}ms），降级规则引擎`);
    } else {
      console.error('[callAI] 异常', e && e.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callAI, extractJSON };
