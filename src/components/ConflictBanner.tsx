import type { OrderConflict } from "../types";
import { EAR_LABEL } from "../domain/packages";

interface Props {
  customer: string;
  conflicts: OrderConflict[];
}

/** 冲突拒绝提示：必须显示客户、耳别、余次和命中的规则 */
export function ConflictBanner({ customer, conflicts }: Props) {
  return (
    <div className="banner banner-conflict" role="alert">
      <div className="banner-title">新单被拒绝：同客户同耳存在在途套餐（输入已保留）</div>
      <div className="banner-rule">规则：同一客户同一耳存在在途套餐（含待续费）时不得重复开单，须先续费或核销</div>
      <ul className="conflict-list">
        {conflicts.map((c) => (
          <li key={c.ear}>
            <strong>{customer.trim() || "（客户）"}</strong>
            <span className="tag">{EAR_LABEL[c.ear]}</span>
            <span>在途单 {c.existingId}</span>
            <span>
              状态：{c.status === "active" ? "在途" : "待续费"} · 剩余次数：
              <strong className={c.remaining > 0 ? "remain-ok" : "remain-zero"}>{c.remaining}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FormErrorBannerProps {
  text: string;
}

export function FormErrorBanner({ text }: FormErrorBannerProps) {
  return (
    <div className="banner banner-error" role="alert">
      {text}
    </div>
  );
}
