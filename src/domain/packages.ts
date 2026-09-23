// 套餐领域规则（纯函数，不依赖 React / localStorage）
// - 新单：同客户同耳存在在途套餐（active 或待续费）时拒绝
// - 随访：扣减 1 次并记录效果；余次为 0 / 保修过期 / 已待续费 时不可排期
// - 续费：仅待续费可续，必须填写原因，新建版本，旧版本与随访保留可查

import type {
  AidPackage,
  BlockedReason,
  Ear,
  EarDevice,
  FollowUp,
  FollowUpInput,
  OrderFieldErrors,
  OrderInput,
  PackageVersion,
  RenewalFieldErrors,
  RenewalInput,
} from "../types";

export const EAR_LABEL: Record<Ear, string> = { L: "左耳", R: "右耳" };

/** 页面顶部展示的业务规则，冲突提示中也引用同一份文案 */
export const ORDER_RULES = [
  "每单登记客户、双耳机型、首配日、套餐次数与剩余次数",
  "同一客户同一耳存在在途套餐（含待续费）时，新单拒绝且保留输入",
  "每次随访扣减 1 次并记录效果；余次为零或保修过期不得排期，只能转待续费",
  "续费必须填写原因并新建版本，旧次数与随访记录仍可查询",
];

// ---------- 日期 / ID 工具 ----------

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 在 YYYY-MM-DD 上加月份，返回 YYYY-MM-DD（保修默认首配后 24 个月，月末钳制） */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = (m || 1) - 1;
  // 目标月不存在对应日（如 2/29 → 次年 2 月）时钳到该月最后一天
  const targetYear = y + Math.floor((month + months) / 12);
  const targetMonth = ((month + months) % 12 + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d || 1, lastDay);
  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- 取数 ----------

export function currentVersion(pkg: AidPackage): PackageVersion {
  return pkg.versions[pkg.versions.length - 1];
}

export function versionFollowUps(pkg: AidPackage, version: number): FollowUp[] {
  return pkg.followUps.filter((f) => f.version === version);
}

export function isWarrantyExpired(pkg: AidPackage, today = todayISO()): boolean {
  return currentVersion(pkg).warrantyUntil < today;
}

export interface ScheduleState {
  blocked: boolean;
  reason?: BlockedReason;
  message: string;
}

/** 排期资格：active 且余次 > 0 且保修未过期 */
export function getScheduleState(pkg: AidPackage, today = todayISO()): ScheduleState {
  if (pkg.status === "pending_renewal") {
    return { blocked: true, reason: "pending", message: "已处于待续费状态，不能排期，请先续费" };
  }
  const cv = currentVersion(pkg);
  if (cv.remaining <= 0) {
    return { blocked: true, reason: "remaining", message: "剩余次数为零，不能排期，只能转待续费" };
  }
  if (cv.warrantyUntil < today) {
    return { blocked: true, reason: "warranty", message: `保修已于 ${cv.warrantyUntil} 过期，不能排期，只能转待续费` };
  }
  return { blocked: false, message: "可以排期随访" };
}

// ---------- 新单 ----------

export interface OrderConflict {
  ear: Ear;
  existingId: string;
  status: AidPackage["status"];
  remaining: number;
}

export interface ValidateOrderResult {
  valid: boolean;
  errors: OrderFieldErrors;
}

export function validateOrder(input: OrderInput, today = todayISO()): ValidateOrderResult {
  const errors: OrderFieldErrors = {};
  if (!input.customer.trim()) errors.customer = "请填写客户姓名";

  const chosen = input.devices.filter((d) => d.model.trim() !== "");
  if (chosen.length === 0) {
    errors.ears = "双耳至少登记一耳机型";
  } else {
    const model: Partial<Record<Ear, string>> = {};
    for (const d of chosen) {
      if (!d.model.trim()) model[d.ear] = "请填写机型";
    }
    if (Object.keys(model).length > 0) errors.model = model;
  }

  if (!input.firstFitDate) errors.firstFitDate = "请选择首配日";
  if (!Number.isInteger(input.totalCount) || input.totalCount < 1) {
    errors.totalCount = "套餐次数须为不小于 1 的整数";
  }
  if (!input.warrantyUntil) {
    errors.warrantyUntil = "请选择保修截止日";
  } else if (input.firstFitDate && input.warrantyUntil < input.firstFitDate) {
    errors.warrantyUntil = "保修截止日不能早于首配日";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function sameCustomer(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), "zh-Hans-CN") === 0;
}

/** 同客户同耳在途套餐（active / 待续费均视为在途） */
export function findOrderConflicts(
  packages: AidPackage[],
  input: OrderInput
): OrderConflict[] {
  const chosen = new Set(input.devices.filter((d) => d.model.trim()).map((d) => d.ear));
  const conflicts: OrderConflict[] = [];
  for (const pkg of packages) {
    if (!sameCustomer(pkg.customer, input.customer)) continue;
    for (const device of pkg.devices) {
      if (!chosen.has(device.ear)) continue;
      conflicts.push({
        ear: device.ear,
        existingId: pkg.id,
        status: pkg.status,
        remaining: currentVersion(pkg).remaining,
      });
    }
  }
  return conflicts;
}

export interface CreateOrderResult {
  ok: boolean;
  errors?: OrderFieldErrors;
  conflicts?: OrderConflict[];
  pkg?: AidPackage;
}

