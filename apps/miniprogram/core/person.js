let _uid = 0;
const nextId = () => ++_uid;
const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹'.split('');
const GIVEN = '安邦承德明远知礼怀仁景行守正敬文思齐修远仲平子谦伯宁元直文昌德厚清和嘉言有恒'.match(/.{1,2}/g);

function clampInt(x) { return Math.max(0, Math.min(100, Math.round(x))); }

function createPerson(rng, klass, age) {
  const id = nextId();
  return {
    id, name: randomName(rng), klass, age: age != null ? age : rng.int(18, 40),
    gender: rng.chance(0.5) ? 'male' : 'female',
    intelligence: clampInt(rng.normal(50, 15)),
    satisfaction: 12, grain: 42, product: 6,
    isCriminal: false, isInflated: false, role: null, history: [],
  };
}

function randomName(rng) {
  return SURNAMES[rng.int(0, SURNAMES.length - 1)] + GIVEN[rng.int(0, GIVEN.length - 1)];
}

function seedPopulation(rng, init) {
  const people = [];
  for (const klass in init) {
    for (let i = 0; i < init[klass]; i++) people.push(createPerson(rng, klass));
  }
  return people;
}

function aggregate(people) {
  const stats = {
    total: people.length,
    byClass: { farmer:0, worker:0, merchant:0, official:0 },
    avgSatisfaction:0, avgIntelligence:0, avgWealth:0, criminals:0, inflated:0,
    classWealth:{ farmer:0, worker:0, merchant:0, official:0 },
    classSat:{ farmer:0, worker:0, merchant:0, official:0 },
    classCount:{ farmer:0, worker:0, merchant:0, official:0 },
  };
  if (!people.length) return stats;
  let sumS=0, satCount=0, sumI=0, sumW=0;
  const classSatCount = { farmer:0, worker:0, merchant:0, official:0 };
  for (const p of people) {
    stats.byClass[p.klass]++;
    if (!p.isCriminal) {
      sumS += p.satisfaction; satCount++;
      stats.classSat[p.klass] += p.satisfaction; classSatCount[p.klass]++;
    }
    sumI += p.intelligence;
    const w = p.grain + p.product*2; sumW += w;
    stats.classWealth[p.klass] += w;
    stats.classCount[p.klass]++;
    if (p.isCriminal) stats.criminals++;
    if (p.isInflated) stats.inflated++;
  }
  stats.avgSatisfaction = satCount ? +(sumS/satCount).toFixed(2) : 0;
  stats.avgIntelligence = +(sumI/people.length).toFixed(2);
  stats.avgWealth = +(sumW/people.length).toFixed(2);
  for (const k in stats.classCount) {
    if (stats.classCount[k] > 0) {
      stats.classWealth[k] = +(stats.classWealth[k]/stats.classCount[k]).toFixed(2);
      stats.classSat[k] = classSatCount[k] ? +(stats.classSat[k]/classSatCount[k]).toFixed(2) : 0;
    }
  }
  return stats;
}

function recordPersonHistory(people, year) {
  for (const p of people) {
    if (!p.name) p.name = `无名${p.id}`;
    if (!Array.isArray(p.history)) p.history = [];
    const last = p.history[p.history.length - 1];
    const entry = { year, klass: p.klass, satisfaction: +p.satisfaction.toFixed(2) };
    if (!last || last.year !== year) p.history.push(entry);
    else Object.assign(last, entry);
    if (p.history.length > 120) p.history.shift();
  }
}

module.exports = { createPerson, seedPopulation, aggregate, recordPersonHistory, nextId };
