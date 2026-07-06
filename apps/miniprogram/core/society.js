const { CLASS } = require('./config.js');
const { wealthGapPenalty, deathProb, clamp } = require('./math.js');
const { createPerson } = require('./person.js');

function updateSatisfaction(people, cfg, stats) {
  const wealths = [];
  for (const k in stats.classWealth) if (stats.classCount[k] > 0) wealths.push(stats.classWealth[k]);
  const gap = wealths.length > 1 ? Math.max.apply(null, wealths) - Math.min.apply(null, wealths) : 0;
  const gapPenalty = wealthGapPenalty(gap);
  let poorestClass = null, poorestWealth = Infinity;
  for (const k in stats.classWealth) {
    if (stats.classCount[k] > 0 && stats.classWealth[k] < poorestWealth) {
      poorestWealth = stats.classWealth[k]; poorestClass = k;
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

function judgeStatus(people, cfg, securityCount, log) {
  let suppressedQuota = securityCount;
  for (const p of people) {
    if (p.satisfaction <= cfg.rebelThreshold) {
      if (suppressedQuota > 0) {
        suppressedQuota--; p.satisfaction += 2;
        if (log) log.push(`🚓 治安官制服了一名罪犯（id=${p.id}）`);
      } else { p.isCriminal = true; }
    } else { p.isCriminal = false; }
    p.isInflated = p.satisfaction >= cfg.inflatedThreshold;
  }
}

function plunder(people, rng, log) {
  if (!people.length) return;
  const criminals = people.filter(p => p.isCriminal);
  for (const c of criminals) {
    const target = people[rng.int(0, people.length - 1)];
    if (target.id === c.id) continue;
    const loot = Math.min(target.grain * 0.3, 20);
    if (loot > 0) {
      target.grain -= loot; c.grain += loot; target.satisfaction -= 1;
    }
  }
  if (criminals.length && log) log.push(`💀 ${criminals.length} 名罪犯进行了掠夺`);
}

function birth(people, rng, cfg, log) {
  const ranges = {
    [CLASS.FARMER]: [0.1, 0.4],
    [CLASS.WORKER]: [0.2, 0.8],
    [CLASS.MERCHANT]: [0.1, 0.6],
  };
  let births = 0;
  const summary = [];
  const total = people.length;
  const pressure = total <= cfg.populationSoftCap
    ? 1
    : clamp(1 - (total - cfg.populationSoftCap) / (cfg.populationHardCap - cfg.populationSoftCap), 0.02, 1);
  for (const klass in ranges) {
    const pair = ranges[klass];
    const count = people.filter(p => p.klass === klass && !p.isCriminal).length;
    if (!count) continue;
    const willingness = rng.uniform(pair[0], pair[1]);
    const n = Math.floor(willingness * 0.5 * count * pressure);
    for (let i = 0; i < n; i++) {
      const baby = createPerson(rng, klass, 0);
      baby.grain = 5; baby.product = 1;
      people.push(baby);
    }
    births += n;
    if (n) summary.push(`${className(klass)} ${n} 人(a=${willingness.toFixed(2)})`);
  }
  if (births && log) {
    const pressureText = pressure < 1 ? `，承载压力 ${(pressure * 100).toFixed(0)}%` : '';
    log.push(`👶 新生 ${births} 人：${summary.join('，')}${pressureText}`);
  }
}

function ageAndDie(people, rng, cfg, log) {
  let deaths = 0;
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i]; p.age += 1;
    if (rng.chance(deathProb(p.age, cfg.deathStartAge, cfg.deathHardCap))) {
      people.splice(i, 1); deaths++;
    }
  }
  if (deaths && log) log.push(`🪦 ${deaths} 人逝世`);
}

function classMobility(people, log) {
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
  for (let i = order.length - 1; i > 0; i--) {
    const from = order[i], to = order[i - 1];
    const losers = people.filter(p => p.klass === from && p.grain < 0).sort((a, b) => a.grain - b.grain);
    if (losers.length) {
      losers[0].klass = to;
      losers[0].grain = Math.max(0, losers[0].grain);
      if (log) log.push(`⬇ 一名${className(from)}降为${className(to)}`);
    }
  }
}
function className(k) {
  return ({ farmer:'农民', worker:'工人', merchant:'商人', official:'公务员' })[k];
}

module.exports = { updateSatisfaction, judgeStatus, plunder, birth, ageAndDie, classMobility };
