/**
 * 随机事件库。
 * 每个选项都必须同时声明可见收益、可见代价，以及隐藏的善恶值和理性值变化。
 */
import { syncNextId } from './person.js';

function option(label, benefit, cost, hiddenEffects, apply, storyHook) {
  return { label, tradeoffs: { benefit, cost }, hiddenEffects, apply, storyHook };
}

function citizens(state, klass) {
  return state.people.filter(p => !p.isCriminal && (!klass || p.klass === klass));
}

function shiftSatisfaction(state, amount, predicate = () => true) {
  state.people.filter(p => !p.isCriminal && predicate(p)).forEach(p => { p.satisfaction += amount; });
}

function maxPersonId(state) {
  return state.people.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
}

function admitRefugees(state) {
  const room = Math.max(0, (state.cfg?.populationHardCap || 2000) - state.people.length);
  const count = Math.min(room, Math.max(3, Math.min(12, Math.round(state.people.length * 0.08))));
  let id = maxPersonId(state);
  for (let i = 0; i < count; i++) {
    const klass = i % 3 === 2 ? 'worker' : 'farmer';
    state.people.push({
      id: ++id,
      name: `新民${id}`,
      klass,
      age: state.rng.int(16, 45),
      gender: state.rng.chance(0.5) ? 'male' : 'female',
      intelligence: Math.round(state.rng.normal(42, 12)),
      satisfaction: -12,
      grain: 3,
      product: 0,
      isCriminal: false,
      isInflated: false,
      role: null,
      history: [],
      refugeeWave: state.year,
    });
  }
  state.flags.refugeeArrivalYear = state.year;
  state.flags.refugeeIntegrationResolved = false;
  syncNextId(state.people);
  return count;
}

function applyPlague(state, plague, treatmentFactor = 1) {
  let infected = 0, dead = 0, propertyLoss = 0;
  for (let i = state.people.length - 1; i >= 0; i--) {
    const p = state.people[i];
    if (!state.rng.chance(plague.infectionRate * treatmentFactor)) continue;
    infected++;
    const grainLoss = Math.min(Math.max(0, p.grain), plague.grainLoss * treatmentFactor);
    const productLoss = Math.min(Math.max(0, p.product), plague.productLoss * treatmentFactor);
    p.grain -= grainLoss;
    p.product -= productLoss;
    propertyLoss += grainLoss + productLoss * 2;
    const wealth = Math.max(0, p.grain + p.product * 2);
    const wealthProtection = 1 / (1 + wealth / 80);
    if (state.rng.chance(plague.fatalityRate * treatmentFactor * wealthProtection)) {
      state.people.splice(i, 1);
      dead++;
    }
  }
  state.log.push(`${plague.name}感染 ${infected} 人，死亡 ${dead} 人，财产损失折合 ${propertyLoss.toFixed(1)}`);
}

function plagueEvent(plague) {
  return {
    id: `plague_${plague.id}`,
    title: `瘟疫：${plague.name}`,
    desc: plague.desc,
    weight: 1,
    condition: s => s.year >= 5 && s.stats.total >= 30,
    options: [
      option(
        '封城治疗（传播、致死降至 35%；国库 -300）',
        '显著降低感染、死亡和财产损失', '支出 300，封城扰乱财政',
        { morality: 2, rationality: 3 },
        s => { s.treasury -= 300; applyPlague(s, plague, 0.35); },
        { speaker: '医官', mood: 'focused', topic: 'plague_lockdown' },
      ),
      option(
        '维持开放（国库 +60；疫情全额扩散）',
        '商贸不停摆，国库增加 60', '承受完整感染、死亡和财产损失',
        { morality: -3, rationality: -2 },
        s => { s.treasury += 60; applyPlague(s, plague, 1); },
        { speaker: '医官', mood: 'desperate', topic: 'plague_ignored' },
      ),
    ],
  };
}

const PLAGUES = [
  plagueEvent({ id: 'black', name: '黑死热', desc: '传播较慢但致死率极高，富裕者更有能力获得救治。', infectionRate: 0.30, fatalityRate: 0.55, grainLoss: 4, productLoss: 0 }),
  plagueEvent({ id: 'flu', name: '赤风流感', desc: '传染率极高、致死率较低，患病者会固定损失粮食与产品。', infectionRate: 0.80, fatalityRate: 0.045, grainLoss: 8, productLoss: 1 }),
  plagueEvent({ id: 'pox', name: '灰斑疫', desc: '传播与致死率居中，并会造成一定财产损失。', infectionRate: 0.48, fatalityRate: 0.20, grainLoss: 6, productLoss: 0.5 }),
];

