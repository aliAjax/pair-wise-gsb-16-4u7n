// 存储层：仅负责 localStorage 读写与结构校验，不包含任何业务规则

import type { AidPackage } from "../types";
import { SEED_PACKAGES } from "../data/seed";

const STORAGE_KEY = "hxwl-01-aid-packages-v1";

function isAidPackage(value: unknown): value is AidPackage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.customer === "string" &&
    typeof v.firstFitDate === "string" &&
    (v.status === "active" || v.status === "pending_renewal") &&
    Array.isArray(v.versions) &&
    v.versions.length > 0 &&
    Array.isArray(v.followUps) &&
    Array.isArray(v.devices)
  );
}

export function loadPackages(): AidPackage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PACKAGES));
      return SEED_PACKAGES;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isAidPackage)) {
      // 数据结构损坏时不覆盖，回退到演示资料并由页面提示
      return SEED_PACKAGES;
    }
    return parsed as AidPackage[];
  } catch {
    return SEED_PACKAGES;
  }
}

export function savePackages(packages: AidPackage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  } catch {
    // 隐私模式 / 配额超限时静默失败，页面内状态仍然可用
  }
}

export function resetPackages(): AidPackage[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PACKAGES));
  } catch {
    // ignore
  }
  return SEED_PACKAGES;
}
