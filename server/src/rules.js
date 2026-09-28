'use strict';

// 官方辟谣库（P0 手维护 20 条；P1 扩到 200+ 并定时同步）。
// 关键词命中即作为「假」的佐证来源；判「假」必须命中官方来源，否则降级为「说不准」。
const OFFICIAL = [
  { kw: ['新冠疫苗', '不打疫苗', '疫苗致残'], org: '中国疾控中心', title: '疫苗接种相关科普与辟谣', url: 'http://www.chinacdc.cn' },
  { kw: ['吃', '致癌', '防癌'], org: '国家卫健委', title: '食品安全与防癌相关提示', url: 'http://www.nhc.gov.cn' },
  { kw: ['大蒜', '生姜', '洋葱', '醋泡'], org: '中国互联网联合辟谣平台', title: '关于民间偏方的核查', url: 'https://www.piyao.org.cn' },
  { kw: ['中奖', '免费领', '积分兑换'], org: '国家反诈中心', title: '中奖/积分兑换类诈骗预警', url: 'https://www.12321.cn' },
  { kw: ['安全账户', '转账', '涉嫌洗钱', '配合调查'], org: '国家反诈中心', title: '冒充公检法诈骗预警', url: 'https://www.12321.cn' },
  { kw: ['社保卡', '医保卡', '账户冻结'], org: '人力资源和社会保障部', title: '社保卡相关防骗提示', url: 'http://www.mohrss.gov.cn' },
  { kw: ['ETC', '认证', '失效'], org: '中国互联网联合辟谣平台', title: 'ETC 诈骗短信核查', url: 'https://www.piyao.org.cn' },
  { kw: ['学费', '助学', '补贴领取'], org: '教育部', title: '教育类补贴防骗提示', url: 'http://www.moe.gov.cn' },
  { kw: ['疫情', '封城', '内部爆料'], org: '中国互联网联合辟谣平台', title: '涉疫情不实信息核查', url: 'https://www.piyao.org.cn' },
  { kw: ['地震', '预言', '末日'], org: '中国地震局', title: '地震相关科普与辟谣', url: 'https://www.cea.gov.cn' },
  { kw: ['央行', '数字货币', '群发', '中奖'], org: '中国人民银行', title: '数字人民币相关防骗提示', url: 'http://www.pbc.gov.cn' },
  { kw: ['养老', '低保', '补助金'], org: '民政部', title: '养老补助类防骗提示', url: 'http://www.mca.gov.cn' },
];

// 官方库关键词匹配（按机构去重）
function matchOfficial(text) {
  const out = [];
  const seen = new Set();
  for (const item of OFFICIAL) {
    if (item.kw.some((k) => text.includes(k)) && !seen.has(item.org)) {
      seen.add(item.org);
      out.push({ org: item.org, title: item.title, url: item.url });
    }
  }
  return out;
}

// L2 规则引擎兜底（AI 不可用 / 返回非法时启用）
function ruleEngine(text) {
  const t = text || '';
  if (/(转账|汇款|安全账户|验证码|银行卡号?|冻结|通缉|涉嫌违法|配合调查|保证金|解冻金)/.test(t)) {
    return {
      verdict: 'false',
      oneLine: '这是假的，别信别转',
      reasons: ['让你先交钱才办事', '正规机构不会这样找你'],
      actions: ['别把验证码告诉别人', '拿不准打 96110 问'],
      intent: '骗钱',
      sources: matchOfficial(t),
    };
  }
  if (/(中奖|免费领|积分兑换|扫码领取|红包雨)/.test(t) && /(https?:\/\/|点击|扫码)/i.test(t)) {
    return {
      verdict: 'false',
      oneLine: '这是假的，别点里面的链接',
      reasons: ['要你点陌生链接', '要先填信息才能领'],
      actions: ['别点里面的链接', '删掉这条消息'],
      intent: '引流',
      sources: matchOfficial(t),
    };
  }
  if (/(吃.{0,4}治|治.{0,4}癌|包治|偏方|大蒜治|生姜治|洋葱治|醋泡)/.test(t)) {
    return {
      verdict: 'unverified',
      oneLine: '这事儿现在查不清，先别照着做',
      reasons: ['没找到官方医生说法', '偏方没有科学依据'],
      actions: ['先问社区医生', '别乱吃药'],
      intent: '转述',
      sources: matchOfficial(t),
    };
  }
  return {
    verdict: 'unverified',
    oneLine: '现在查不清，先别动手',
    reasons: ['没找到官方说法', '先别转钱别点链接'],
    actions: ['拿不准打 96110', '先别转发'],
    intent: '转述',
    sources: [],
  };
}

module.exports = { OFFICIAL, matchOfficial, ruleEngine };
