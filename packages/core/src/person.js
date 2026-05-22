/**
 * 个体 / 阶级群体定义
 */
import { CLASS } from './config.js';

let _uid = 0;
export const nextId = () => ++_uid;

export function createPerson(rng, klass, age) {
  return {
    id: nextId(),
    klass,
    age: age ?? rng.int(18, 40),
    intelligence: clampInt(rng.normal(50, 15)),
    satisfaction: 10,
    grain: 30,    // 初始粮食储备
    product: 4,   // 初始产品储备
    isCriminal: false,
    isInflated: false,
    role: null,   // 公务员的具体岗位
  };
}

function clampInt(x) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

/** 创建初始人口 */
export function seedPopulation(rng, init) {
  const people = [];
  for (const [klass, n] of Object.entries(init)) {
    for (let i = 0; i < n; i++) people.push(createPerson(rng, klass));
  }
  return people;
}

/** 阶级聚合统计 */
export function aggregate(people) {
  const stats = {
    total: people.length,
    byClass: { farmer: 0, worker: 0, merchant: 0, official: 0 },
    avgSatisfaction: 0,
    avgIntelligence: 0,
    avgWealth: 0,
    criminals: 0,
    inflated: 0,
    classWealth: { farmer: 0, worker: 0, merchant: 0, official: 0 },
    classSat: { farmer: 0, worker: 0, merchant: 0, official: 0 },
    classCount: { farmer: 0, worker: 0, merchant: 0, official: 0 },
  };
  if (!people.length) return stats;
  let sumS = 0, sumI = 0, sumW = 0;
  for (const p of people) {
    stats.byClass[p.klass]++;
    sumS += p.satisfaction;
    sumI += p.intelligence;
    const w = p.grain + p.product * 2;
    sumW += w;
    stats.classWealth[p.klass] += w;
    stats.classSat[p.klass] += p.satisfaction;
    stats.classCount[p.klass]++;
    if (p.isCriminal) stats.criminals++;
    if (p.isInflated) stats.inflated++;
  }
  stats.avgSatisfaction = +(sumS / people.length).toFixed(2);
  stats.avgIntelligence = +(sumI / people.length).toFixed(2);
  stats.avgWealth = +(sumW / people.length).toFixed(2);
  for (const k of Object.keys(stats.classCount)) {
    if (stats.classCount[k] > 0) {
      stats.classWealth[k] = +(stats.classWealth[k] / stats.classCount[k]).toFixed(2);
      stats.classSat[k] = +(stats.classSat[k] / stats.classCount[k]).toFixed(2);
    }
  }
  return stats;
}
