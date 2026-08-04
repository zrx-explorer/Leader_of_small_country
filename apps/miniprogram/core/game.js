const { DEFAULT_CONFIG, CHAPTERS, CLASS } = require('./config.js');
const { RNG } = require('./math.js');
const { seedPopulation, aggregate, recordPersonHistory, syncNextId } = require('./person.js');
const { farmersProduce, workersProduce, trade, consume } = require('./economy.js');
const { updateSatisfaction, judgeStatus, enforceSecurity, plunder, birth, ageAndDie, classMobility } = require('./society.js');
const { assignRoles, collectTax, payWages, educate, military, securityCount } = require('./government.js');
const { EVENTS, rollEvent } = require('./events.js');
const { maybeStartWar, applyWarDecision:resolveWar, estimateWarCost, treatyTaxFloor, enforceTreatyTaxFloor, settleTreatyTax } = require('./war.js');

function defaultPolicy() {
  return {
    tax: { farmer: 0.05, worker: 0.08, merchant: 0.10 },
    officialWage: DEFAULT_CONFIG.govWage,
    militaryRatio: 0.05,
    officials: { tax: 1, security: 1, welfare: 0, military: 0, teacher: 2 },
  };
}

const POLICY_PRESETS = Object.freeze({
  wellbeing:{id:'wellbeing',label:'休养生息',tax:{farmer:.03,worker:.05,merchant:.07},officialWage:15,militaryRatio:.02,rolePriority:['welfare','teacher','teacher','security','military']},
  balanced:{id:'balanced',label:'均衡治理',tax:{farmer:.06,worker:.08,merchant:.10},officialWage:10,militaryRatio:.05,rolePriority:['security','welfare','teacher','military','teacher']},
  defense:{id:'defense',label:'富国强兵',tax:{farmer:.10,worker:.12,merchant:.15},officialWage:8,militaryRatio:.12,rolePriority:['military','security','military','teacher','welfare']},
});

function roleUnlocked(role,year) {
  if(role==='security') return true;
  if(role==='welfare') return year>=11;
  if(role==='military') return year>=21;
  return true;
}

function applyPolicyPreset(state,presetId,opt) {
  opt=opt||{};
  const includeTax=opt.includeTax!==false;
  const preset=POLICY_PRESETS[presetId]||POLICY_PRESETS.balanced;
  const floor=state.treaty&&state.treaty.minTaxRate||0;
  let taxesChanged=false;
  if(includeTax){
    ['farmer','worker','merchant'].forEach(klass=>{const value=Math.max(floor,preset.tax[klass]);if(state.policy.tax[klass]!==value)taxesChanged=true;state.policy.tax[klass]=value;});
    if(taxesChanged)state.lastTaxChangeYear=state.year;
  }
  state.policy.militaryRatio=preset.militaryRatio;
  state.policy.officialWage=preset.officialWage;
  const available=state.people.filter(p=>p.klass==='official'&&!p.isCriminal).length;
  const roles={tax:0,security:0,welfare:0,military:0,teacher:0};
  const taxpayers=state.people.filter(p=>p.klass!=='official'&&!p.isCriminal).length;
  roles.tax=Math.min(available,Math.max(1,Math.ceil(taxpayers/100)));
  let remaining=available-roles.tax;
  const priority=preset.rolePriority.filter(role=>roleUnlocked(role,state.year));
  for(let i=0;remaining>0&&priority.length;i++,remaining--)roles[priority[i%priority.length]]+=1;
  state.policy.officials=roles;
  state.log.push(`采用「${preset.label}」方案：公务员配额 ${available-remaining}/${available}`+(includeTax?'':'；税率仍在冷却中'));
  return {presetId:preset.id,label:preset.label,available,allocated:available-remaining,taxesChanged};
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
    treasury: 1000,
    morality: 0,
    rationality: 0,
    people,
    log: [`【${ch.name}】游戏开始，初始人口 ${people.length}`],
    history: [], flags: {}, pendingEvent: null, pendingWar:null, treaty:null, lastWarYear:null, warHistory:[], over: null,
    consecutiveBadYears: 0,
    consecutiveCrimeYears: 0,
    consecutiveLowSatYears: 0,
    lastTaxChangeYear: null,
    lastYearChanges: null,
    recentEventIds: [],
    storyHooks: [],
    modifiers: {},
  };
  state.stats = aggregate(people);
  recordPersonHistory(state.people, state.year);
  return state;
}

function applyEventOption(state, idx) {
  const ev = state.pendingEvent;
  if (!ev) return;
  const opt = ev.options[idx] || ev.options[0];
  state.log.push(`📜 事件【${ev.title}】→ ${opt.label}`);
  opt.apply(state);
  const hiddenEffects = opt.hiddenEffects || {};
  const moralityDelta = Number(hiddenEffects.morality);
  const rationalityDelta = Number(hiddenEffects.rationality);
  state.morality = (Number.isFinite(state.morality) ? state.morality : 0)
    + (Number.isFinite(moralityDelta) ? moralityDelta : 0);
  state.rationality = (Number.isFinite(state.rationality) ? state.rationality : 0)
    + (Number.isFinite(rationalityDelta) ? rationalityDelta : 0);
  state.stats = aggregate(state.people);
  if (opt.storyHook) state.storyHooks.push(opt.storyHook);
  state.pendingEvent = null;
}

function applyWarDecision(state, decision) {
  const result = resolveWar(state, decision);
  state.stats = aggregate(state.people);
  return result;
}

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
  return Object.assign({}, state.cfg, {
    yearlyFarmMultiplier: Math.max(0.82, Math.min(1.18, farm)),
    yearlyWorkerMultiplier: Math.max(0.88, Math.min(1.12, worker)),
    yearlyPriceMultiplier: Math.max(0.90, Math.min(1.10, price)),
    yearlyBirthBonus: birth,
  });
}

