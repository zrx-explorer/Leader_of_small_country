function applyPlague(state, plague, treatmentFactor) {
  treatmentFactor = treatmentFactor == null ? 1 : treatmentFactor;
  let infected=0, dead=0, propertyLoss=0;
  for (let i=state.people.length-1; i>=0; i--) {
    const p=state.people[i];
    if (!state.rng.chance(plague.infectionRate*treatmentFactor)) continue;
    infected++;
    const grainLoss=Math.min(Math.max(0,p.grain), plague.grainLoss*treatmentFactor);
    const productLoss=Math.min(Math.max(0,p.product), plague.productLoss*treatmentFactor);
    p.grain-=grainLoss; p.product-=productLoss; propertyLoss+=grainLoss+productLoss*2;
    const wealth=Math.max(0,p.grain+p.product*2);
    const wealthProtection=1/(1+wealth/80);
    if (state.rng.chance(plague.fatalityRate*treatmentFactor*wealthProtection)) {
      state.people.splice(i,1); dead++;
    }
  }
  state.log.push(`${plague.name}感染 ${infected} 人，死亡 ${dead} 人，定量财产损失折合 ${propertyLoss.toFixed(1)}`);
}

function plagueEvent(plague) {
  return { id:`plague_${plague.id}`, title:`瘟疫：${plague.name}`, desc:plague.desc, weight:1,
    condition:s=>s.year>=5&&s.stats.total>=30,
    options:[
      { label:'封城治疗（国库 -300，传播与致死降低）', apply:s=>{ s.treasury-=300; applyPlague(s,plague,0.35); } },
      { label:'不闻不问（按个人资产抵御死亡）', apply:s=>applyPlague(s,plague,1) },
    ] };
}

const PLAGUES = [
  plagueEvent({ id:'black', name:'黑死热', desc:'传播较慢但致死率极高，富裕者更有能力获得救治。', infectionRate:0.30, fatalityRate:0.55, grainLoss:4, productLoss:0 }),
  plagueEvent({ id:'flu', name:'赤风流感', desc:'传染率极高、致死率较低，患病者会固定损失粮食与产品。', infectionRate:0.80, fatalityRate:0.045, grainLoss:8, productLoss:1 }),
  plagueEvent({ id:'pox', name:'灰斑疫', desc:'传播与致死率居中，并会造成一定财产损失。', infectionRate:0.48, fatalityRate:0.20, grainLoss:6, productLoss:0.5 }),
];

const EVENTS = [
  { id:'drought', title:'蝗灾来袭', desc:'今春蝗虫遮天蔽日，农田损失惨重。', weight:10,
    condition: s => s.year >= 2 && s.year % 7 === 0,
    options: [
      { label:'开仓赈灾（国库 -200）', storyHook:{ speaker:'民生官', mood:'relieved', topic:'disaster_relief' }, apply: s => { s.treasury -= 200; s.people.filter(p => !p.isCriminal).forEach(p => p.grain += 5); s.log.push('开仓赈灾，民心稍安'); } },
      { label:'听天由命（满意度全员 -3）', storyHook:{ speaker:'流民', mood:'angry', topic:'disaster_neglect' }, apply: s => { s.people.forEach(p => p.satisfaction -= 3); s.log.push('未予赈济，民怨四起'); } },
    ] },
  { id:'merchant_caravan', title:'商队来访', desc:'远方商队请求入境贸易。', weight:8,
    condition: s => s.stats.byClass.merchant >= 2,
    options: [
      { label:'征收高税（国库 +150 / 满意度 -1）', storyHook:{ speaker:'商队首领', mood:'guarded', topic:'trade_tax' }, apply: s => { s.treasury += 150; s.people.forEach(p => p.satisfaction -= 1); } },
      { label:'低税迎客（国库 +30 / 满意度 +2）', storyHook:{ speaker:'商队首领', mood:'friendly', topic:'trade_open' }, apply: s => { s.treasury += 30;  s.people.forEach(p => p.satisfaction += 2); } },
    ] },
  { id:'scholar', title:'学子上书', desc:'一位贫寒学子上书，请求开科举取士。', weight:6,
    condition: s => s.stats.avgIntelligence > 55,
    options: [
      { label:'开科举（智力均值缓慢提升）', storyHook:{ speaker:'贫寒学子', mood:'hopeful', topic:'exam_open' }, apply: s => { s.flags.examOpen = true; s.log.push('科举已开，国之大幸'); } },
      { label:'不予理会（满意度 -2）', storyHook:{ speaker:'贫寒学子', mood:'disappointed', topic:'exam_rejected' }, apply: s => { s.people.forEach(p => p.satisfaction -= 2); } },
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
      { label:'安抚为先（粮食赈济）', apply: s => { s.people.filter(p => !p.isCriminal && p.satisfaction < 0).forEach(p => { p.grain += 10; p.satisfaction += 2; }); } },
    ] },
  ...PLAGUES,
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
