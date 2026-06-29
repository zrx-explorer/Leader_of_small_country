// pages/policy/policy.js
const app = getApp();
Page({
  data: {
    taxFarmer: 5, taxWorker: 8, taxMerchant: 10,
    offTax: 1, offSec: 1, offWel: 0, offMil: 0, offTea: 2,
    milRatio: 5,
    policyLocked: false,
    policyTip: '',
  },
  onShow() {
    const p = app.globalData.state.policy;
    this.setData({
      taxFarmer: Math.round(p.tax.farmer * 100),
      taxWorker: Math.round(p.tax.worker * 100),
      taxMerchant: Math.round(p.tax.merchant * 100),
      offTax: p.officials.tax,
      offSec: p.officials.security,
      offWel: p.officials.welfare,
      offMil: p.officials.military,
      offTea: p.officials.teacher,
      milRatio: Math.round(p.militaryRatio * 100),
      policyLocked: !this.canAdjustPolicy(),
      policyTip: this.policyTip(),
    });
  },
  canAdjustPolicy() {
    const s = app.globalData.state;
    return !s.over && !s.pendingEvent && (s.year - 1) % 3 === 0;
  },
  policyTip() {
    const s = app.globalData.state;
    if (this.canAdjustPolicy()) return '政策窗口开放：本年可调整税率、公务员与军费';
    return `政策已锁定，${3 - ((s.year - 1) % 3)} 年后可再次调控`;
  },
  onSlider(e) {
    if (!this.canAdjustPolicy()) {
      wx.showToast({ title: '政策每三年开放一次', icon: 'none' });
      this.onShow();
      return;
    }
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    const p = app.globalData.state.policy;
    const map = {
      taxFarmer:   v => p.tax.farmer = v/100,
      taxWorker:   v => p.tax.worker = v/100,
      taxMerchant: v => p.tax.merchant = v/100,
      offTax:      v => p.officials.tax = v,
      offSec:      v => p.officials.security = v,
      offWel:      v => p.officials.welfare = v,
      offMil:      v => p.officials.military = v,
      offTea:      v => p.officials.teacher = v,
      milRatio:    v => p.militaryRatio = v/100,
    };
    map[key] && map[key](value);
    this.setData({ [key]: value });
  },
});
