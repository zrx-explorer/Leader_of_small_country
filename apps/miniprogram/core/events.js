const EVENTS = [
  { id:'drought', title:'蝗灾来袭', desc:'今春蝗虫遮天蔽日，农田损失惨重。', weight:10,
    condition: s => s.year >= 2 && s.year % 7 === 0,
    options: [
      { label:'开仓赈灾（国库 -200）', apply: s => { s.treasury -= 200; s.people.forEach(p => p.grain += 5); s.log.push('开仓赈灾，民心稍安'); } },
      { label:'听天由命（满意度全员 -3）', apply: s => { s.people.forEach(p => p.satisfaction -= 3); s.log.push('未予赈济，民怨四起'); } },
    ] },
  { id:'merchant_caravan', title:'商队来访', desc:'远方商队请求入境贸易。', weight:8,
    condition: s => s.stats.byClass.merchant >= 2,
    options: [
      { label:'征收高税（国库 +150 / 满意度 -1）', apply: s => { s.treasury += 150; s.people.forEach(p => p.satisfaction -= 1); } },
      { label:'低税迎客（国库 +30 / 满意度 +2）', apply: s => { s.treasury += 30;  s.people.forEach(p => p.satisfaction += 2); } },
    ] },
  { id:'scholar', title:'学子上书', desc:'一位贫寒学子上书，请求开科举取士。', weight:6,
    condition: s => s.stats.avgIntelligence > 55,
    options: [
      { label:'开科举（智力均值缓慢提升）', apply: s => { s.flags.examOpen = true; s.log.push('科举已开，国之大幸'); } },
      { label:'不予理会（满意度 -2）', apply: s => { s.people.forEach(p => p.satisfaction -= 2); } },
    ] },
  { id:'good_harvest', title:'风调雨顺', desc:'今年五谷丰登。', weight:8,
    condition: s => s.year > 1,
    options: [
      { label:'加征余粮入库（国库 +300）', apply: s => { s.treasury += 300; s.people.forEach(p => p.grain -= 3); } },
      { label:'藏粮于民（满意度 +2）', apply: s => { s.people.forEach(p => p.satisfaction += 2); } },
    ] },
  { id:'rebellion_warning', title:'密报：流民聚众', desc:'探子来报，城外流民已聚众数十。', weight:5,
    condition: s => s.stats.criminals > 0,
    options: [
      { label:'增派治安官（国库 -100）', apply: s => { s.treasury -= 100; s.policy.officials.security += 1; } },
      { label:'安抚为先（粮食赈济）', apply: s => { s.people.filter(p => p.satisfaction < 0).forEach(p => { p.grain += 10; p.satisfaction += 2; }); } },
    ] },
  { id:'plague', title:'瘟疫蔓延', desc:'城中现疫情，民众惶恐。', weight:3,
    condition: s => s.year >= 5 && s.stats.total >= 30,
    options: [
      { label:'封城治疗（国库 -300）', apply: s => { s.treasury -= 300; s.log.push('疫情得到控制'); } },
      { label:'不闻不问（随机 5% 死亡）', apply: s => {
          const dead = Math.floor(s.people.length * 0.05);
          for (let i = 0; i < dead; i++) s.people.splice(s.rng.int(0, s.people.length-1), 1);
          s.log.push(`瘟疫致 ${dead} 人死亡`); } },
    ] },
  { id:'noble_invite', title:'邻国联姻', desc:'邻国遣使提亲，欲结秦晋之好。', weight:4,
    condition: s => s.year >= 8,
    options: [
      { label:'应允（国库 +500，满意度 +1）', apply: s => { s.treasury += 500; s.people.forEach(p => p.satisfaction += 1); } },
      { label:'婉拒（满意度 -1）',           apply: s => { s.people.forEach(p => p.satisfaction -= 1); } },
    ] },
  { id:'inflation', title:'通货膨胀', desc:'商人囤货居奇，物价飞涨。', weight:5,
    condition: s => s.stats.classWealth.merchant > s.stats.classWealth.farmer * 3,
    options: [
      { label:'强制平抑物价（商人满意度 -3）', apply: s => { s.people.filter(p => p.klass === 'merchant').forEach(p => p.satisfaction -= 3); } },
      { label:'听之任之（农工满意度 -2）',     apply: s => { s.people.filter(p => p.klass === 'farmer' || p.klass === 'worker').forEach(p => p.satisfaction -= 2); } },
    ] },
];

function rollEvent(state) {
  const candidates = EVENTS.filter(e => { try { return e.condition(state); } catch (_) { return false; } });
  if (!candidates.length) return null;
  if (!state.rng.chance(0.55)) return null;
  const total = candidates.reduce((s, e) => s + e.weight, 0);
  let r = state.rng.uniform(0, total);
  for (const e of candidates) { r -= e.weight; if (r <= 0) return e; }
  return candidates[candidates.length - 1];
}

module.exports = { EVENTS, rollEvent };
