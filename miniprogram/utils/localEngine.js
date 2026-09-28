// miniprogram/utils/localEngine.js
// 本地规则判定引擎（前端降级 / 开发演示用）
// 当云环境未配置或云函数调用失败时启用，返回结构与云函数 aiAnalyze 一致，
// 供 verdict-card 直接渲染。规则引擎按优先级匹配第一条命中的规则。
//
// ⚠️ 上线接入真实云函数（analyze 走大模型）后，本文件作为 L2 降级保留即可，
//    不要在本地模式下把它当作"权威结论"展示给真实用户。

const { detectType } = require('./format');

// 白名单官方来源（仅这些域名可点击，见架构方案 §4.5）
const SOURCES = {
  antiFraud: {
    org: '国家反诈中心',
    title: '陌生链接与转账要求多为诈骗，可拨 96110 核实',
    url: 'https://www.12321.cn',
  },
  piyao: {
    org: '中国互联网联合辟谣平台',
    title: '关于网传不实信息的核查通报',
    url: 'https://www.piyao.org.cn',
  },
  nhc: {
    org: '国家卫生健康委员会',
    title: '健康类说法请以官方医疗机构发布为准',
    url: 'http://www.nhc.gov.cn',
  },
};

// 规则：按数组顺序匹配，命中第一条即返回
const RULES = [
  {
    // 强诈骗特征：转账 / 验证码 / 安全账户 / 涉嫌违法
    key: 'scam_money',
    test: (t) =>
      /(转账|汇款|安全账户|验证码|银行卡号?|冻结|通缉|涉嫌违法|配合调查|保证金|解冻金|刷流水|流水账)/.test(t),
    build: () => ({
      verdict: 'false',
      oneLine: '这是假的，别信别转',
      reasons: ['让你先交钱才办事', '正规机构不会这样找你', '发的人说不清出处'],
      actions: ['别把验证码告诉别人', '拿不准打 96110 问'],
      intent: '骗钱',
      riskPredicates: ['R5_要求转账', 'Y9_免费引流'],
      sources: [SOURCES.antiFraud, SOURCES.piyao],
    }),
  },
  {
    // 中奖 / 免费领 / 积分兑换 +（链接 / 点击 / 扫码）
    key: 'scam_prize',
    test: (t) =>
      /(中奖|免费领|积分兑换|兑换现金|扫码领取|红包雨|福利领取|惊喜大礼)/.test(t) &&
      /(https?:\/\/|点击|扫码|复制.{0,4}打开|aaa\.|bbb\.)/i.test(t),
    build: () => ({
      verdict: 'false',
      oneLine: '这是假的，别点里面的链接',
      reasons: ['要你点陌生链接', '要先填信息才能领', '天上不会掉馅饼'],
      actions: ['别点里面的链接', '删掉这条消息'],
      intent: '引流',
      riskPredicates: ['Y9_免费引流', 'R5_要求转账'],
      sources: [SOURCES.antiFraud, SOURCES.piyao],
    }),
  },
  {
    // 健康偏方谣言：医疗健康类一律弱化为"说不准"（架构方案 R5）
    key: 'health_myth',
    test: (t) =>
      /(吃.{0,4}治|治.{0,4}癌|包治百病|神奇.{0,3}治|偏方|醋泡|生姜治|洋葱治|大蒜治|喝.{0,4}防癌|排毒.{0,3}治)/.test(t),
    build: () => ({
      verdict: 'unverified',
      oneLine: '这事儿现在查不清，先别照着做',
      reasons: ['没找到官方医生说法', '偏方没有科学依据', '别拿身体开玩笑'],
      actions: ['先问社区医生', '别乱吃药'],
      intent: '转述',
      riskPredicates: ['R7_健康误导'],
      sources: [SOURCES.nhc],
    }),
  },
  {
    // 恐吓胁迫 + 链接 / 电话：限时、保密、别告诉别人
    key: 'scam_threat',
    test: (t) =>
      /(限时|否则|保密|别告诉(别人|家人)|马上处理|紧急处理|封你号|抓你|涉嫌违规)/.test(t) &&
      /(https?:\/\/|加微信|客服|电话|拨打|链接)/.test(t),
    build: () => ({
      verdict: 'false',
      oneLine: '这是假的，别被吓着乱点',
      reasons: ['拿你害怕的事逼你', '催你马上做决定', '正规通知不会这样'],
      actions: ['先冷静别点链接', '打 96110 问一问'],
      intent: '吓唬人',
      riskPredicates: ['Y9_免费引流', 'R5_要求转账'],
      sources: [SOURCES.antiFraud, SOURCES.piyao],
    }),
  },
  {
    // 仅含网址但无上述特征：没抓到全文，定为说不准
    key: 'url_only',
    test: (t) => /^https?:\/\//i.test(t) || /https?:\/\//i.test(t),
    build: () => ({
      verdict: 'unverified',
      oneLine: '只看到链接，没读全文，先别信',
      reasons: ['没能读到链接里的内容', '建议把文字也复制进来'],
      actions: ['别急着点链接', '把正文复制给我看'],
      intent: '转述',
      riskPredicates: [],
      sources: [],
    }),
  },
];

// 兜底：无法判定
function fallback() {
  return {
    verdict: 'unverified',
    oneLine: '现在查不清，先别动手',
    reasons: ['没找到官方说法', '先别转钱别点链接'],
    actions: ['拿不准打 96110', '先别转发'],
    intent: '转述',
    riskPredicates: [],
    sources: [],
  };
}

// 主入口：返回完整 verdict 对象
function analyze(text) {
  const t = (text || '').trim();
  const channel = detectType(t);

  let hit = null;
  for (const rule of RULES) {
    if (rule.test(t)) {
      hit = rule;
      break;
    }
  }
  const base = hit ? hit.build() : fallback();

  const claim = t.slice(0, 20).replace(/\s+/g, ' ');

  return {
    claim,
    channel,
    confidenceInternal: hit ? 'mid' : 'low',
    ...base,
  };
}

module.exports = { analyze, SOURCES };
