/**
 * Web 主入口：组合 core 引擎 + UI
 */
import {
  newGame, nextYear as advance, applyEventOption,
  applyWarDecision, estimateWarCost, treatyTaxFloor, serialize, deserialize,
} from '../../../packages/core/src/game.js';
import { UI } from './ui.js';

const SAVE_KEY = 'xiaoguo.save.v1';

class Controller {
  constructor() {
    this.state = newGame({ chapter: 1, seed: Date.now() });
    this.ui = new UI(this);
    this.ui.render(this.state);
    if (!localStorage.getItem('xiaoguo.tutorial.shown')) {
      this.ui.startTutorial([
        '欢迎来到《小国执政官》。先点击右下角"⏯ 下一年"，看一遍数据如何变化。',
        '左侧"政策调控"可以调整税率与公务员配额。试试把农民税率调到 5%。',
        '执政路上会随机触发事件，事件没有最优解，请谨慎抉择。',
      ]);
      localStorage.setItem('xiaoguo.tutorial.shown', '1');
    }
  }

  // === 玩家交互 ===
  canAdjustPolicy() {
    return !this.state.over && !this.state.pendingEvent && !this.state.pendingWar && (this.state.year - 1) % 3 === 0;
  }
  welfareCount() {
    return this.state.people.filter(p => !p.isCriminal && p.role === 'welfare').length;
  }
  taxInterval() {
    const count = this.welfareCount();
    return count > 10 ? 1 : Math.max(1, 11 - count);
  }
  canAdjustTax() {
    const s = this.state;
    if (s.over || s.pendingEvent || s.pendingWar) return false;
    if (s.people.length <= 100) return this.canAdjustPolicy();
    if (this.welfareCount() === 0) return false;
    if (s.lastTaxChangeYear == null || s.lastTaxChangeYear === s.year) return true;
    return s.year - s.lastTaxChangeYear >= this.taxInterval();
  }
  setTax(klass, v) {
    if (!this.canAdjustTax()) return;
    v = Math.max(v, treatyTaxFloor(this.state));
    if (this.state.policy.tax[klass] === v) return;
    this.state.policy.tax[klass] = v;
    this.state.lastTaxChangeYear = this.state.year;
  }
  setOfficial(role, v) {
    if (role === 'security') {
      if (this.state.over || this.state.pendingEvent || this.state.pendingWar || this.state.year < 5) return;
    } else {
      if (!this.canAdjustPolicy()) return;
      if (role === 'welfare' && this.state.year < 11) return;
      if (role === 'military' && this.state.year < 21) return;
    }
    this.state.policy.officials[role] = v;
  }
  setMilitaryRatio(v) {
    if (!this.canAdjustPolicy()) return;
    this.state.policy.militaryRatio = v;
  }

  nextYear() {
    if (this.state.over) return;
    if (this.state.pendingEvent || this.state.pendingWar) {
      // 事件未决策则提示
      return;
    }
    advance(this.state);
    this.ui.render(this.state);
  }

  chooseEvent(idx) {
    applyEventOption(this.state, idx);
    this.ui.render(this.state);
  }

  chooseWar(decision) {
    applyWarDecision(this.state, decision);
    this.ui.render(this.state);
  }

  estimateWar(plan) { return estimateWarCost(this.state, plan); }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, serialize(this.state));
      alert('已存档（槽位 1）');
    } catch (e) {
      alert('存档失败：' + e.message);
    }
  }

  load() {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) { alert('暂无存档'); return; }
    try {
      this.state = deserialize(s);
      this.ui.render(this.state);
    } catch (e) {
      alert('读档失败：' + e.message);
    }
  }

  restart() {
    this.state = newGame({ chapter: 1, seed: Date.now() });
    document.getElementById('log-list').innerHTML = '';
    this.ui.render(this.state);
  }
}

window.__game = new Controller();
