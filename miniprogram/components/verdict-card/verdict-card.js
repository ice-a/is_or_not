// miniprogram/components/verdict-card/verdict-card.js
const { verdictMeta } = require('../../utils/format');

Component({
  // 让组件继承 app.wxss 里定义在 page 上的设计令牌（CSS 变量）与全局类，
  // 否则组件内 var(--c-primary)/var(--fs-*) 解析失败，导致颜色与字号异常。
  options: { styleIsolation: 'apply-shared' },
  properties: {
    // verdict 对象：{ oneLine, reasons[], actions[], sources[], verdict }
    verdict: {
      type: Object,
      value: {},
      observer(val) {
        this.setData({ meta: verdictMeta(val && val.verdict) });
      },
    },
    degraded: { type: Boolean, value: false },
  },
  data: {
    meta: verdictMeta('unverified'),
    sourceOpen: false,
  },
  methods: {
    toggleSources() {
      this.setData({ sourceOpen: !this.data.sourceOpen });
    },
  },
});
