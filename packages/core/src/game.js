/**
 * 游戏主控：状态机 / 回合结算 / 存档
 */
import { DEFAULT_CONFIG, CHAPTERS, CLASS } from './config.js';
import { RNG } from './math.js';
import { seedPopulation, aggregate, recordPersonHistory } from './person.js';
import { farmersProduce, workersProduce, trade, consume } from './economy.js';
import {
  updateSatisfaction, judgeStatus, enforceSecurity, plunder,
  birth, ageAndDie, classMobility,
} from './society.js';
import {
  assignRoles, collectTax, payWages, educate, military, securityCount,
} from './government.js';
import { rollEvent } from './events.js';
import {
  maybeStartWar, applyWarDecision as resolveWar, estimateWarCost,
  treatyTaxFloor, enforceTreatyTaxFloor, settleTreatyTax,
} from './war.js';

const DEFAULT_POLICY = () => ({
  tax: { farmer: 0.05, worker: 0.08, merchant: 0.10 },
  militaryRatio: 0.05,
  officials: { tax: 1, security: 1, welfare: 0, military: 0, teacher: 2 },
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
    pendingWar: null,
    treaty: null,
    lastWarYear: null,
    warHistory: [],
    over: null,             // null / 'win' / 'lose:reason'
    consecutiveBadYears: 0,
    consecutiveCrimeYears: 0,
    consecutiveLowSatYears: 0,
    lastTaxChangeYear: null,
    storyHooks: [],
    modifiers: {},
  };
  state.stats = aggregate(people);
  recordPersonHistory(state.people, state.year);
  return state;
}

/** 应用事件选项 */
export function applyEventOption(state, optionIndex) {
  const ev = state.pendingEvent;
  if (!ev) return;
  const opt = ev.options[optionIndex] || ev.options[0];
  state.log.push(`📜 事件【${ev.title}】→ ${opt.label}`);
  opt.apply(state);
  if (opt.storyHook) state.storyHooks.push(opt.storyHook);
  state.pendingEvent = null;
}

export function applyWarDecision(state, decision) {
  const result = resolveWar(state, decision);
  state.stats = aggregate(state.people);
  return result;
}

export { estimateWarCost, treatyTaxFloor };

/** 年度随机波动：提供轻微差异，避免相同操作每局完全一致 */
function rollYearModifiers(state, log) {
  const farm = state.rng.normal(1, 0.08);
  const worker = state.rng.normal(1, 0.05);
  const price = state.rng.normal(1, 0.04);
  const birth = state.rng.uniform(-0.015, 0.015);
  state.modifiers = {
    farm: +farm.toFixed(3),
    worker: +worker.toFixed(3),
    price: +price.toFixed(3),
    birth: +birth.toFixed(3),
  };
  if (farm > 1.08) log.push('雨水充沛，农产略增');
  else if (farm < 0.92) log.push('天气欠佳，农产略减');
  if (price > 1.05) log.push('市价微涨，交易成本提高');
  else if (price < 0.95) log.push('市价平稳偏低，交易更顺畅');
  return {
    ...state.cfg,
    yearlyFarmMultiplier: Math.max(0.82, Math.min(1.18, farm)),
    yearlyWorkerMultiplier: Math.max(0.88, Math.min(1.12, worker)),
    yearlyPriceMultiplier: Math.max(0.90, Math.min(1.10, price)),
    yearlyBirthBonus: birth,
  };
}

