/**
 * 社会行为：满意度、罪犯、膨胀者、生育、死亡、阶级流动
 */
import { CLASS } from './config.js';
import { wealthGapPenalty, deathProb, clamp } from './math.js';
import { createPerson } from './person.js';

/** 计算满意度变化 */
export function updateSatisfaction(people, cfg, stats) {
  // 阶级间财富差
  const wealths = Object.entries(stats.classWealth)
    .filter(([k]) => stats.classCount[k] > 0)
    .map(([, v]) => v);
  const gap = wealths.length > 1 ? Math.max(...wealths) - Math.min(...wealths) : 0;
  const gapPenalty = wealthGapPenalty(gap);
  // 找到最穷的阶级
  let poorestClass = null, poorestWealth = Infinity;
  for (const [k, v] of Object.entries(stats.classWealth)) {
    if (stats.classCount[k] > 0 && v < poorestWealth) {
      poorestWealth = v; poorestClass = k;
    }
  }

  for (const p of people) {
    let dS = 0;
    if (p.grain < cfg.grainNeed) dS -= 3;
    else if (p.grain < cfg.grainReserveNeed) dS -= 1;
    else dS += 0.5;

    if (p.product < cfg.productNeedBase) dS -= 1;
    else if (p.product < cfg.productReserveNeed) dS -= 0.2;

    if (p.klass === poorestClass && (p.klass === CLASS.FARMER || p.klass === CLASS.WORKER)) {
      dS -= gapPenalty * 0.3;
    }
    p.satisfaction = clamp(p.satisfaction + dS, -30, 30);
  }
}

/** 状态判定：满意度过低或过高都可能走向犯罪；前五年不会产生罪犯。 */
export function judgeStatus(people, rng, cfg, year, log) {
  if (year < cfg.crimeStartYear) return;
  let added = 0;
  for (const p of people) {
    if (p.isCriminal) continue;
    const lowSeverity = Math.max(0, cfg.rebelThreshold - p.satisfaction);
    const highSeverity = Math.max(0, p.satisfaction - cfg.inflatedThreshold);
    const chance = lowSeverity > 0
      ? Math.min(0.45, cfg.lowCrimeChance + lowSeverity * 0.02)
      : highSeverity > 0
        ? Math.min(0.30, cfg.highCrimeChance + highSeverity * 0.012)
        : 0;
    if (chance > 0 && rng.chance(chance)) {
      p.isCriminal = true;
      p.isInflated = highSeverity > 0;
      added++;
    }
    p.isInflated = p.satisfaction >= cfg.inflatedThreshold;
  }
  if (added && log) log.push(`💀 满意度失衡新增 ${added} 名罪犯`);
}

/** 治安：少于 10 人时每 2 人处理 1 名，达到 10 人后每人处理 1 名。 */
export function enforceSecurity(people, rng, securityCount, year, log) {
  if (year < 5 || securityCount <= 0) return;
  const quota = securityCount < 10 ? Math.floor(securityCount / 2) : securityCount;
  const criminals = people.filter(p => p.isCriminal).slice(0, quota);
  let reformed = 0, removed = 0;
  for (const criminal of criminals) {
    if (rng.chance(0.4)) {
      criminal.isCriminal = false;
      criminal.isInflated = false;
      criminal.klass = CLASS.FARMER;
      criminal.role = null;
      criminal.satisfaction = 0;
      reformed++;
    } else {
      const index = people.indexOf(criminal);
      if (index >= 0) people.splice(index, 1);
      removed++;
    }
  }
  if (criminals.length && log) log.push(`🚓 治安官消除 ${criminals.length} 名罪犯（从良 ${reformed}，移除 ${removed}）`);
}

/** 罪犯掠夺：随机抢一个邻居的粮食 */
export function plunder(people, rng, log) {
  if (!people.length) return;
  const criminals = people.filter(p => p.isCriminal);
  for (const c of criminals) {
    const victims = people.filter(p => !p.isCriminal && p.id !== c.id);
    if (!victims.length) break;
    const target = victims[rng.int(0, victims.length - 1)];
    const loot = Math.min(target.grain * 0.3, 20);
    if (loot > 0) {
      target.grain -= loot;
      target.satisfaction -= 1;
    }
  }
  if (criminals.length && log) log.push(`💀 ${criminals.length} 名罪犯进行了掠夺`);
}

