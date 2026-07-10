/**
 * 政府模块：税收、工资、教育、军事
 */
import { CLASS, OFFICIAL_ROLE } from './config.js';

/** 分配公务员岗位（按政策） */
export function assignRoles(people, policy, year = Infinity) {
  people.filter(p => p.klass === CLASS.OFFICIAL).forEach(p => { p.role = null; });
  const officials = people.filter(p => p.klass === CLASS.OFFICIAL && !p.isCriminal);
  // policy.officials = { tax, security, welfare, military, teacher }
  const target = policy.officials;
  let i = 0;
  for (const role of Object.keys(target)) {
    const unlocked = role !== OFFICIAL_ROLE.SECURITY || year >= 5;
    const welfareUnlocked = role !== OFFICIAL_ROLE.WELFARE || year >= 11;
    const militaryUnlocked = role !== OFFICIAL_ROLE.MILITARY || year >= 21;
    const count = unlocked && welfareUnlocked && militaryUnlocked ? target[role] : 0;
    for (let n = 0; n < count && i < officials.length; n++, i++) {
      officials[i].role = role;
    }
  }
  // 剩余的为总督候补
  for (; i < officials.length; i++) officials[i].role = OFFICIAL_ROLE.GOVERNOR;
}

/** 征税：返回征收到的总额 */
export function collectTax(people, policy, log) {
  let total = 0;
  const taxOfficerCount = people.filter(p => p.role === OFFICIAL_ROLE.TAX).length;
  const taxable = people.filter(p => !p.isCriminal && p.klass !== CLASS.OFFICIAL);
  const covered = taxable.slice(0, taxOfficerCount * 100);
  for (const p of covered) {
    let tax = 0;
    if (p.klass === CLASS.FARMER) {
      tax = Math.max(0, p.grain * policy.tax.farmer);
    } else if (p.klass === CLASS.WORKER) {
      tax = Math.max(0, p.product * 3 * policy.tax.worker); // 估值
    } else if (p.klass === CLASS.MERCHANT) {
      tax = Math.max(0, p.grain * 0.1 * policy.tax.merchant);
    }
    p.grain -= tax;
    total += tax;
  }
  if (log) {
    const uncovered = taxable.length - covered.length;
    log.push(`💰 税收 +${total.toFixed(1)}（${taxOfficerCount} 名税务官管辖 ${covered.length} 人${uncovered > 0 ? `，${uncovered} 人未纳入征税` : ''}）`);
  }
  return total;
}

/** 发工资 */
export function payWages(people, treasury, cfg, log) {
  const officials = people.filter(p => p.klass === CLASS.OFFICIAL && !p.isCriminal);
  let cost = 0;
  for (const o of officials) {
    if (treasury - cost >= cfg.govWage) {
      o.grain += cfg.govWage;
      cost += cfg.govWage;
    } else {
      o.satisfaction -= 1; // 欠薪
    }
  }
  if (log) log.push(`📜 公务员工资支出 -${cost.toFixed(1)}`);
  return cost;
}

/** 教育：教师为非公务员提升智力 */
export function educate(people, cfg, log) {
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

/** 军事开支 */
export function military(treasury, policy, log) {
  const cost = treasury * policy.militaryRatio;
  if (log && cost > 0) log.push(`⚔ 军事支出 -${cost.toFixed(1)}`);
  return cost;
}

/** 治安官数量 */
export function securityCount(people) {
  return people.filter(p => !p.isCriminal && p.role === OFFICIAL_ROLE.SECURITY).length;
}
