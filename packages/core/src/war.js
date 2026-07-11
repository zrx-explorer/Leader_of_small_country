import { OFFICIAL_ROLE } from './config.js';

const SUPPLY_COST = [0, 5, 10, 18];
const EQUIPMENT_COST = [0, 8, 18, 34];

export function eligibleConscripts(people) {
  return people.filter(p => !p.isCriminal && p.age >= 18 && p.age <= 50);
}

export function estimateWarCost(state, plan) {
  const rate = clamp(Number(plan.conscriptionRate) || 0.2, 0.05, 0.5);
  const supply = clampInt(plan.supplyLevel, 1, 3);
  const equipment = clampInt(plan.equipmentLevel, 1, 3);
  const eligible = eligibleConscripts(state.people).length;
  const troops = eligible ? Math.max(1, Math.round(eligible * rate)) : 0;
  const perTroop = 2 + SUPPLY_COST[supply] + EQUIPMENT_COST[equipment];
  return { troops, perTroop, total: troops * perTroop, supply, equipment, rate };
}

export function maybeStartWar(state) {
  if (state.year < 20 || state.pendingWar || state.treaty) return null;
  if (state.lastWarYear != null && state.year - state.lastWarYear < 4) return null;
  const eligible = eligibleConscripts(state.people).length;
  if (eligible < 8 || !state.rng.chance(0.20)) return null;
  const enemyStrength = Math.max(6, Math.round(eligible * state.rng.uniform(0.18, 0.55)));
  const enemies = ['北境联盟', '河西公国', '东岭王国', '南海诸侯'];
  state.pendingWar = {
    id: `war_${state.year}`,
    year: state.year,
    enemyName: state.rng.pick(enemies),
    enemyStrength,
    eligible,
    offeredTreaty: createTreaty(state, false),
  };
  return state.pendingWar;
}

export function applyWarDecision(state, decision) {
  const war = state.pendingWar;
  if (!war) return null;
  const action = decision?.action || 'fight';
  let result;
  if (action === 'surrender') result = surrender(state, war);
  else if (action === 'treaty') result = signTreaty(state, war, war.offeredTreaty);
  else result = fight(state, war, decision || {});
  state.lastWarYear = state.year;
  state.warHistory = state.warHistory || [];
  state.warHistory.push(result);
  if (state.warHistory.length > 40) state.warHistory.shift();
  state.pendingWar = null;
  return result;
}

export function treatyTaxFloor(state) {
  return treatyActive(state) ? (state.treaty.minTaxRate || 0) : 0;
}

export function enforceTreatyTaxFloor(state, log) {
  if (state.treaty && state.year > state.treaty.endYear) {
    if (log) log.push(`📜 对外赔款条约期满，税率限制解除`);
    state.treaty = null;
    return;
  }
  const floor = treatyTaxFloor(state);
  if (!floor) return;
  let changed = false;
  for (const klass of ['farmer', 'worker', 'merchant']) {
    if (state.policy.tax[klass] < floor) {
      state.policy.tax[klass] = floor;
      changed = true;
    }
  }
  if (changed && log) log.push(`📜 条约要求税率不得低于 ${(floor * 100).toFixed(0)}%，已自动调整`);
}

export function settleTreatyTax(state, taxRevenue, log) {
  if (!treatyActive(state)) return taxRevenue;
  const taxPayment = taxRevenue * (state.treaty.taxShare || 0);
  const payment = taxPayment + (state.treaty.annualFlat || 0);
  if (log) log.push(`🏳 条约赔款 -${payment.toFixed(1)}（税收分成 ${taxPayment.toFixed(1)}）`);
  return taxRevenue - payment;
}