export function createPackage(
  packages: AidPackage[],
  input: OrderInput,
  nowIso = new Date().toISOString()
): CreateOrderResult {
  const validation = validateOrder(input);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const conflicts = findOrderConflicts(packages, input);
  if (conflicts.length > 0) return { ok: false, conflicts };

  const devices: EarDevice[] = input.devices
    .filter((d) => d.model.trim() !== "")
    .map((d) => ({ ear: d.ear, model: d.model.trim() }));

  const pkg: AidPackage = {
    id: makeId("pkg"),
    customer: input.customer.trim(),
    devices,
    firstFitDate: input.firstFitDate,
    status: "active",
    versions: [
      {
        version: 1,
        totalCount: input.totalCount,
        remaining: input.totalCount,
        warrantyUntil: input.warrantyUntil,
        createdAt: nowIso,
      },
    ],
    followUps: [],
    createdAt: nowIso,
  };
  return { ok: true, pkg };
}

// ---------- 随访扣次 ----------

export interface FollowUpResult {
  ok: boolean;
  message: string;
  pkg?: AidPackage;
}

export function registerFollowUp(
  packages: AidPackage[],
  packageId: string,
  input: FollowUpInput,
  nowIso = new Date().toISOString()
): FollowUpResult {
  const index = packages.findIndex((p) => p.id === packageId);
  if (index < 0) return { ok: false, message: "套餐不存在" };

  const pkg = packages[index];
  if (!input.date) return { ok: false, message: "请选择随访日期" };
  if (!input.effect.trim()) return { ok: false, message: "请记录随访效果" };

  const state = getScheduleState(pkg);
  if (state.blocked) return { ok: false, message: state.message };

  const versionNo = currentVersion(pkg).version;
  const followUp: FollowUp = {
    id: makeId("fu"),
    packageId,
    version: versionNo,
    date: input.date,
    effect: input.effect.trim(),
    createdAt: nowIso,
  };

  const next: AidPackage = {
    ...pkg,
    versions: pkg.versions.map((v, i) =>
      i === pkg.versions.length - 1 ? { ...v, remaining: v.remaining - 1 } : v
    ),
    followUps: [...pkg.followUps, followUp],
  };
  const copy = packages.slice();
  copy[index] = next;
  return { ok: true, message: "随访已登记，剩余次数扣减 1 次", pkg: next };
}

// ---------- 转待续费 / 续费 ----------

export interface StatusResult {
  ok: boolean;
  message: string;
  pkg?: AidPackage;
}

/** 余次为零或保修过期（或已待续费）时才允许转入待续费；仍可排期则拒绝 */
export function markPendingRenewal(packages: AidPackage[], packageId: string): StatusResult {
  const index = packages.findIndex((p) => p.id === packageId);
  if (index < 0) return { ok: false, message: "套餐不存在" };
  const pkg = packages[index];
  if (pkg.status === "pending_renewal") {
    return { ok: false, message: "该套餐已是待续费状态" };
  }
  const state = getScheduleState(pkg);
  if (!state.blocked) {
    return { ok: false, message: "套餐仍有余次且保修有效，不能转待续费" };
  }
  const next = { ...pkg, status: "pending_renewal" as const };
  const copy = packages.slice();
  copy[index] = next;
  return { ok: true, message: "已转为待续费，续费后可恢复排期", pkg: next };
}

export function validateRenewal(input: RenewalInput): RenewalFieldErrors {
  const errors: RenewalFieldErrors = {};
  if (!input.reason.trim()) errors.reason = "续费必须填写原因";
  if (!Number.isInteger(input.totalCount) || input.totalCount < 1) {
    errors.totalCount = "套餐次数须为不小于 1 的整数";
  }
  if (!input.warrantyUntil) {
    errors.warrantyUntil = "请选择保修截止日";
  } else if (input.warrantyUntil < todayISO()) {
    errors.warrantyUntil = "新保修截止日不能早于今天";
  }
  return errors;
}

export interface RenewalResult {
  ok: boolean;
  message: string;
  errors?: RenewalFieldErrors;
  pkg?: AidPackage;
}

export function renewPackage(
  packages: AidPackage[],
  packageId: string,
  input: RenewalInput,
  nowIso = new Date().toISOString()
): RenewalResult {
  const index = packages.findIndex((p) => p.id === packageId);
  if (index < 0) return { ok: false, message: "套餐不存在" };
  const pkg = packages[index];
  if (pkg.status !== "pending_renewal") {
    return { ok: false, message: "只有待续费套餐可以续费" };
  }
  const errors = validateRenewal(input);
  if (Object.keys(errors).length > 0) return { ok: false, message: "续费资料不完整", errors };

  const last = currentVersion(pkg);
  const newVersion: PackageVersion = {
    version: last.version + 1,
    totalCount: input.totalCount,
    remaining: input.totalCount,
    warrantyUntil: input.warrantyUntil,
    createdAt: nowIso,
    renewReason: input.reason.trim(),
  };
  const next: AidPackage = {
    ...pkg,
    status: "active",
    versions: [...pkg.versions, newVersion],
    // followUps 原样保留：旧版本次数与随访仍可查
  };
  const copy = packages.slice();
  copy[index] = next;
  return { ok: true, message: `已续费生成 v${newVersion.version}，恢复排期`, pkg: next };
}