function nextYear(state) {
  if (state.over) return state;
  if (state.pendingEvent || state.pendingWar) return state;
  const before={population:state.stats.total,treasury:state.treasury,avgSatisfaction:state.stats.avgSatisfaction,criminals:state.stats.criminals};
  const log = [];
  state.log = log;
  log.push(`━━ 第 ${state.year} 年 ━━`);
  const yearCfg = rollYearModifiers(state, log);
  enforceTreatyTaxFloor(state, log);
  assignRoles(state.people, state.policy, state.year);
  farmersProduce(state.people, yearCfg, state.rng);
  workersProduce(state.people, yearCfg, state.rng);
  trade(state.people, yearCfg, state.rng, log);
  const taxRevenue = collectTax(state.people, state.policy, log);
  state.treasury += settleTreatyTax(state, taxRevenue, log);
  state.treasury -= payWages(state.people, state.treasury, yearCfg, log, state.policy.officialWage);
  state.treasury -= military(state.treasury, state.policy, log);
  educate(state.people, yearCfg, log);
  consume(state.people, yearCfg);
  state.stats = aggregate(state.people);
  updateSatisfaction(state.people, yearCfg, state.stats);
  judgeStatus(state.people, state.rng, yearCfg, state.year, log);
  enforceSecurity(state.people, state.rng, securityCount(state.people), state.year, log);
  plunder(state.people, state.rng, log);
  birth(state.people, state.rng, yearCfg, log);
  ageAndDie(state.people, state.rng, yearCfg, log);
  classMobility(state.people, log);
  state.stats = aggregate(state.people);
  state.lastYearChanges={year:state.year,population:state.stats.total-before.population,treasury:Math.round(state.treasury-before.treasury),avgSatisfaction:+(state.stats.avgSatisfaction-before.avgSatisfaction).toFixed(2),criminals:state.stats.criminals-before.criminals};
  recordPersonHistory(state.people, state.year);
  state.history.push(snapshot(state));
  judgeOutcome(state);
  if (!state.over) {
    maybeStartWar(state);
    if (!state.pendingWar) state.pendingEvent = rollEvent(state);
  }
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
    treaty: s.treaty ? Object.assign({}, s.treaty) : null,
    modifiers: Object.assign({}, s.modifiers),
    byClass: Object.assign({}, s.stats.byClass),
  };
}

function judgeOutcome(s) {
  if (s.stats.total === 0) { s.over = 'lose:人口归零'; return; }
  if (s.treasury < 0) {
    s.consecutiveBadYears += 1;
    if (s.consecutiveBadYears >= 3) { s.over = 'lose:国库连续 3 年破产'; return; }
  } else { s.consecutiveBadYears = 0; }
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
  const ch = CHAPTERS.find(c => c.id === s.chapter);
  if (ch && s.year >= ch.goalYears && !s.flags.chapterGoalMet) {
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
    if (win) {
      s.flags.chapterGoalMet = true;
      s.log.push(`章节目标达成：${ch.name}。国家进入持续经营阶段。`);
    }
  }
}

function serialize(s) {
  return JSON.stringify({
    year: s.year, chapter: s.chapter, seed: s.seed,
    treasury: s.treasury, morality: s.morality, rationality: s.rationality,
    people: s.people, policy: s.policy,
    flags: s.flags, history: s.history, log: s.log,
    storyHooks: s.storyHooks, modifiers: s.modifiers,
    lastTaxChangeYear: s.lastTaxChangeYear,
    lastYearChanges:s.lastYearChanges, recentEventIds:s.recentEventIds,
    pendingEventId:s.pendingEvent&&s.pendingEvent.id||null,
    pendingWar:s.pendingWar, treaty:s.treaty,
    lastWarYear:s.lastWarYear, warHistory:s.warHistory,
    rngState: s.rng.s,
  });
}

function deserialize(json) {
  const o = JSON.parse(json);
  const s = newGame({ chapter: o.chapter, seed: o.seed });
  s.year = o.year; s.treasury = o.treasury;
  s.morality = Number.isFinite(o.morality) ? o.morality : 0;
  s.rationality = Number.isFinite(o.rationality) ? o.rationality : 0;
  s.people = o.people;
  syncNextId(s.people);
  s.people.forEach(p => { if (!p.gender) p.gender = p.id % 2 ? 'male' : 'female'; });
  s.policy=o.policy||defaultPolicy();
  if(!Number.isFinite(s.policy.officialWage))s.policy.officialWage=DEFAULT_CONFIG.govWage;
  s.flags=o.flags||{};s.history=o.history||[];
  s.log=Array.isArray(o.log)?o.log:s.log;
  s.storyHooks = o.storyHooks || []; s.modifiers = o.modifiers || {};
  s.lastTaxChangeYear = o.lastTaxChangeYear == null ? null : o.lastTaxChangeYear;
  s.lastYearChanges=o.lastYearChanges||null;
  s.recentEventIds=Array.isArray(o.recentEventIds)?o.recentEventIds.slice(-2):[];
  s.pendingEvent=o.pendingEventId?(EVENTS.find(e=>e.id===o.pendingEventId)||null):null;
  s.pendingWar=o.pendingWar||null; s.treaty=o.treaty||null;
  s.lastWarYear=o.lastWarYear==null?null:o.lastWarYear; s.warHistory=o.warHistory||[];
  s.rng.s = o.rngState;
  s.stats = aggregate(s.people);
  return s;
}

module.exports = { newGame, nextYear, applyEventOption, applyWarDecision, applyPolicyPreset, POLICY_PRESETS, estimateWarCost, treatyTaxFloor, serialize, deserialize, CHAPTERS, CLASS };
