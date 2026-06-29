/**
 * 个体 / 阶级群体定义
 */
import { CLASS } from './config.js';

let _uid = 0;
export const nextId = () => ++_uid;

const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹'.split('');
const GIVEN = '安邦承德明远知礼怀仁景行守正敬文思齐修远仲平子谦伯宁元直文昌德厚清和嘉言有恒'.match(/.{1,2}/g);

export function createPerson(rng, klass, age) {
  const id = nextId();
  return {
    id,
    name: randomName(rng),
    klass,
    age: age ?? rng.int(18, 40),
    intelligence: clampInt(rng.normal(50, 15)),
    satisfaction: 12,
    grain: 42,    // 初始粮食储备
    product: 6,   // 初始产品储备
    isCriminal: false,
    isInflated: false,
    role: null,   // 公务员的具体岗位
    history: [],
  };
}

function randomName(rng) {
  const surname = SURNAMES[rng.int(0, SURNAMES.length - 1)];
  const given = GIVEN[rng.int(0, GIVEN.length - 1)];
  return surname + given;
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

export function recordPersonHistory(people, year) {
  for (const p of people) {
    if (!p.name) p.name = `无名${p.id}`;
    if (!Array.isArray(p.history)) p.history = [];
    const last = p.history[p.history.length - 1];
    const entry = {
      year,
      klass: p.klass,
      satisfaction: +p.satisfaction.toFixed(2),
    };
    if (!last || last.year !== year) p.history.push(entry);
    else Object.assign(last, entry);
    if (p.history.length > 120) p.history.shift();
  }
}
