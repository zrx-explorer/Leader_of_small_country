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
  productNeedBase: 2,       // 产品基本需求
  productReserveNeed: 4,    // 产品储备
  // 满意度阈值
  productDemandLow: 12,
  productDemandHigh: 15,
  rebelThreshold: -10,
  inflatedThreshold: 15,
  // 生产
  farmerProdMean: 130,      // 农民人均年产粮（130/10人=13/人）
  farmerProdJitter: 30,
  workerProdMean: 20,
  workerProdJitter: 1,
  productionCost: 2,
  // 税率（玩家可调）
  taxFarmer: 0.05,
  taxWorker: 0.075,
  taxMerchant: 0.10,
  // 政府
  govWage: 60,
  militaryRatio: 0.20,
  // 教育
  teacherPerStudents: 10,
  intelligenceGainPerYear: 0.25,
  intelligenceCap: 5,
  satisfactionFromEdu: 0.5,
  // 社会动态
  birthAgeMin: 18,
  birthAgeMax: 30,
  deathStartAge: 50,
  deathHardCap: 90,
  // 性能
  bucketModeThreshold: 200, // 人口超过 200 启用桶模拟
});

export const INITIAL_POPULATION = {
  farmer: 10,
  worker: 5,
  merchant: 2,
  official: 8,
};

// 章节
export const CHAPTERS = [
  { id: 1, name: '立国', goalYears: 5,   minSatisfaction: 5,  init: { farmer:10, worker:5, merchant:2, official:5 } },
  { id: 2, name: '兴邦', goalYears: 20,  minTreasury: 5000,   minPopulation: 200, init: { farmer:30, worker:15, merchant:5, official:10 } },
  { id: 3, name: '治世', goalYears: 50,  minIntelligence: 70, init: { farmer:60, worker:40, merchant:10, official:20 } },
  { id: 4, name: '盛世', goalYears: 100, allClassMinSat: 10,  init: { farmer:150, worker:120, merchant:30, official:40 } },
];
