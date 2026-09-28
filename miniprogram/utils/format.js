// miniprogram/utils/format.js
// 输入形态识别（与云函数保持一致即可，仅用于 UI 提示）
function detectType(text) {
  const t = (text || '').trim();
  if (/xhslink\.com|xiaohongshu\.com/i.test(t)) return 'xhs';       // 小红书
  if (/v\.douyin\.com|douyin\.com|iesdouyin/i.test(t)) return 'douyin'; // 抖音
  if (/mp\.weixin\.qq\.com/i.test(t)) return 'wemp';                // 公众号
  if (/^https?:\/\//i.test(t)) return 'web';                         // 普通网址
  // 短信特征：含【】、106 号段、无链接短文本
  if (/【.*?】|106\d{8,}|退订|验证码/i.test(t)) return 'sms';        // 短信
  return 'text';
}

const TYPE_LABEL = {
  xhs: '小红书笔记', douyin: '抖音视频', wemp: '公众号文章',
  web: '网页链接', sms: '短信', text: '文字',
};

function typeLabel(type) {
  return TYPE_LABEL[type] || '内容';
}

// 阶段文案（与云函数 stage 对应）：用户友好、拟人化
const STAGE_TEXT = {
  0: '已收到，正在准备…',
  1: '正在读你发的内容…',
  2: '正在查证是不是真的…',
  3: '正在找官方说法…',
  4: '正在把话说简单…',
};

// 结论徽标 -> 展示信息
const VERDICT_META = {
  false: { label: '这是假的，别信别转', color: '#E23B2E', emoji: '✕' },
  true: { label: '基本可信', color: '#1E9E4A', emoji: '✓' },
  unverified: { label: '还没查清，先别动手', color: '#C8920A', emoji: '?' },
};

function verdictMeta(v) {
  return VERDICT_META[v] || VERDICT_META.unverified;
}

// 相对时间
function timeAgo(ts) {
  if (!ts) return '';
  const d = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(d).toLocaleDateString('zh-CN');
}

module.exports = { detectType, typeLabel, STAGE_TEXT, verdictMeta, timeAgo };
