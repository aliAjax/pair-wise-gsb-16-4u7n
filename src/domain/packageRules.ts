import type {
  BoardMetrics,
  ConflictInfo,
  CreateOrderInput,
  Ear,
  EarPackage,
  EarStatus,
  FollowUp,
  FollowUpInput,
  Order,
  PackageVersion,
  RenewInput,
  RuleResult,
} from "../types";

// ---------------------------------------------------------------------------
// 基础资料与只读派生
// ---------------------------------------------------------------------------

export const EAR_LABEL: Record<Ear, string> = { L: "左耳", R: "右耳" };

export function todayISO(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function currentMonthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function currentVersion(ear: EarPackage): PackageVersion {
  return ear.版本[ear.版本.length - 1];
}

export function isWarrantyExpired(保修至: string, onDate: string): boolean {
  return 保修至 < onDate;
}

/** 余次为零或保修过期 => 待续费；否则在途 */
export function earStatus(ear: EarPackage, onDate: string): EarStatus {
  const v = currentVersion(ear);
  if (v.剩余次数 <= 0) return "renewal";
  if (isWarrantyExpired(v.保修至, onDate)) return "renewal";
  return "active";
}

export function statusReason(ear: EarPackage, onDate: string): string {
  const v = currentVersion(ear);
  if (v.剩余次数 <= 0) return "剩余次数为零，需续费";
  if (isWarrantyExpired(v.保修至, onDate))
    return `保修已于 ${v.保修至} 过期，需续费`;
  return "在途";
}

export function findEar(order: Order, ear: Ear): EarPackage | undefined {
  return order.套餐.find((e) => e.耳别 === ear);
}

// ---------------------------------------------------------------------------
// 规则 R1：同一客户同耳存在在途套餐时，新单拒绝（冲突保留客户、耳别、余次）
// ---------------------------------------------------------------------------

export const RULE_CONFLICT = "同一客户同耳存在在途套餐，新单拒绝登记";

export function findConflicts(
  draft: CreateOrderInput,
  orders: Order[],
  onDate: string
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  for (const incoming of draft.套餐) {
    for (const existing of orders) {
      if (existing.客户.trim() !== draft.客户.trim()) continue;
      const ear = findEar(existing, incoming.耳别);
      if (ear && earStatus(ear, onDate) === "active") {
        conflicts.push({
          订单号: existing.订单号,
          客户: existing.客户,
          耳别: incoming.耳别,
          剩余次数: currentVersion(ear).剩余次数,
          规则: RULE_CONFLICT,
        });
      }
    }
  }
  return conflicts;
}

let orderSeq = 0;
export function nextOrderId(now: Date = new Date()): string {
  orderSeq += 1;
  const stamp =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `PKG-${stamp}-${orderSeq}${rand}`.toUpperCase();
}

export function createOrder(
  draft: CreateOrderInput,
  orders: Order[],
  onDate: string,
  now: Date = new Date()
): RuleResult<{ order: Order; conflicts: ConflictInfo[] }> {
  if (!draft.客户.trim()) return { ok: false, error: "请填写客户姓名" };
  if (draft.套餐.length === 0)
    return { ok: false, error: "请至少勾选一个耳别" };

  for (const ear of draft.套餐) {
    if (!ear.机型.trim())
      return { ok: false, error: `请填写${EAR_LABEL[ear.耳别]}机型` };
    const v = currentVersion(ear);
    if (!v.首配日)
      return { ok: false, error: `请选择${EAR_LABEL[ear.耳别]}首配日` };
    if (!v.保修至)
      return { ok: false, error: `请选择${EAR_LABEL[ear.耳别]}保修截止日` };
    if (v.套餐次数 <= 0)
      return { ok: false, error: `${EAR_LABEL[ear.耳别]}套餐次数须大于 0` };
  }

  const conflicts = findConflicts(draft, orders, onDate);
  if (conflicts.length > 0) {
    return { ok: false, error: RULE_CONFLICT };
  }

  const order: Order = {
    订单号: draft.订单号 ?? nextOrderId(now),
    客户: draft.客户.trim(),
    建档时间: draft.建档时间 ?? now.toISOString(),
    套餐: draft.套餐,
  };
  return { ok: true, data: { order, conflicts: [] } };
}

// ---------------------------------------------------------------------------
// 规则 R2：每次随访扣减一次并记录效果
// 余次为零或保修过期时不得排期（只能转待续费后续费）
// ---------------------------------------------------------------------------

let followSeq = 0;
export function nextFollowUpId(): string {
  followSeq += 1;
  return `FU-${Date.now().toString(36)}-${followSeq}`;
}

export function addFollowUp(
  orders: Order[],
  input: FollowUpInput,
  onDate: string
): RuleResult<Order[]> {
  if (!input.日期) return { ok: false, error: "请选择随访日期" };
  if (input.日期 > onDate)
    return { ok: false, error: "随访日期不能晚于今天" };
  if (!input.效果.trim()) return { ok: false, error: "请填写随访效果" };

  const order = orders.find((o) => o.订单号 === input.订单号);
  if (!order) return { ok: false, error: "订单不存在" };
  const ear = findEar(order, input.耳别);
  if (!ear) return { ok: false, error: "该订单没有此耳别套餐" };

  if (earStatus(ear, onDate) !== "active") {
    return { ok: false, error: statusReason(ear, onDate) + "，不能排期随访" };
  }

  const follow: FollowUp = {
    id: nextFollowUpId(),
    日期: input.日期,
    效果: input.效果.trim(),
  };

  return {
    ok: true,
    data: orders.map((o) =>
      o.订单号 !== order.订单号
        ? o
        : {
            ...o,
            套餐: o.套餐.map((e) =>
              e.耳别 !== input.耳别
                ? e
                : {
                    ...e,
                    版本: e.版本.map((v, i) =>
                      i !== e.版本.length - 1
                        ? v
                        : {
                            ...v,
                            剩余次数: v.剩余次数 - 1,
                            随访: [...v.随访, follow],
                          }
                    ),
                  }
            ),
          }
    ),
  };
}

// ---------------------------------------------------------------------------
// 规则 R3：续费须写原因并新建版本；旧次数与随访仍可查
// ---------------------------------------------------------------------------

export function renewPackage(
  orders: Order[],
  input: RenewInput,
  now: Date = new Date()
): RuleResult<Order[]> {
  if (!input.续费原因.trim())
    return { ok: false, error: "续费必须填写原因" };
  if (input.套餐次数 <= 0)
    return { ok: false, error: "新套餐次数须大于 0" };
  if (!input.保修至) return { ok: false, error: "请选择新保修截止日" };

  const order = orders.find((o) => o.订单号 === input.订单号);
  if (!order) return { ok: false, error: "订单不存在" };
  const ear = findEar(order, input.耳别);
  if (!ear) return { ok: false, error: "该订单没有此耳别套餐" };

  const last = currentVersion(ear);
  const next: PackageVersion = {
    版本号: last.版本号 + 1,
    首配日: last.首配日, // 首配日不变
    套餐次数: input.套餐次数,
    剩余次数: input.套餐次数,
    保修至: input.保修至,
    续费原因: input.续费原因.trim(),
    创建时间: now.toISOString(),
    随访: [],
  };

  return {
    ok: true,
    data: orders.map((o) =>
      o.订单号 !== order.订单号
        ? o
        : {
            ...o,
            套餐: o.套餐.map((e) =>
              e.耳别 !== input.耳别 ? e : { ...e, 版本: [...e.版本, next] }
            ),
          }
    ),
  };
}

// ---------------------------------------------------------------------------
// 看板指标
// ---------------------------------------------------------------------------

export function computeMetrics(orders: Order[], onDate: string): BoardMetrics {
  const month = currentMonthOf(onDate);
  const metrics: BoardMetrics = {
    在途套餐耳: 0,
    待续费耳: 0,
    剩余随访次数: 0,
    本月随访: 0,
  };
  for (const order of orders) {
    for (const ear of order.套餐) {
      if (earStatus(ear, onDate) === "active") {
        metrics.在途套餐耳 += 1;
        metrics.剩余随访次数 += currentVersion(ear).剩余次数;
      } else {
        metrics.待续费耳 += 1;
      }
      for (const v of ear.版本) {
        metrics.本月随访 += v.随访.filter((f) =>
          currentMonthOf(f.日期).startsWith(month)
        ).length;
      }
    }
  }
  return metrics;
}
