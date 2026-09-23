import { useCallback, useEffect, useState } from "react";
import type {
  AidPackage,
  FollowUpInput,
  OrderInput,
  RenewalInput,
} from "../types";
import {
  createPackage,
  markPendingRenewal,
  registerFollowUp,
  renewPackage,
} from "../domain/packages";
import { loadPackages, resetPackages, savePackages } from "../storage/packageStore";

export interface Notice {
  type: "success" | "error";
  text: string;
}

export function usePackages() {
  const [packages, setPackages] = useState<AidPackage[]>(() => loadPackages());
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    savePackages(packages);
  }, [packages]);

  const flash = useCallback((next: Notice | null) => {
    setNotice(next);
    if (next) {
      window.setTimeout(() => setNotice(null), 3200);
    }
  }, []);

  const submitOrder = useCallback(
    (input: OrderInput) => {
      const result = createPackage(packages, input);
      if (!result.ok) return result; // 冲突/校验失败时由表单保留输入
      setPackages((prev) => (result.pkg ? [...prev, result.pkg!] : prev));
      flash({ type: "success", text: `新单已登记：${result.pkg!.customer}，套餐 ${result.pkg!.id}` });
      return result;
    },
    [packages, flash]
  );

  const addFollowUp = useCallback(
    (packageId: string, input: FollowUpInput) => {
      const result = registerFollowUp(packages, packageId, input);
      flash({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok && result.pkg) {
        setPackages((prev) => prev.map((p) => (p.id === packageId ? result.pkg! : p)));
      }
      return result.ok;
    },
    [packages, flash]
  );

  const toPendingRenewal = useCallback(
    (packageId: string) => {
      const result = markPendingRenewal(packages, packageId);
      flash({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok && result.pkg) {
        setPackages((prev) => prev.map((p) => (p.id === packageId ? result.pkg! : p)));
      }
    },
    [packages, flash]
  );

  const renew = useCallback(
    (packageId: string, input: RenewalInput) => {
      const result = renewPackage(packages, packageId, input);
      flash({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok && result.pkg) {
        setPackages((prev) => prev.map((p) => (p.id === packageId ? result.pkg! : p)));
      }
      return result;
    },
    [packages, flash]
  );

  const reset = useCallback(() => {
    setPackages(resetPackages());
    flash({ type: "success", text: "已恢复演示资料" });
  }, [flash]);

  return { packages, notice, submitOrder, addFollowUp, toPendingRenewal, renew, reset };
}
