// pages/policy/policy.js
const app = getApp();
Page({
  data: {
    taxFarmer: 5, taxWorker: 7, taxMerchant: 10,
    offTax: 2, offSec: 1, offWel: 1, offMil: 1, offTea: 2,
    milRatio: 10,
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
    });
  },
  onSlider(e) {
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
