/**
 * 游戏主控：状态机 / 回合结算 / 存档
 */
import { DEFAULT_CONFIG, CHAPTERS, CLASS } from './config.js';
import { RNG } from './math.js';
import { seedPopulation, aggregate } from './person.js';
import { farmersProduce, workersProduce, trade, consume } from './economy.js';
import {
  updateSatisfaction, judgeStatus, plunder,
  birth, ageAndDie, classMobility,
} from './society.js';
import {
  assignRoles, collectTax, payWages, educate, military, securityCount,
} from './government.js';
import { rollEvent } from './events.js';

const DEFAULT_POLICY = () => ({
  tax: { farmer: 0.05, worker: 0.075, merchant: 0.10 },
  militaryRatio: 0.10,
  officials: { tax: 2, security: 1, welfare: 1, military: 1, teacher: 2 },
});

/** 创建游戏状态 */
export function newGame({ chapter = 1, seed = Date.now() } = {}) {
  const ch = CHAPTERS.find(c => c.id === chapter) || CHAPTERS[0];
  const rng = new RNG(seed);
  const people = seedPopulation(rng, ch.init);
  const state = {
    year: 1,
    chapter: ch.id,
    chapterName: ch.name,
    seed,
    rng,
    cfg: { ...DEFAULT_CONFIG },
    policy: DEFAULT_POLICY(),
    treasury: 1000,
    people,
    log: [`【${ch.name}】游戏开始，初始人口 ${people.length}`],
    history: [],            // 每年统计快照
    flags: {},
    pendingEvent: null,
    over: null,             // null / 'win' / 'lose:reason'
    consecutiveBadYears: 0,
  };
  state.stats = aggregate(people);
  return state;
}

/** 应用事件选项 */
export function applyEventOption(state, optionIndex) {
  const ev = state.pendingEvent;
  if (!ev) return;
  const opt = ev.options[optionIndex] || ev.options[0];
  state.log.push(`📜 事件【${ev.title}】→ ${opt.label}`);
  opt.apply(state);
  state.pendingEvent = null;
}

/** 推进一年（调用前若有 pendingEvent 必须先 applyEventOption） */
export function nextYear(state) {
  if (state.over) return state;
  if (state.pendingEvent) return state;  // 必须先决策事件
  const log = [];
  state.log = log;
  log.push(`━━ 第 ${state.year} 年 ━━`);

  // ① 分配公务员岗位
  assignRoles(state.people, state.policy);

  // ② 生产
  farmersProduce(state.people, state.cfg, state.rng);
  workersProduce(state.people, state.cfg, state.rng);

  // ③ 交易
  trade(state.people, state.cfg, state.rng, log);

  // ④ 税收 / 工资 / 军事
  state.treasury += collectTax(state.people, state.policy, log);
  state.treasury -= payWages(state.people, state.treasury, state.cfg, log);
  state.treasury -= military(state.treasury, state.policy, log);

  // ⑤ 教育
  educate(state.people, state.cfg, log);

  // ⑥ 消费
  consume(state.people, state.cfg);

  // ⑦ 满意度
  state.stats = aggregate(state.people);
  updateSatisfaction(state.people, state.cfg, state.stats);

  // ⑧ 治安 → 罪犯 / 膨胀者 → 掠夺
  judgeStatus(state.people, state.cfg, securityCount(state.people), log);
  plunder(state.people, state.rng, log);

  // ⑨ 生育与死亡
  birth(state.people, state.rng, state.cfg, log);
  ageAndDie(state.people, state.rng, state.cfg, log);

  // ⑩ 阶级流动
  classMobility(state.people, log);

  // ⑪ 重新统计
  state.stats = aggregate(state.people);
  state.history.push(snapshot(state));

  // ⑫ 胜负判定
  judgeOutcome(state);

  // ⑬ 抽取下年事件
  if (!state.over) {
    state.pendingEvent = rollEvent(state);
  }

  state.year += 1;
  return state;
}

/** 历史快照 */
function snapshot(s) {
  return {
    year: s.year,
    population: s.stats.total,
    treasury: +s.treasury.toFixed(0),
    avgSatisfaction: s.stats.avgSatisfaction,
    avgIntelligence: s.stats.avgIntelligence,
    avgWealth: s.stats.avgWealth,
    criminals: s.stats.criminals,
    byClass: { ...s.stats.byClass },
  };
}

/** 胜负判定 */
function judgeOutcome(s) {
  // 失败
  if (s.stats.total === 0) { s.over = 'lose:人口归零'; return; }
  if (s.treasury < 0) {
    s.consecutiveBadYears += 1;
    if (s.consecutiveBadYears >= 3) { s.over = 'lose:国库连续 3 年破产'; return; }
  } else {
    s.consecutiveBadYears = 0;
  }
  if (s.stats.total > 0 && s.stats.criminals / s.stats.total > 0.30) {
    s.over = 'lose:革命爆发（罪犯比例 > 30%）'; return;
  }

  // 胜利（按章节）
  const ch = CHAPTERS.find(c => c.id === s.chapter);
  if (ch && s.year >= ch.goalYears) {
    let win = true;
    if (ch.minSatisfaction != null && s.stats.avgSatisfaction < ch.minSatisfaction) win = false;
    if (ch.minTreasury != null && s.treasury < ch.minTreasury) win = false;
    if (ch.minPopulation != null && s.stats.total < ch.minPopulation) win = false;
    if (ch.minIntelligence != null && s.stats.avgIntelligence < ch.minIntelligence) win = false;
    if (ch.allClassMinSat != null) {
      for (const k of ['farmer', 'worker', 'merchant']) {
        if (s.stats.classCount[k] > 0 && s.stats.classSat[k] < ch.allClassMinSat) win = false;
      }
    }
    if (win) s.over = 'win';
  }
}

/** 序列化存档（不含 RNG 内部状态保留 seed 即可） */
export function serialize(s) {
  return JSON.stringify({
    year: s.year, chapter: s.chapter, seed: s.seed,
    treasury: s.treasury, people: s.people, policy: s.policy,
    flags: s.flags, history: s.history,
    rngState: s.rng.s,
  });
}

export function deserialize(json) {
  const o = JSON.parse(json);
  const s = newGame({ chapter: o.chapter, seed: o.seed });
  s.year = o.year; s.treasury = o.treasury; s.people = o.people;
  s.policy = o.policy; s.flags = o.flags; s.history = o.history;
  s.rng.s = o.rngState;
  s.stats = aggregate(s.people);
  return s;
}

export { CHAPTERS, CLASS, DEFAULT_CONFIG };
