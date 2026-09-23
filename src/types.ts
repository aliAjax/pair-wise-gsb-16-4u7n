// 领域模型：助听器套餐与随访余次台
// 一个订单为同一客户登记双耳，每耳各自持有一条在途套餐线（机型、次数、保修）。

export type Ear = "L" | "R";

/** 每耳套餐线状态：在途可随访；余次为零或保修过期后只能转待续费 */
export type EarStatus = "active" | "renewal";

export interface FollowUp {
  id: string;
  日期: string; // YYYY-MM-DD
  效果: string;
}

export interface PackageVersion {
  版本号: number;
  首配日: string; // YYYY-MM-DD，续费版本继承首配日
  套餐次数: number;
  剩余次数: number;
  保修至: string; // YYYY-MM-DD
  续费原因: string | null;
  创建时间: string; // ISO 时间戳
  随访: FollowUp[];
}

export interface EarPackage {
  耳别: Ear;
  机型: string;
  版本: PackageVersion[]; // 按版本号升序，末位为当前版本
}

export interface Order {
  订单号: string;
  客户: string;
  建档时间: string;
  套餐: EarPackage[];
}

/** 新单表单：双耳分开填写 */
export interface EarDraft {
  selected: boolean;
  机型: string;
  首配日: string;
  套餐次数: string; // 表单内保留字符串，提交时再校验
  保修至: string;
}

export interface OrderDraft {
  客户: string;
  ears: Record<Ear, EarDraft>;
}

/** 冲突提示：客户、耳别、余次和命中的规则都要能展示 */
export interface ConflictInfo {
  订单号: string;
  客户: string;
  耳别: Ear;
  剩余次数: number;
  规则: string;
}

export type CreateOrderInput = Omit<Order, "订单号" | "建档时间"> & {
  订单号?: string;
  建档时间?: string;
};

export interface FollowUpInput {
  订单号: string;
  耳别: Ear;
  日期: string;
  效果: string;
}

export interface RenewInput {
  订单号: string;
  耳别: Ear;
  续费原因: string;
  套餐次数: number;
  保修至: string;
  操作日期?: string;
}

/** 规则层统一返回：成功带数据，失败带可读原因（不抛异常，便于页面保留输入） */
export type RuleResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface BoardMetrics {
  在途套餐耳: number;
  待续费耳: number;
  剩余随访次数: number;
  本月随访: number;
}