export const EVENTS = [
  {
    id: 'drought', title: '蝗灾来袭', desc: '今春蝗虫遮天蔽日，农田损失惨重。', weight: 10,
    condition: s => s.year >= 2 && s.year % 7 === 0,
    options: [
      option('开仓赈灾（每人粮食 +5、满意 +1；国库 -200）', '补粮并稳定民心', '国库支出 200', { morality: 3, rationality: 1 }, s => {
        s.treasury -= 200; citizens(s).forEach(p => { p.grain += 5; p.satisfaction += 1; }); s.log.push('开仓赈灾，灾区得到口粮');
      }, { speaker: '民生官', mood: 'relieved', topic: 'disaster_relief' }),
      option('征购民粮保国库（国库 +100；农民粮食 -6、满意 -3）', '国库增加 100', '农民承担粮食与民心损失', { morality: -3, rationality: -2 }, s => {
        s.treasury += 100; citizens(s, 'farmer').forEach(p => { p.grain -= 6; p.satisfaction -= 3; }); s.log.push('官府强征余粮，乡间怨声四起');
      }, { speaker: '流民', mood: 'angry', topic: 'disaster_levy' }),
    ],
  },
  {
    id: 'merchant_caravan', title: '商队来访', desc: '远方商队请求入境贸易。', weight: 8,
    condition: s => s.stats.byClass.merchant >= 2,
    options: [
      option('征收重税（国库 +150；商人满意 -3）', '国库立刻增加 150', '商人不满，商路受损', { morality: -1, rationality: 1 }, s => {
        s.treasury += 150; shiftSatisfaction(s, -3, p => p.klass === 'merchant');
      }, { speaker: '商队首领', mood: 'guarded', topic: 'trade_tax' }),
      option('补贴通商（商民满意 +2、商人产品 +2；国库 -60）', '扩大商品供给并提高满意度', '国库支出 60', { morality: 1, rationality: 2 }, s => {
        s.treasury -= 60; shiftSatisfaction(s, 2); citizens(s, 'merchant').forEach(p => { p.product += 2; });
      }, { speaker: '商队首领', mood: 'friendly', topic: 'trade_open' }),
    ],
  },
  {
    id: 'scholar', title: '学子上书', desc: '一位贫寒学子上书，请求开科举取士。', weight: 6,
    condition: s => s.stats.avgIntelligence > 55 && !s.flags.examOpen,
    options: [
      option('开科举（候选者智力 +1；国库 -120）', '开启科举并提升人才智力', '筹办考试支出 120', { morality: 2, rationality: 3 }, s => {
        s.treasury -= 120; s.flags.examOpen = true; citizens(s).sort((a, b) => b.intelligence - a.intelligence).slice(0, 6).forEach(p => { p.intelligence = Math.min(100, p.intelligence + 1); }); s.log.push('科举开办，寒门有了晋身之阶');
      }, { speaker: '贫寒学子', mood: 'hopeful', topic: 'exam_open' }),
      option('维持旧制（国库 +40；非官员满意 -2）', '省下并变卖筹考物资，国库增加 40', '堵塞上升通道，民心下降', { morality: -1, rationality: -2 }, s => {
        s.treasury += 40; shiftSatisfaction(s, -2, p => p.klass !== 'official');
      }, { speaker: '贫寒学子', mood: 'disappointed', topic: 'exam_rejected' }),
    ],
  },
  {
    id: 'good_harvest', title: '风调雨顺', desc: '今年五谷丰登。', weight: 8,
    condition: s => s.year > 1,
    options: [
      option('加征余粮（国库 +300；每人粮食 -3）', '国库增加 300', '居民交出余粮', { morality: -2, rationality: 1 }, s => {
        s.treasury += 300; citizens(s).forEach(p => { p.grain -= 3; });
      }, { speaker: '税务官', mood: 'proud', topic: 'harvest_tax' }),
      option('修仓藏粮于民（满意 +2；国库 -60）', '民心提升并保留民间储备', '修缮粮仓支出 60', { morality: 2, rationality: 1 }, s => {
        s.treasury -= 60; shiftSatisfaction(s, 2);
      }, { speaker: '乡老', mood: 'grateful', topic: 'harvest_people' }),
    ],
  },
  {
    id: 'rebellion_warning', title: '密报：流民聚众', desc: '探子来报，城外流民已聚众数十。', weight: 5,
    condition: s => s.stats.criminals > 0,
    options: [
      option('扩充治安配额（治安 +1；国库 -100、民众满意 -1）', '增加今后的治安处理能力', '财政支出且高压引发不安', { morality: -1, rationality: 2 }, s => {
        s.treasury -= 100; s.policy.officials.security += 1; shiftSatisfaction(s, -1);
      }, { speaker: '治安官', mood: 'stern', topic: 'unrest_security' }),
      option('赈济安抚（低满意者粮食 +10、满意 +3；国库 -140）', '缓和潜在动乱者的不满', '国库支出 140，现有罪犯仍在', { morality: 2, rationality: 1 }, s => {
        s.treasury -= 140; citizens(s).filter(p => p.satisfaction < 0).forEach(p => { p.grain += 10; p.satisfaction += 3; });
      }, { speaker: '流民代表', mood: 'wary', topic: 'unrest_relief' }),
    ],
  },
  ...PLAGUES,
  {
    id: 'noble_invite', title: '邻国联姻', desc: '邻国遣使提亲，欲结秦晋之好。', weight: 4,
    condition: s => s.year >= 8 && !s.flags.allianceDecisionYear,
    options: [
      option('应允联姻（国库 +420、满意 +1；每人产品 -1）', '获得聘礼与外交声望', '抽调民间产品作为回礼，并留下盟约义务', { morality: 1, rationality: 1 }, s => {
        s.treasury += 420; citizens(s).forEach(p => { p.satisfaction += 1; p.product = Math.max(0, p.product - 1); }); s.flags.allianceDecisionYear = s.year;
      }, { speaker: '邻国使者', mood: 'pleased', topic: 'alliance_accept' }),
      option('婉拒并维持自主（满意 +1；国库 -80）', '民众认可国家自主', '支付外交礼金 80', { morality: -1, rationality: 2 }, s => {
        s.treasury -= 80; shiftSatisfaction(s, 1); s.flags.allianceDecisionYear = s.year;
      }, { speaker: '邻国使者', mood: 'cold', topic: 'alliance_reject' }),
    ],
  },
  {
    id: 'inflation', title: '通货膨胀', desc: '商人囤货居奇，物价飞涨。', weight: 5,
    condition: s => s.stats.byClass.merchant > 0 && s.stats.classWealth.merchant > s.stats.classWealth.farmer * 3 && !s.flags.merchantPunishedYear,
    options: [
      option('惩办囤货商（农工满意 +2；国库 -80、1 名商人降为农民）', '压低物价并安抚农工', '执法支出且商人阶层缩减', { morality: 1, rationality: 2 }, s => {
        s.treasury -= 80; shiftSatisfaction(s, 2, p => p.klass === 'farmer' || p.klass === 'worker');
        const merchant = citizens(s, 'merchant').sort((a, b) => b.grain - a.grain)[0];
        if (merchant) { merchant.klass = 'farmer'; merchant.role = null; merchant.satisfaction -= 4; }
        citizens(s, 'merchant').forEach(p => { p.satisfaction -= 3; });
        s.flags.merchantPunishedYear = s.year; s.flags.merchantBacklashResolved = false;
        s.log.push('首恶商人被没收行商资格，降为农民');
      }, { speaker: '商人', mood: 'resentful', topic: 'price_control' }),
      option('允许高价交易（商人粮食 +30、满意 +2；农工满意 -3）', '商人积累资本并维持交易积极性', '农民和工人承受高物价', { morality: -2, rationality: -1 }, s => {
        citizens(s, 'merchant').forEach(p => { p.grain += 30; p.satisfaction += 2; }); shiftSatisfaction(s, -3, p => p.klass === 'farmer' || p.klass === 'worker');
      }, { speaker: '工匠', mood: 'tired', topic: 'inflation_ignored' }),
    ],
  },
  {
    id: 'farmer_petition', title: '佃农叩阙', desc: '农民跪在宫门外，控诉地方豪强侵占田地、加收私租。', weight: 8,
    condition: s => s.year >= 3 && s.stats.byClass.farmer >= 8,
    options: [
      option('彻查并退还田粮（农民粮食 +5、满意 +3；国库 -150、官员满意 -1）', '返还被侵田粮并安抚农民', '调查支出且触怒官场', { morality: 3, rationality: 2 }, s => {
        s.treasury -= 150; citizens(s, 'farmer').forEach(p => { p.grain += 5; p.satisfaction += 3; }); shiftSatisfaction(s, -1, p => p.klass === 'official'); s.log.push('官府清查乡里，受侵田粮陆续发还');
      }, { speaker: '上访农民', mood: 'hopeful', topic: 'farmer_petition_investigate' }),
      option('驱散请愿者（国库 +100；农民粮食 -2、满意 -4）', '没收违禁物资，国库增加 100', '农民蒙受损失并积累怨气', { morality: -3, rationality: -1 }, s => {
        s.treasury += 100; citizens(s, 'farmer').forEach(p => { p.grain -= 2; p.satisfaction -= 4; }); s.log.push('请愿者被逐出城门，乡间怨气更盛');
      }, { speaker: '上访农民', mood: 'angry', topic: 'farmer_petition_suppressed' }),
    ],
  },
  {
    id: 'criminal_sentencing', title: '重犯待决', desc: '一名落网罪犯被押至堂前：是教化挽救，还是严刑震慑？', weight: 7,
    condition: s => s.year >= 6 && s.stats.criminals > 0,
    options: [
      option('感化并安排生计（1 人从良；国库 -80、公众满意 -0.5）', '保留人口并使一名罪犯从良', '安置支出且公众担忧再犯', { morality: 3, rationality: 1 }, s => {
        const criminal = s.people.find(p => p.isCriminal); s.treasury -= 80; shiftSatisfaction(s, -0.5);
        if (criminal) { criminal.isCriminal = false; criminal.isInflated = false; criminal.klass = 'farmer'; criminal.role = null; criminal.satisfaction = Math.max(0, criminal.satisfaction); criminal.grain += 8; s.flags.reformedPrisoner = { id: criminal.id, year: s.year, resolved: false }; s.log.push(`${criminal.name || '罪犯'}获准从良，官府为其安排了生计`); }
      }, { speaker: '待决罪犯', mood: 'remorseful', topic: 'criminal_reformed' }),
      option('严刑处决（移除 1 名罪犯、公众满意 +0.5；国库 -20）', '立刻消除一名罪犯并形成震慑', '国家失去一名人口并承担行刑费用', { morality: -3, rationality: -1 }, s => {
        s.treasury -= 20; const index = s.people.findIndex(p => p.isCriminal); if (index >= 0) { const [criminal] = s.people.splice(index, 1); shiftSatisfaction(s, 0.5); s.log.push(`${criminal.name || '重犯'}被处决，人口永久减少 1`); }
      }, { speaker: '刑狱官', mood: 'stern', topic: 'criminal_executed' }),
    ],
  },
  {
    id: 'corrupt_official', title: '库银失窃', desc: '审计发现赈济款失窃，线索指向资深官员。', weight: 6,
    condition: s => s.year >= 5 && s.stats.byClass.official >= 3 && !s.flags.corruptionCaseYear,
    options: [
      option('公开审理（国库 +120、百姓满意 +1；移除 1 名公务员）', '追回赃款并赢得民心', '公务员人口和行政能力永久减少', { morality: 2, rationality: 3 }, s => {
        s.treasury += 120; const index = s.people.findIndex(p => p.klass === 'official' && !p.isCriminal); if (index >= 0) s.people.splice(index, 1); shiftSatisfaction(s, 1, p => p.klass !== 'official'); shiftSatisfaction(s, -2, p => p.klass === 'official'); s.flags.corruptionCaseYear = s.year; s.flags.corruptionOutcome = 'purged'; s.flags.corruptionAftershockResolved = false; s.log.push('贪官被革职下狱，公务员人口减少 1');
      }, { speaker: '审计官', mood: 'focused', topic: 'corruption_exposed' }),
      option('压下案卷（官员满意 +2；国库 -50、百姓满意 -1）', '保住现有公务员与短期官场稳定', '支付封口成本并损害民心', { morality: -2, rationality: -1 }, s => {
        s.treasury -= 50; shiftSatisfaction(s, 2, p => p.klass === 'official'); shiftSatisfaction(s, -1, p => p.klass !== 'official'); s.flags.corruptionCaseYear = s.year; s.flags.corruptionOutcome = 'covered'; s.flags.corruptionAftershockResolved = false;
      }, { speaker: '审计官', mood: 'disappointed', topic: 'corruption_hidden' }),
    ],
  },
  {
    id: 'workshop_dispute', title: '工坊停工', desc: '工匠指控商人压低工价，商会声称成本高涨。', weight: 6,
    condition: s => s.year >= 4 && s.stats.byClass.worker >= 3 && s.stats.byClass.merchant >= 1,
    options: [
      option('核账调解（工人与商人满意 +2；国库 -80）', '恢复劳资双方信心', '调解支出 80', { morality: 2, rationality: 3 }, s => {
        s.treasury -= 80; shiftSatisfaction(s, 2, p => p.klass === 'worker' || p.klass === 'merchant');
      }, { speaker: '工匠代表', mood: 'hopeful', topic: 'workshop_mediated' }),
      option('强令复工（国库 +150、商人满意 +2；工人满意 -3）', '恢复商会利润并增加国库', '工人承担强制劳动的不满', { morality: -2, rationality: 1 }, s => {
        s.treasury += 150; shiftSatisfaction(s, -3, p => p.klass === 'worker'); shiftSatisfaction(s, 2, p => p.klass === 'merchant');
      }, { speaker: '工匠代表', mood: 'angry', topic: 'workshop_forced' }),
    ],
  },
  {
    id: 'refugees_at_gate', title: '灾民叩关', desc: '邻境受灾，大批饥民聚集在关外，请求入境避难。', weight: 5,
    condition: s => s.year >= 7 && s.stats.total >= 25 && !s.flags.refugeeArrivalYear,
    options: [
      option('开关安置（新增低满意人口；国库按人支出 20）', '增加农民和工人人口', '新民满意度 -12、资源匮乏，今后仅按概率可能犯罪', { morality: 3, rationality: 1 }, s => {
        const count = admitRefugees(s); s.treasury -= count * 20; s.log.push(`接纳 ${count} 名灾民；他们初始并非罪犯，但低满意度会提高今后的犯罪概率`);
      }, { speaker: '灾民代表', mood: 'grateful', topic: 'refugees_sheltered' }),
      option('遣返并没收越境物资（国库 +60；本国满意 -1）', '保住人口承载力并增加国库 60', '冷酷处置使民心下降', { morality: -2, rationality: 2 }, s => {
        s.treasury += 60; shiftSatisfaction(s, -1); s.flags.refugeeArrivalYear = -1; s.flags.refugeeIntegrationResolved = true; s.log.push('关门遣返灾民，国内储备得以保全');
      }, { speaker: '守关官', mood: 'guarded', topic: 'refugees_refused' }),
    ],
  },
  {
    id: 'canal_dispute', title: '争夺水渠', desc: '上游庄园截断水渠，下游村庄与其冲突。', weight: 6,
    condition: s => s.year >= 5 && s.stats.byClass.farmer >= 10,
    options: [
      option('按田亩分水（农民粮食 +4、满意 +1；国库 -100）', '改善灌溉和农民生活', '勘测与维护支出 100', { morality: 1, rationality: 3 }, s => {
        s.treasury -= 100; citizens(s, 'farmer').forEach(p => { p.grain += 4; p.satisfaction += 1; });
      }, { speaker: '水利官', mood: 'focused', topic: 'canal_measured' }),
      option('出售水权（国库 +180；农民粮食 -3、满意 -2）', '国库增加 180', '下游农民失去水利收益', { morality: -3, rationality: 1 }, s => {
        s.treasury += 180; citizens(s, 'farmer').forEach(p => { p.grain -= 3; p.satisfaction -= 2; });
      }, { speaker: '下游乡老', mood: 'angry', topic: 'canal_sold' }),
    ],
  },
  {
    id: 'celestial_omen', title: '天象示警', desc: '彗星划过，民间传言灾祸将至。', weight: 4,
    condition: s => s.year >= 6,
    options: [
      option('释疑并整修粮仓（每人粮食 +2；国库 -100、官员满意 -1）', '改善储粮并缓解恐慌', '财政支出且触怒守旧官员', { morality: 1, rationality: 3 }, s => {
        s.treasury -= 100; citizens(s).forEach(p => { p.grain += 2; }); shiftSatisfaction(s, -1, p => p.klass === 'official');
      }, { speaker: '司天官', mood: 'focused', topic: 'omen_explained' }),
      option('举行大祭（满意 +2；国库 -200、每人粮食 -1）', '迅速安定民心', '祭典耗费财政和粮食', { morality: 1, rationality: -3 }, s => {
        s.treasury -= 200; citizens(s).forEach(p => { p.satisfaction += 2; p.grain -= 1; });
      }, { speaker: '祭官', mood: 'solemn', topic: 'omen_sacrifice' }),
    ],
  },
  {
    id: 'corruption_aftershock', title: '贪腐案余波', desc: '两年前的贪腐案留下了行政缺口与互不信任。', weight: 14,
    condition: s => Number.isFinite(s.flags.corruptionCaseYear) && s.year >= s.flags.corruptionCaseYear + 2 && !s.flags.corruptionAftershockResolved,
    options: [
      option('重建审计队伍（补充 1 名公务员、百姓满意 +1；国库 -180）', '修复行政能力和公众信任', '从其他阶级选官并支出 180', { morality: 2, rationality: 3 }, s => {
        s.treasury -= 180; const recruit = citizens(s).filter(p => p.klass !== 'official').sort((a, b) => b.intelligence - a.intelligence)[0]; if (recruit) { recruit.klass = 'official'; recruit.role = null; recruit.satisfaction += 1; } shiftSatisfaction(s, 1, p => p.klass !== 'official'); s.flags.corruptionAftershockResolved = true;
      }, { speaker: '新任审计官', mood: 'focused', topic: 'corruption_reform' }),
      option('缩减官署（国库 +80、农工满意 +1；税务配额 -1）', '节省俸禄并给予地方更多空间', '削弱征税行政能力', { morality: 1, rationality: -2 }, s => {
        s.treasury += 80; s.policy.officials.tax = Math.max(0, s.policy.officials.tax - 1); shiftSatisfaction(s, 1, p => p.klass === 'farmer' || p.klass === 'worker'); s.flags.corruptionAftershockResolved = true;
      }, { speaker: '乡老', mood: 'relieved', topic: 'corruption_decentralized' }),
    ],
  },
  {
    id: 'merchant_backlash', title: '商路萧条', desc: '惩办囤货商后，商队绕道，农产品和工坊货物难以外销。', weight: 14,
    condition: s => Number.isFinite(s.flags.merchantPunishedYear) && s.year >= s.flags.merchantPunishedYear + 2 && !s.flags.merchantBacklashResolved,
    options: [
      option('扶持合作商社（农工产品 +2、满意 +1；国库 -120）', '恢复基层流通', '财政补贴并继续压缩传统商人利润', { morality: 2, rationality: 2 }, s => {
        s.treasury -= 120; citizens(s).filter(p => p.klass === 'farmer' || p.klass === 'worker').forEach(p => { p.product += 2; p.satisfaction += 1; }); shiftSatisfaction(s, -1, p => p.klass === 'merchant'); s.flags.merchantBacklashResolved = true;
      }, { speaker: '工坊代表', mood: 'hopeful', topic: 'merchant_cooperative' }),
      option('重发行商牌照（新增 1 名商人、国库 +80；农民满意 -1）', '恢复商人阶层并收取牌照费', '一名农民转为商人，乡间不满', { morality: -1, rationality: 3 }, s => {
        const candidate = citizens(s, 'farmer').sort((a, b) => b.grain - a.grain)[0]; if (candidate) { candidate.klass = 'merchant'; candidate.satisfaction += 1; } s.treasury += 80; shiftSatisfaction(s, -1, p => p.klass === 'farmer'); s.flags.merchantBacklashResolved = true;
      }, { speaker: '商会代表', mood: 'pleased', topic: 'merchant_relicensed' }),
    ],
  },
  {
    id: 'refugee_integration', title: '新民安置', desc: '被接纳的灾民已居住两年，贫困与隔阂仍未消失。', weight: 14,
    condition: s => s.flags.refugeeArrivalYear > 0 && s.year >= s.flags.refugeeArrivalYear + 2 && !s.flags.refugeeIntegrationResolved && s.people.some(p => p.refugeeWave === s.flags.refugeeArrivalYear),
    options: [
      option('授田融入（新民粮食 +8、满意 +6；国库每人 -30、本地满意 -1）', '降低新民的贫困和犯罪风险', '高额安置支出并引起本地资源焦虑', { morality: 3, rationality: 2 }, s => {
        const newcomers = s.people.filter(p => p.refugeeWave === s.flags.refugeeArrivalYear); s.treasury -= newcomers.length * 30; newcomers.forEach(p => { p.grain += 8; p.satisfaction += 6; }); shiftSatisfaction(s, -1, p => !p.refugeeWave); s.flags.refugeeIntegrationResolved = true;
      }, { speaker: '新民代表', mood: 'hopeful', topic: 'refugee_integrated' }),
      option('分批遣散（节省每人 20、当地满意 +1；移除半数新民）', '缓解财政和本地资源压力', '失去已经接纳的人口', { morality: -2, rationality: 1 }, s => {
        const newcomers = s.people.filter(p => p.refugeeWave === s.flags.refugeeArrivalYear); const leaving = newcomers.filter((_, i) => i % 2 === 0); for (const p of leaving) { const index = s.people.indexOf(p); if (index >= 0) s.people.splice(index, 1); } s.treasury += leaving.length * 20; shiftSatisfaction(s, 1, p => !p.refugeeWave); s.flags.refugeeIntegrationResolved = true;
      }, { speaker: '守城官', mood: 'guarded', topic: 'refugee_dispersed' }),
    ],
  },
  {
    id: 'reformed_prisoner_review', title: '从良者复审', desc: '获感化的前罪犯完成两年生计计划，朝廷需决定是否继续扶助。', weight: 12,
    condition: s => s.flags.reformedPrisoner && !s.flags.reformedPrisoner.resolved && s.year >= s.flags.reformedPrisoner.year + 2 && s.people.some(p => p.id === s.flags.reformedPrisoner.id),
    options: [
      option('继续扶助（从良者粮食 +8、满意 +4；国库 -60、公众满意 -0.5）', '巩固感化成果', '持续支出且公众担忧偏袒', { morality: 3, rationality: 2 }, s => {
        s.treasury -= 60; const person = s.people.find(p => p.id === s.flags.reformedPrisoner.id); if (person) { person.grain += 8; person.satisfaction += 4; } shiftSatisfaction(s, -0.5, p => p.id !== person?.id); s.flags.reformedPrisoner.resolved = true;
      }, { speaker: '教化官', mood: 'hopeful', topic: 'reform_continued' }),
      option('停止计划并流放（国库 +30、公众满意 +0.5；移除该人口）', '停止开支并回应强硬诉求', '国家失去已从良的人口', { morality: -3, rationality: -1 }, s => {
        const index = s.people.findIndex(p => p.id === s.flags.reformedPrisoner.id); if (index >= 0) s.people.splice(index, 1); s.treasury += 30; shiftSatisfaction(s, 0.5); s.flags.reformedPrisoner.resolved = true;
      }, { speaker: '刑狱官', mood: 'stern', topic: 'reform_exile' }),
    ],
  },
];

/** 选取一个本年度事件，返回 null 表示无事件。 */
export function rollEvent(state) {
  const candidates = EVENTS.filter(e => {
    try { return e.condition(state); } catch { return false; }
  });
  if (!candidates.length || !state.rng.chance(0.55)) return null;
  const recent = Array.isArray(state.recentEventIds) ? state.recentEventIds.slice(-2) : [];
  const freshCandidates = candidates.filter(e => !recent.includes(e.id));
  const pool = freshCandidates.length ? freshCandidates : candidates;
  const total = pool.reduce((sum, event) => sum + event.weight, 0);
  let roll = state.rng.uniform(0, total);
  let selected = pool[pool.length - 1];
  for (const event of pool) {
    roll -= event.weight;
    if (roll <= 0) { selected = event; break; }
  }
  state.recentEventIds = [...recent, selected.id].slice(-2);
  return selected;
}
