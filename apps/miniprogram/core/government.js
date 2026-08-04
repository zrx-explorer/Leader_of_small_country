const { CLASS, OFFICIAL_ROLE } = require('./config.js');

function assignRoles(people, policy, year) {
  year = year == null ? Infinity : year;
  people.filter(p => p.klass === CLASS.OFFICIAL).forEach(p => { p.role = null; });
  const officials = people.filter(p => p.klass === CLASS.OFFICIAL && !p.isCriminal);
  const target = policy.officials;
  let i = 0;
  for (const role in target) {
    const unlocked = role !== OFFICIAL_ROLE.SECURITY || year >= 5;
    const welfareUnlocked = role !== OFFICIAL_ROLE.WELFARE || year >= 11;
    const militaryUnlocked = role !== OFFICIAL_ROLE.MILITARY || year >= 21;
    const count = unlocked && welfareUnlocked && militaryUnlocked ? target[role] : 0;
    for (let n = 0; n < count && i < officials.length; n++, i++) {
      officials[i].role = role;
    }
  }
  for (; i < officials.length; i++) officials[i].role = OFFICIAL_ROLE.GOVERNOR;
}

function collectTax(people, policy, log) {
  let total = 0;
  const taxOfficerCount = people.filter(p => p.role === OFFICIAL_ROLE.TAX).length;
  const taxable = people.filter(p => !p.isCriminal && p.klass !== CLASS.OFFICIAL);
  const covered = taxable.slice(0, taxOfficerCount * 100);
  for (const p of covered) {
    let tax = 0;
    if (p.klass === CLASS.FARMER) tax = Math.max(0, p.grain * policy.tax.farmer);
    else if (p.klass === CLASS.WORKER) tax = Math.max(0, p.product * 3 * policy.tax.worker);
    else if (p.klass === CLASS.MERCHANT) tax = Math.max(0, p.grain * 0.1 * policy.tax.merchant);
    p.grain -= tax; total += tax;
  }
  if (log) {
    const uncovered = taxable.length - covered.length;
    log.push(`💰 税收 +${total.toFixed(1)}（${taxOfficerCount} 名税务官管辖 ${covered.length} 人${uncovered > 0 ? `，${uncovered} 人未纳入征税` : ''}）`);
  }
  return total;
}

function payWages(people, treasury, cfg, log, wagePerOfficial) {
  const officials = people.filter(p => p.klass === CLASS.OFFICIAL && !p.isCriminal);
  const wage=Math.max(0,Number(wagePerOfficial == null ? cfg.govWage : wagePerOfficial)||0);
  let cost = 0, paid=0;
  for (const o of officials) {
    if (treasury - cost >= wage) {
      o.grain += wage; cost += wage; paid++;
      if(wage<cfg.grainNeed)o.satisfaction-=.5;else if(wage>=cfg.grainReserveNeed)o.satisfaction+=.5;
    } else { o.satisfaction -= 2; }
  }
  if(log)log.push(`📜 公务员工资 -${cost.toFixed(1)}（${paid} 人 × 每人 ${wage.toFixed(1)}${paid<officials.length?`，欠薪 ${officials.length-paid} 人`:''}）`);
  return cost;
}

function educate(people, cfg, log) {
  const teachers = people.filter(p => !p.isCriminal && p.role === OFFICIAL_ROLE.TEACHER);
  if (!teachers.length) return;
  const students = people
    .filter(p => !p.isCriminal && p.klass !== CLASS.OFFICIAL && p.intelligence < 100)
    .slice(0, teachers.length * cfg.teacherPerStudents);
  for (const s of students) {
    s.intelligence = Math.min(100, s.intelligence + cfg.intelligenceGainPerYear);
    s.satisfaction += cfg.satisfactionFromEdu;
  }
  if (students.length && log) log.push(`📚 ${teachers.length} 名教师授课 ${students.length} 人`);
}

function military(treasury, policy, log) {
  const cost = Math.max(0, treasury) * policy.militaryRatio;
  if (log && cost > 0) log.push(`⚔ 军事支出 -${cost.toFixed(1)}`);
  return cost;
}

function securityCount(people) {
  return people.filter(p => !p.isCriminal && p.role === OFFICIAL_ROLE.SECURITY).length;
}

module.exports = { assignRoles, collectTax, payWages, educate, military, securityCount };
