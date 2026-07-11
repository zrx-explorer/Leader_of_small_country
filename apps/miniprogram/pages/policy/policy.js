// pages/policy/policy.js
const app = getApp();
Page({
  data: {
    taxFarmer: 5, taxWorker: 8, taxMerchant: 10,
    offTax: 1, offSec: 1, offWel: 0, offMil: 0, offTea: 2,
    milRatio: 5,
    policyLocked: false, taxLocked: false, securityLocked: true,
    welfareLocked: true, militaryLocked: true,
    helpRole: '', policyTip: '', taxTip: '', taxFloor:0,
  },
  onShow() {
    const s = app.globalData.state;
    const p = s.policy;
    this.setData({
      taxFarmer: Math.round(p.tax.farmer * 100),
      taxWorker: Math.round(p.tax.worker * 100),
      taxMerchant: Math.round(p.tax.merchant * 100),
      offTax: p.officials.tax, offSec: p.officials.security,
      offWel: p.officials.welfare, offMil: p.officials.military,
      offTea: p.officials.teacher, milRatio: Math.round(p.militaryRatio * 100),
      policyLocked: !this.canAdjustPolicy(),
      taxLocked: !this.canAdjustTax(),
      securityLocked: s.year < 5 || Boolean(s.over || s.pendingEvent),
      welfareLocked: s.year < 11 || !this.canAdjustPolicy(),
      militaryLocked: s.year < 21 || !this.canAdjustPolicy(),
      policyTip: this.policyTip(), taxTip: this.taxTip(),
      taxFloor: Math.round(app.api.treatyTaxFloor(s) * 100),
    });
  },
  canAdjustPolicy() {
    const s = app.globalData.state;
    return !s.over && !s.pendingEvent && !s.pendingWar && (s.year - 1) % 3 === 0;
  },
  welfareCount() {
    return app.globalData.state.people.filter(p => !p.isCriminal && p.role === 'welfare').length;
  },
  taxInterval() {
    const count = this.welfareCount();
    return count > 10 ? 1 : Math.max(1, 11 - count);
  },
  canAdjustTax() {
    const s = app.globalData.state;
    if (s.over || s.pendingEvent || s.pendingWar) return false;
    if (s.people.length <= 100) return this.canAdjustPolicy();
    if (!this.welfareCount()) return false;
    if (s.lastTaxChangeYear == null || s.lastTaxChangeYear === s.year) return true;
    return s.year - s.lastTaxChangeYear >= this.taxInterval();
  },
  policyTip() {
    const s = app.globalData.state;
    if (this.canAdjustPolicy()) return '政策窗口开放：本年可调整公务员与军费';
    return `政策已锁定，${3 - ((s.year - 1) % 3)} 年后可再次调控`;
  },
  taxTip() {
    const s = app.globalData.state;
    const floor=app.api.treatyTaxFloor(s);
    if (floor) return `条约期内税率不得低于${Math.round(floor*100)}%`;
    if (s.people.length <= 100) return '人口不超过100：税率随常规政策窗口调整';
    const count = this.welfareCount();
    if (!count) return '人口超过100且无民生官员：税率锁定';
    const interval = this.taxInterval();
    if (this.canAdjustTax()) return `${count}名民生官员：本年可调税（间隔${interval}年）`;
    return `${count}名民生官员：${Math.max(0, interval - (s.year - s.lastTaxChangeYear))}年后可调税`;
  },
  onSlider(e) {
    const key = e.currentTarget.dataset.key;
    const s = app.globalData.state;
    const taxKeys = ['taxFarmer', 'taxWorker', 'taxMerchant'];
    const securityAllowed = key === 'offSec' && s.year >= 5 && !s.over && !s.pendingEvent && !s.pendingWar;
    const welfareAllowed = key === 'offWel' && s.year >= 11 && this.canAdjustPolicy();
    const militaryAllowed = key === 'offMil' && s.year >= 21 && this.canAdjustPolicy();
    const taxAllowed = taxKeys.indexOf(key) >= 0 && this.canAdjustTax();
    const regularAllowed = ['offTax', 'offTea', 'milRatio'].indexOf(key) >= 0 && this.canAdjustPolicy();
    if (!securityAllowed && !welfareAllowed && !militaryAllowed && !taxAllowed && !regularAllowed) {
      wx.showToast({ title: '该政策当前未解锁或仍在冷却', icon: 'none' });
      this.onShow();
      return;
    }
    const value = taxKeys.indexOf(key) >= 0 ? Math.max(e.detail.value, Math.round(app.api.treatyTaxFloor(s)*100)) : e.detail.value;
    const p = s.policy;
    const oldTax = { taxFarmer:p.tax.farmer*100, taxWorker:p.tax.worker*100, taxMerchant:p.tax.merchant*100 }[key];
    const map = {
      taxFarmer:v => p.tax.farmer=v/100, taxWorker:v => p.tax.worker=v/100,
      taxMerchant:v => p.tax.merchant=v/100, offTax:v => p.officials.tax=v,
      offSec:v => p.officials.security=v, offWel:v => p.officials.welfare=v,
      offMil:v => p.officials.military=v, offTea:v => p.officials.teacher=v,
      milRatio:v => p.militaryRatio=v/100,
    };
    map[key] && map[key](value);
    if (taxKeys.indexOf(key) >= 0 && oldTax !== value) s.lastTaxChangeYear = s.year;
    this.setData({ [key]: value, taxLocked: !this.canAdjustTax(), taxTip: this.taxTip() });
  },
  toggleOfficialHelp(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ helpRole: this.data.helpRole === role ? '' : role });
  },
});
