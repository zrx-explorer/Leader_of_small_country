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
    if (p.grain < cfg.grainNeed) dS -= 5;
    else if (p.grain < cfg.grainReserveNeed) dS -= 2;
    else dS += 0.2;

    if (p.product < cfg.productNeedBase) dS -= 5;
    else if (p.product < cfg.productReserveNeed) dS -= 1.5;

    if (p.klass === poorestClass && (p.klass === CLASS.FARMER || p.klass === CLASS.WORKER)) {
      dS -= gapPenalty * 0.3;
    }
    p.satisfaction = clamp(p.satisfaction + dS, -30, 30);
  }
}

/** 状态判定：罪犯 / 膨胀者 */
export function judgeStatus(people, cfg, securityCount, log) {
  let suppressedQuota = securityCount;  // 治安官每年可制服 N 个犯罪事件
  for (const p of people) {
    if (p.satisfaction <= cfg.rebelThreshold) {
      if (suppressedQuota > 0) {
        suppressedQuota--;
        p.satisfaction += 2;  // 制服后小幅安抚
        if (log) log.push(`🚓 治安官制服了一名罪犯（id=${p.id}）`);
      } else {
        p.isCriminal = true;
      }
    } else {
      p.isCriminal = false;
    }
    p.isInflated = p.satisfaction >= cfg.inflatedThreshold;
  }
}

/** 罪犯掠夺：随机抢一个邻居的粮食 */
export function plunder(people, rng, log) {
  if (!people.length) return;
  const criminals = people.filter(p => p.isCriminal);
  for (const c of criminals) {
    const target = people[rng.int(0, people.length - 1)];
    if (target.id === c.id) continue;
    const loot = Math.min(target.grain * 0.3, 20);
    if (loot > 0) {
      target.grain -= loot;
      c.grain += loot;
      target.satisfaction -= 1;
    }
  }
  if (criminals.length && log) log.push(`💀 ${criminals.length} 名罪犯进行了掠夺`);
}

/** 生育（修复 v1：成对配对） */
export function birth(people, rng, cfg, log) {
  const adults = people.filter(p => p.age >= cfg.birthAgeMin && p.age <= cfg.birthAgeMax);
  let births = 0;
  for (let i = 0; i + 1 < adults.length; i += 2) {
    const a = adults[i], b = adults[i + 1];
    const p = clamp((a.satisfaction + b.satisfaction) / 30, 0, 0.4);
    if (rng.chance(p)) {
      const klass = (a.klass === CLASS.OFFICIAL || b.klass === CLASS.OFFICIAL)
        ? (rng.chance(0.5) ? a.klass : b.klass)
        : a.klass;  // 子承父业（简化）
      const baby = createPerson(rng, klass, 0);
      baby.grain = 5; baby.product = 1;
      people.push(baby);
      births++;
    }
  }
  if (births && log) log.push(`👶 新生 ${births} 人`);
}

/** 老化与死亡 */
export function ageAndDie(people, rng, cfg, log) {
  let deaths = 0;
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i];
    p.age += 1;
    if (rng.chance(deathProb(p.age, cfg.deathStartAge, cfg.deathHardCap))) {
      people.splice(i, 1);
      deaths++;
    }
  }
  if (deaths && log) log.push(`🪦 ${deaths} 人逝世`);
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
      .filter(p => p.klass === from && p.grain < 0)
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