/** 推进一年（调用前若有 pendingEvent 必须先 applyEventOption） */
export function nextYear(state) {
  if (state.over) return state;
  if (state.pendingEvent || state.pendingWar) return state;  // 必须先决策
  const log = [];
  state.log = log;
  log.push(`━━ 第 ${state.year} 年 ━━`);
  const yearCfg = rollYearModifiers(state, log);
  enforceTreatyTaxFloor(state, log);

  // ① 分配公务员岗位
  assignRoles(state.people, state.policy, state.year);

  // ② 生产
  farmersProduce(state.people, yearCfg, state.rng);
  workersProduce(state.people, yearCfg, state.rng);

  // ③ 交易
  trade(state.people, yearCfg, state.rng, log);

  // ④ 税收 / 工资 / 军事
  const taxRevenue = collectTax(state.people, state.policy, log);
  state.treasury += settleTreatyTax(state, taxRevenue, log);
  state.treasury -= payWages(state.people, state.treasury, state.cfg, log);
  state.treasury -= military(state.treasury, state.policy, log);

  // ⑤ 教育
  educate(state.people, yearCfg, log);

  // ⑥ 消费
  consume(state.people, yearCfg);

  // ⑦ 满意度
  state.stats = aggregate(state.people);
  updateSatisfaction(state.people, yearCfg, state.stats);

  // ⑧ 治安 → 罪犯 / 膨胀者 → 掠夺
  judgeStatus(state.people, state.rng, yearCfg, state.year, log);
  enforceSecurity(state.people, state.rng, securityCount(state.people), state.year, log);
  plunder(state.people, state.rng, log);

  // ⑨ 生育与死亡
  birth(state.people, state.rng, yearCfg, log);
  ageAndDie(state.people, state.rng, yearCfg, log);

  // ⑩ 阶级流动
  classMobility(state.people, log);

  // ⑪ 重新统计
  state.stats = aggregate(state.people);
  recordPersonHistory(state.people, state.year);
  state.history.push(snapshot(state));

  // ⑫ 胜负判定
  judgeOutcome(state);

  // ⑬ 战争优先于普通事件
  if (!state.over) {
    maybeStartWar(state);
    if (!state.pendingWar) state.pendingEvent = rollEvent(state);
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
    treaty: s.treaty ? { ...s.treaty } : null,
    modifiers: { ...s.modifiers },
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
  if (s.stats.total > 0 && s.stats.criminals / s.stats.total > 0.45) {
    s.consecutiveCrimeYears += 1;
    if (s.consecutiveCrimeYears >= 2) { s.over = 'lose:革命爆发（罪犯比例连续 2 年 > 45%）'; return; }
  } else {
    s.consecutiveCrimeYears = 0;
  }
  if (s.stats.avgSatisfaction < -24) {
    s.consecutiveLowSatYears += 1;
    if (s.consecutiveLowSatYears >= 5) { s.over = 'lose:民心尽失，执政官下台'; return; }
  } else {
    s.consecutiveLowSatYears = 0;
  }

  // 章节目标达成后不强制结束，进入可持续经营。
  const ch = CHAPTERS.find(c => c.id === s.chapter);
  if (ch && s.year >= ch.goalYears && !s.flags.chapterGoalMet) {
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
    if (win) {
      s.flags.chapterGoalMet = true;
      s.log.push(`章节目标达成：${ch.name}。国家进入持续经营阶段。`);
    }
  }
}

/** 序列化存档（不含 RNG 内部状态保留 seed 即可） */
export function serialize(s) {
  return JSON.stringify({
    year: s.year, chapter: s.chapter, seed: s.seed,
    treasury: s.treasury, people: s.people, policy: s.policy,
    flags: s.flags, history: s.history,
    storyHooks: s.storyHooks, modifiers: s.modifiers,
    lastTaxChangeYear: s.lastTaxChangeYear,
    pendingWar: s.pendingWar, treaty: s.treaty,
    lastWarYear: s.lastWarYear, warHistory: s.warHistory,
    rngState: s.rng.s,
  });
}

export function deserialize(json) {
  const o = JSON.parse(json);
  const s = newGame({ chapter: o.chapter, seed: o.seed });
  s.year = o.year; s.treasury = o.treasury; s.people = o.people;
  for (const p of s.people) {
    if (!p.gender) p.gender = p.id % 2 ? 'male' : 'female';
  }
  s.policy = o.policy; s.flags = o.flags; s.history = o.history;
  s.storyHooks = o.storyHooks || []; s.modifiers = o.modifiers || {};
  s.lastTaxChangeYear = o.lastTaxChangeYear ?? null;
  s.pendingWar = o.pendingWar || null; s.treaty = o.treaty || null;
  s.lastWarYear = o.lastWarYear ?? null; s.warHistory = o.warHistory || [];
  s.rng.s = o.rngState;
  s.stats = aggregate(s.people);
  return s;
}

export { CHAPTERS, CLASS, DEFAULT_CONFIG };