/** 生育：只有同阶级育龄的一男一女配对后才可能生育。 */
export function birth(people, rng, cfg, log) {
  if (people.length >= cfg.populationHardCap) return;
  const rates = {
    [CLASS.FARMER]: cfg.birthRateFarmer,
    [CLASS.WORKER]: cfg.birthRateWorker,
    [CLASS.MERCHANT]: cfg.birthRateMerchant,
  };
  let births = 0;
  const summary = [];
  const pressure = Math.max(0, 1 - people.length / cfg.populationSoftCap);
  const resourceFactor = Math.max(0.15, Math.min(1, people.filter(p => !p.isCriminal && p.grain >= cfg.grainReserveNeed).length / Math.max(1, people.length)));
  for (const [klass, baseRate] of Object.entries(rates)) {
    const fertile = people.filter(p => p.klass === klass && !p.isCriminal && p.age >= cfg.birthAgeMin && p.age <= cfg.birthAgeMax);
    const males = fertile.filter(p => p.gender === 'male').length;
    const females = fertile.filter(p => p.gender === 'female').length;
    const couples = Math.min(males, females);
    if (!couples) continue;
    const rate = Math.max(0, baseRate + (cfg.yearlyBirthBonus || 0)) * pressure * resourceFactor;
    let n = 0;
    for (let i = 0; i < couples; i++) if (rng.chance(rate)) n++;
    n = Math.min(n, cfg.populationHardCap - people.length);
    for (let i = 0; i < n; i++) {
      const baby = createPerson(rng, klass, 0);
      baby.grain = 5; baby.product = 1;
      people.push(baby);
    }
    births += n;
    if (n) summary.push(`${className(klass)} ${n} 人（${couples} 对育龄伴侣）`);
  }
  if (births && log) log.push(`👶 新生 ${births} 人：${summary.join('，')}`);
}

/** 老化与死亡 */
export function ageAndDie(people, rng, cfg, log) {
  const causes = { accident: 0, age: 0, starvation: 0 };
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i];
    p.age += 1;
    let cause = null;
    if (rng.chance(cfg.accidentDeathRate)) cause = 'accident';
    else if (rng.chance(deathProb(p.age, cfg.deathStartAge, cfg.deathHardCap))) cause = 'age';
    else if (p.grain < 0 && rng.chance(Math.min(0.5, cfg.starvationDeathRate + Math.abs(p.grain) / 200))) cause = 'starvation';
    if (cause) {
      people.splice(i, 1);
      causes[cause]++;
    }
  }
  const deaths = causes.accident + causes.age + causes.starvation;
  if (deaths && log) log.push(`🪦 ${deaths} 人逝世（事故 ${causes.accident}、年老 ${causes.age}、饥饿 ${causes.starvation}）`);
}

/** 阶级流动：阶层升降 */
export function classMobility(people, log) {
  // 升级：各阶级智力最高者，连续 3 年达标，进入更高阶级
  const order = [CLASS.FARMER, CLASS.WORKER, CLASS.MERCHANT];
  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i], to = order[i + 1];
    const candidates = people
      .filter(p => p.klass === from && !p.isCriminal && p.satisfaction > 0)
      .sort((a, b) => b.intelligence - a.intelligence);
    if (candidates.length > 3 && candidates[0].intelligence > 70) {
      candidates[0].klass = to;
      if (log) log.push(`⬆ 一名${className(from)}升为${className(to)}`);
    }
  }
  // 降级：连续低资产者下降
  for (let i = order.length - 1; i > 0; i--) {
    const from = order[i], to = order[i - 1];
    const losers = people
      .filter(p => p.klass === from && !p.isCriminal && p.grain < 0)
      .sort((a, b) => a.grain - b.grain);
    if (losers.length) {
      losers[0].klass = to;
      losers[0].grain = Math.max(0, losers[0].grain);
      if (log) log.push(`⬇ 一名${className(from)}降为${className(to)}`);
    }
  }
}

function className(k) {
  return ({ farmer: '农民', worker: '工人', merchant: '商人', official: '公务员' })[k];
}
