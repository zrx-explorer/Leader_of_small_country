const { CLASS, OFFICIAL_ROLE } = require('./config.js');

function assignRoles(people, policy) {
  const officials = people.filter(p => p.klass === CLASS.OFFICIAL);
  const target = policy.officials;
  let i = 0;
  for (const role in target) {
    for (let n = 0; n < target[role] && i < officials.length; n++, i++) {
      officials[i].role = role;
    }
  }
  for (; i < officials.length; i++) officials[i].role = OFFICIAL_ROLE.GOVERNOR;
}

function collectTax(people, policy, log) {
  let total = 0;
  for (const p of people) {
    if (p.isCriminal) continue;
    let tax = 0;
    if (p.klass === CLASS.FARMER) tax = Math.max(0, p.grain * policy.tax.farmer);
    else if (p.klass === CLASS.WORKER) tax = Math.max(0, p.product * 3 * policy.tax.worker);
    else if (p.klass === CLASS.MERCHANT) tax = Math.max(0, p.grain * 0.1 * policy.tax.merchant);
    p.grain -= tax; total += tax;
  }
  if (log) log.push(`💰 税收 +${total.toFixed(1)}`);
  return total;
}

function payWages(people, treasury, cfg, log) {
  const officials = people.filter(p => p.klass === CLASS.OFFICIAL);
  let cost = 0;
  for (const o of officials) {
    if (treasury - cost >= cfg.govWage) {
      o.grain += cfg.govWage; cost += cfg.govWage;
    } else { o.satisfaction -= 1; }
  }
  if (log) log.push(`📜 公务员工资支出 -${cost.toFixed(1)}`);
  return cost;
}

function educate(people, cfg, log) {
  const teachers = people.filter(p => p.role === OFFICIAL_ROLE.TEACHER);
  if (!teachers.length) return;
  const students = people
    .filter(p => p.klass !== CLASS.OFFICIAL && p.intelligence < 100)
    .slice(0, teachers.length * cfg.teacherPerStudents);
  for (const s of students) {
    s.intelligence = Math.min(100, s.intelligence + cfg.intelligenceGainPerYear);
    s.satisfaction += cfg.satisfactionFromEdu;
  }
  if (students.length && log) log.push(`📚 ${teachers.length} 名教师授课 ${students.length} 人`);
}

function military(treasury, policy, log) {
  const cost = treasury * policy.militaryRatio;
  if (log && cost > 0) log.push(`⚔ 军事支出 -${cost.toFixed(1)}`);
  return cost;
}

function securityCount(people) {
  return people.filter(p => p.role === OFFICIAL_ROLE.SECURITY).length;
}

module.exports = { assignRoles, collectTax, payWages, educate, military, securityCount };
