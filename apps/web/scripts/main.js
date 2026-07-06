/**
 * Web 主入口：组合 core 引擎 + UI
 */
import {
  newGame, nextYear as advance, applyEventOption,
  serialize, deserialize,
} from '../../../packages/core/src/game.js';
import { aggregate } from '../../../packages/core/src/person.js';
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
    return !this.state.over && !this.state.pendingEvent && (this.state.year - 1) % 3 === 0;
  }
  setTax(klass, v) {
    if (!this.canAdjustPolicy()) return;
    this.state.policy.tax[klass] = v;
  }
  setOfficial(role, v) {
    if (!this.canAdjustPolicy()) return;
    this.state.policy.officials[role] = v;
  }
  setMilitaryRatio(v) {
    if (!this.canAdjustPolicy()) return;
    this.state.policy.militaryRatio = v;
  }

  applyDecree(kind) {
    if (!this.canAdjustPolicy()) return;
    if (this.state.flags.lastDecreeYear === this.state.year) return;
    const people = this.state.people;
    const affect = (klass, fn) => people.filter(p => p.klass === klass).forEach(fn);
    const decrees = {
      farming: () => {
        this.state.treasury -= 120;
        affect('farmer', p => { p.grain += 6; p.satisfaction += 2; });
        this.state.log = [`政令：劝课农桑。农民获得粮食与满意度，国库 -120。`];
      },
      workshop: () => {
        this.state.treasury -= 150;
        affect('worker', p => { p.product += 3; p.satisfaction += 1.5; });
        this.state.log = [`政令：工坊补贴。工人产品与满意度上升，国库 -150。`];
      },
      trade: () => {
        this.state.treasury += 90;
        affect('merchant', p => { p.grain += 10; p.satisfaction += 1.5; });
        this.state.people.filter(p => p.klass === 'farmer' || p.klass === 'worker')
          .forEach(p => { p.satisfaction -= 0.4; });
        this.state.log = [`政令：开放商路。国库 +90，商人受益，农工略有不满。`];
      },
      relief: () => {
        this.state.treasury -= 220;
        people.filter(p => p.satisfaction < 0).forEach(p => {
          p.grain += 8;
          p.satisfaction += 4;
        });
        this.state.log = [`政令：安民赈济。低满意国民获得粮食与安抚，国库 -220。`];
      },
    };
    if (!decrees[kind]) return;
    decrees[kind]();
    this.state.flags.lastDecreeYear = this.state.year;
    this.state.stats = aggregate(this.state.people);
    this.ui.render(this.state);
  }

  nextYear() {
    if (this.state.over) return;
    if (this.state.pendingEvent) {
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