function fight(state, war, decision) {
  const plan = estimateWarCost(state, decision);
  state.treasury -= plan.total;
  const assignedMilitary = state.people.filter(p => !p.isCriminal && p.role === OFFICIAL_ROLE.MILITARY).length;
  const availableOfficials = state.people.filter(p => !p.isCriminal && p.klass === 'official').length;
  const militaryOfficials = state.year >= 21
    ? Math.max(assignedMilitary, Math.min(availableOfficials, state.policy.officials.military || 0))
    : assignedMilitary;
  const command = 1 + Math.min(15, militaryOfficials) * 0.025;
  const preparedness = 1 + Math.min(0.30, (state.policy.militaryRatio || 0) * 0.6);
  const readiness = 0.55 + plan.supply * 0.30 + plan.equipment * 0.40;
  const power = plan.troops * readiness * command * preparedness * state.rng.uniform(0.88, 1.12);
  const ratio = power / Math.max(1, war.enemyStrength);
  let outcome, casualtyRate, satisfaction;
  if (ratio >= 1.2) {
    outcome = 'victory'; casualtyRate = state.rng.uniform(0.12, 0.22); satisfaction = 2;
  } else if (ratio >= 0.85) {
    outcome = 'costly_victory'; casualtyRate = state.rng.uniform(0.26, 0.40); satisfaction = 0.5;
  } else {
    outcome = 'defeat'; casualtyRate = state.rng.uniform(0.50, 0.70); satisfaction = -4;
  }
  const casualties = removeRandomPeople(state, eligibleConscripts(state.people), Math.round(plan.troops * casualtyRate));
  let civilianCasualties = 0, treaty = null, reward = 0;
  if (outcome === 'defeat') {
    civilianCasualties = removeRandomPeople(
      state,
      state.people.filter(p => !p.isCriminal),
      Math.round(state.people.length * state.rng.uniform(0.01, 0.035)),
    );
    treaty = createTreaty(state, true);
    activateTreaty(state, treaty);
  } else {
    reward = Math.round(Math.min(plan.total * 0.30, war.enemyStrength * 3));
    state.treasury += reward;
  }
  state.people.forEach(p => { if (!p.isCriminal) p.satisfaction += satisfaction; });
  const label = outcome === 'victory' ? '胜利' : outcome === 'costly_victory' ? '惨胜' : '战败';
  state.log.push(`⚔ 对${war.enemyName}战争${label}：征兵 ${plan.troops}，军费 ${plan.total.toFixed(0)}，阵亡 ${casualties}${civilianCasualties ? `，平民死亡 ${civilianCasualties}` : ''}${reward ? `，战利品 ${reward}` : ''}`);
  return { year:state.year, action:'fight', outcome, troops:plan.troops, cost:plan.total, casualties, civilianCasualties, reward, treaty };
}

function surrender(state, war) {
  const payment = Math.round(Math.max(300, state.people.length * 4, Math.max(0, state.treasury) * 0.30));
  state.treasury -= payment;
  state.people.forEach(p => { if (!p.isCriminal) p.satisfaction -= 3; });
  state.log.push(`🏳 向${war.enemyName}投降，直接赔款 ${payment}`);
  return { year:state.year, action:'surrender', outcome:'surrender', cost:payment, casualties:0 };
}

function signTreaty(state, war, treaty) {
  activateTreaty(state, treaty);
  state.people.forEach(p => { if (!p.isCriminal) p.satisfaction -= 1.5; });
  state.log.push(`📜 与${war.enemyName}签订 ${treaty.duration} 年赔款条约：立即赔款 ${treaty.upfront}，每年固定 ${treaty.annualFlat}${treaty.taxShare ? ` + 税收 ${(treaty.taxShare*100).toFixed(0)}%` : ''}${treaty.minTaxRate ? `，税率不得低于 ${(treaty.minTaxRate*100).toFixed(0)}%` : ''}`);
  return { year:state.year, action:'treaty', outcome:'treaty', cost:treaty.upfront, casualties:0, treaty:{...treaty} };
}

function createTreaty(state, punitive) {
  const duration = state.rng.int(punitive ? 5 : 3, punitive ? 8 : 6);
  const hasTaxClause = state.rng.chance(punitive ? 0.90 : 0.65);
  const treasury = Math.max(0, state.treasury);
  return {
    duration,
    upfront: Math.round(Math.max(punitive ? 250 : 120, treasury * (punitive ? 0.16 : 0.08))),
    annualFlat: Math.round(Math.max(40, state.people.length * (punitive ? 0.50 : 0.30))),
    taxShare: hasTaxClause ? +(state.rng.uniform(punitive ? 0.30 : 0.20, punitive ? 0.50 : 0.40).toFixed(2)) : 0,
    minTaxRate: hasTaxClause ? state.rng.int(punitive ? 8 : 5, punitive ? 16 : 13) / 100 : 0,
  };
}

function activateTreaty(state, treaty) {
  state.treasury -= treaty.upfront;
  state.treaty = { ...treaty, startYear:state.year, endYear:state.year + treaty.duration - 1 };
  enforceTreatyTaxFloor(state, state.log);
}

function treatyActive(state) {
  return Boolean(state.treaty && state.year <= state.treaty.endYear);
}

function removeRandomPeople(state, candidates, count) {
  let removed = 0;
  const pool = candidates.slice();
  while (removed < count && pool.length) {
    const pick = state.rng.int(0, pool.length - 1);
    const person = pool.splice(pick, 1)[0];
    const index = state.people.indexOf(person);
    if (index >= 0) { state.people.splice(index, 1); removed++; }
  }
  return removed;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function clampInt(x, lo, hi) { return Math.round(clamp(Number(x) || lo, lo, hi)); }
