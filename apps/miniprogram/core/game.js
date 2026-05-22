const { DEFAULT_CONFIG, CHAPTERS, CLASS } = require('./config.js');
const { RNG } = require('./math.js');
const { seedPopulation, aggregate } = require('./person.js');
const { farmersProduce, workersProduce, trade, consume } = require('./economy.js');
const { updateSatisfaction, judgeStatus, plunder, birth, ageAndDie, classMobility } = require('./society.js');
const { assignRoles, collectTax, payWages, educate, military, securityCount } = require('./government.js');
const { rollEvent } = require('./events.js');

function defaultPolicy() {
  return {
    tax: { farmer: 0.05, worker: 0.075, merchant: 0.10 },
    militaryRatio: 0.10,
    officials: { tax: 2, security: 1, welfare: 1, military: 1, teacher: 2 },
  };
}

function newGame(opt) {
  opt = opt || {};
  const chapter = opt.chapter || 1;
  const seed = opt.seed || Date.now();
  const ch = CHAPTERS.find(c => c.id === chapter) || CHAPTERS[0];
  const rng = new RNG(seed);
  const people = seedPopulation(rng, ch.init);
  const state = {
    year: 1, chapter: ch.id, chapterName: ch.name, seed, rng,
    cfg: Object.assign({}, DEFAULT_CONFIG),
    policy: defaultPolicy(),
    treasury: 1000, people,
    log: [`【${ch.name}】游戏开始，初始人口 ${people.length}`],
    history: [], flags: {}, pendingEvent: null, over: null,
    consecutiveBadYears: 0,
  };
  state.stats = aggregate(people);
  return state;
}

function applyEventOption(state, idx) {
  const ev = state.pendingEvent;
  if (!ev) return;
  const opt = ev.options[idx] || ev.options[0];
  state.log.push(`📜 事件【${ev.title}】→ ${opt.label}`);
  opt.apply(state);
  state.pendingEvent = null;
}

function nextYear(state) {
  if (state.over) return state;
  if (state.pendingEvent) return state;
  const log = [];
  state.log = log;
  log.push(`━━ 第 ${state.year} 年 ━━`);
  assignRoles(state.people, state.policy);
  farmersProduce(state.people, state.cfg, state.rng);
  workersProduce(state.people, state.cfg, state.rng);
  trade(state.people, state.cfg, state.rng, log);
  state.treasury += collectTax(state.people, state.policy, log);
  state.treasury -= payWages(state.people, state.treasury, state.cfg, log);
  state.treasury -= military(state.treasury, state.policy, log);
  educate(state.people, state.cfg, log);
  consume(state.people, state.cfg);
  state.stats = aggregate(state.people);
  updateSatisfaction(state.people, state.cfg, state.stats);
  judgeStatus(state.people, state.cfg, securityCount(state.people), log);
  plunder(state.people, state.rng, log);
  birth(state.people, state.rng, state.cfg, log);
  ageAndDie(state.people, state.rng, state.cfg, log);
  classMobility(state.people, log);
  state.stats = aggregate(state.people);
  state.history.push(snapshot(state));
  judgeOutcome(state);
  if (!state.over) state.pendingEvent = rollEvent(state);
  state.year += 1;
  return state;
}

function snapshot(s) {
  return {
    year: s.year, population: s.stats.total,
    treasury: +s.treasury.toFixed(0),
    avgSatisfaction: s.stats.avgSatisfaction,
    avgIntelligence: s.stats.avgIntelligence,
    avgWealth: s.stats.avgWealth,
    criminals: s.stats.criminals,
    byClass: Object.assign({}, s.stats.byClass),
  };
}

function judgeOutcome(s) {
  if (s.stats.total === 0) { s.over = 'lose:人口归零'; return; }
  if (s.treasury < 0) {
    s.consecutiveBadYears += 1;
    if (s.consecutiveBadYears >= 3) { s.over = 'lose:国库连续 3 年破产'; return; }
  } else { s.consecutiveBadYears = 0; }
  if (s.stats.total > 0 && s.stats.criminals / s.stats.total > 0.30) {
    s.over = 'lose:革命爆发（罪犯比例 > 30%）'; return;
  }
  const ch = CHAPTERS.find(c => c.id === s.chapter);
  if (ch && s.year >= ch.goalYears) {
    let win = true;
    if (ch.minSatisfaction != null && s.stats.avgSatisfaction < ch.minSatisfaction) win = false;
    if (ch.minTreasury != null && s.treasury < ch.minTreasury) win = false;
    if (ch.minPopulation != null && s.stats.total < ch.minPopulation) win = false;
    if (ch.minIntelligence != null && s.stats.avgIntelligence < ch.minIntelligence) win = false;
    if (ch.allClassMinSat != null) {
      ['farmer','worker','merchant'].forEach(k => {
        if (s.stats.classCount[k] > 0 && s.stats.classSat[k] < ch.allClassMinSat) win = false;
      });
    }
    if (win) s.over = 'win';
  }
}

function serialize(s) {
  return JSON.stringify({
    year: s.year, chapter: s.chapter, seed: s.seed,
    treasury: s.treasury, people: s.people, policy: s.policy,
    flags: s.flags, history: s.history, rngState: s.rng.s,
  });
}

function deserialize(json) {
  const o = JSON.parse(json);
  const s = newGame({ chapter: o.chapter, seed: o.seed });
  s.year = o.year; s.treasury = o.treasury; s.people = o.people;
  s.policy = o.policy; s.flags = o.flags; s.history = o.history;
  s.rng.s = o.rngState;
  s.stats = aggregate(s.people);
  return s;
}

module.exports = { newGame, nextYear, applyEventOption, serialize, deserialize, CHAPTERS, CLASS };
