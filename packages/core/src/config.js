/**
 * 全局配置与常量
 * 所有可调参数集中在此，便于策划数值平衡
 */

export const CLASS = Object.freeze({
  FARMER: 'farmer',
  WORKER: 'worker',
  MERCHANT: 'merchant',
  OFFICIAL: 'official',
});

export const OFFICIAL_ROLE = Object.freeze({
  TAX: 'tax',
  SECURITY: 'security',
  WELFARE: 'welfare',
  MILITARY: 'military',
  TEACHER: 'teacher',
  GOVERNOR: 'governor',
});

export const DEFAULT_CONFIG = Object.freeze({
  // 基础数值
  grainNeed: 10,            // 每人每年粮食基本需求
  grainReserveNeed: 20,     // 储备需求
  productNeedBase: 1,       // 产品基本需求
  productReserveNeed: 3,    // 产品储备
  // 满意度阈值
  productDemandLow: 12,
  productDemandHigh: 15,
  rebelThreshold: -10,
  inflatedThreshold: 24,
  lowCrimeChance: 0.12,
  highCrimeChance: 0.03,
  crimeStartYear: 6,
  // 生产
  farmerProdMean: 180,      // 原有产量基线；实际单人年产不低于 13 人的年口粮
  farmerProdJitter: 18,
  workerProdMean: 30,       // 原有产量基线；实际单人年产不低于 13 人的年产品需求
  workerProdJitter: 1.5,
  productionCost: 1.5,
  // 税率（玩家可调）
  taxFarmer: 0.05,
  taxWorker: 0.08,
  taxMerchant: 0.10,
  // 政府
  govWage: 10,
  militaryRatio: 0.05,
  securityUnlockYear: 5,
  welfareUnlockYear: 11,
  militaryOfficialUnlockYear: 21,
  // 教育
  teacherPerStudents: 10,
  intelligenceGainPerYear: 0.25,
  intelligenceCap: 5,
  satisfactionFromEdu: 0.5,
  // 社会动态
  birthAgeMin: 18,
  birthAgeMax: 40,
  birthRateFarmer: 0.22,
  birthRateWorker: 0.18,
  birthRateMerchant: 0.14,
  populationSoftCap: 800,
  populationHardCap: 2000,
  accidentDeathRate: 0.01,
  starvationDeathRate: 0.08,
  deathStartAge: 50,
  deathHardCap: 95,
  // 性能
  bucketModeThreshold: 300, // UI 超过该值只渲染部分个体
});

export const INITIAL_POPULATION = {
  farmer: 10,
  worker: 5,
  merchant: 2,
  official: 8,
};

// 章节
export const CHAPTERS = [
  { id: 1, name: '立国', goalYears: 30, minSatisfaction: -15, minPopulation: 20, init: { farmer:18, worker:6, merchant:2, official:4 } },
  { id: 2, name: '兴邦', goalYears: 50, minTreasury: 5000,   minPopulation: 200, init: { farmer:30, worker:15, merchant:5, official:10 } },
  { id: 3, name: '治世', goalYears: 50,  minIntelligence: 70, init: { farmer:60, worker:40, merchant:10, official:20 } },
  { id: 4, name: '盛世', goalYears: 100, allClassMinSat: 10,  init: { farmer:150, worker:120, merchant:30, official:40 } },
];
