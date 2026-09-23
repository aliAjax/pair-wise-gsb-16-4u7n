import type { Order } from "../types";
import { seedOrders } from "../seed";

// 存储层：localStorage 持久化，与页面、规则解耦。
const STORAGE_KEY = "hxwl-package-board:v1";

export function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedOrders;
    const parsed = JSON.parse(raw) as Order[];
    if (!Array.isArray(parsed)) return seedOrders;
    return parsed;
  } catch {
    return seedOrders;
  }
}

export function saveOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // 隐私模式或配额超限时静默降级为内存态
  }
}

export function resetOrders(): Order[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return seedOrders;
}
