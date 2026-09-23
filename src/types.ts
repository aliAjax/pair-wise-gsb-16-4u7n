// 助听器套餐与随访余次台：核心数据类型

export type Ear = "L" | "R";

/** 在途：正常履约；待续费：余次耗尽或保修过期后转入，等待续费 */
export type PackageStatus = "active" | "pending_renewal";

/** 排期被阻断的原因 */
export type BlockedReason = "remaining" | "warranty" | "pending";

export interface EarDevice {
  ear: Ear;
  /** 该耳配验的助听器机型（双耳可不同机型） */
  model: string;
}

export interface PackageVersion {
  /** 从 1 开始，续费一次新增一个版本 */
  version: number;
  /** 本版本套餐次数 */
  totalCount: number;
  /** 本版本剩余次数（每次随访扣减 1） */
  remaining: number;
  /** 本版本保修截止日，YYYY-MM-DD */
  warrantyUntil: string;
  createdAt: string;
  /** v2 起必填：续费原因 */
  renewReason?: string;
}

export interface FollowUp {
  id: string;
  packageId: string;
  /** 扣减发生时所在的版本，旧版本随访永久挂在旧版本下可查 */
  version: number;
  /** 随访日期 YYYY-MM-DD */
  date: string;
  /** 随访效果记录 */
  effect: string;
  createdAt: string;
}

export interface AidPackage {
  id: string;
  customer: string;
  /** 双耳登记：1 或 2 条，按耳别区分机型 */
  devices: EarDevice[];
  /** 首配日 YYYY-MM-DD */
  firstFitDate: string;
  status: PackageStatus;
  versions: PackageVersion[];
  followUps: FollowUp[];
  createdAt: string;
}

/** 新单登记输入 */
export interface OrderInput {
  customer: string;
  devices: EarDevice[];
  firstFitDate: string;
  totalCount: number;
  warrantyUntil: string;
}

export interface FollowUpInput {
  date: string;
  effect: string;
}

export interface RenewalInput {
  reason: string;
  totalCount: number;
  warrantyUntil: string;
}

export interface OrderFieldErrors {
  customer?: string;
  ears?: string;
  model?: Partial<Record<Ear, string>>;
  firstFitDate?: string;
  totalCount?: string;
  warrantyUntil?: string;
}

export interface RenewalFieldErrors {
  reason?: string;
  totalCount?: string;
  warrantyUntil?: string;
}
