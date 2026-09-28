// miniprogram/components/tip-sheet/tip-sheet.js
const { recordTip } = require('../../services/tip');

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    visible: { type: Boolean, value: false },
  },
  data: {
    presets: [6, 18, 66, 88],
    selected: 6,
    custom: '',
    message: '',
    amount: 6,
    paying: false,
  },
  methods: {
    syncAmount() {
      const amt = this.data.custom ? Number(this.data.custom) : (this.data.selected || 0);
      this.setData({ amount: amt > 0 ? amt : 0 });
    },
    onMask() {
      this.triggerEvent('close');
    },
    noop() {},
    onPick(e) {
      this.setData({ selected: Number(e.currentTarget.dataset.v), custom: '' }, () => this.syncAmount());
    },
    onCustom(e) {
      const v = e.detail.value;
      // 仅保留数字与小数点
      const clean = v.replace(/[^\d.]/g, '');
      this.setData({ custom: clean, selected: 0 }, () => this.syncAmount());
    },
    onMsg(e) {
      this.setData({ message: e.detail.value });
    },
    async onPay() {
      const amount = this.data.amount;
      if (!amount || amount <= 0 || this.data.paying) return;
      this.setData({ paying: true });
      try {
        const res = await recordTip(amount, this.data.message);
        if (res && res.ok) {
          this.triggerEvent('success', { amount });
          wx.showModal({
            title: '感谢支持 🌟',
            content: `收到你 ¥${amount} 的打赏，我们会把「辨是非」做得更好！`,
            showCancel: false,
          });
          this.triggerEvent('close');
        } else {
          wx.showToast({ title: (res && res.msg) || '打赏失败', icon: 'none' });
        }
      } catch (e) {
        wx.showToast({ title: (e && e.msg) || '打赏失败，稍后再试', icon: 'none' });
      } finally {
        this.setData({ paying: false });
      }
    },
  },
});
