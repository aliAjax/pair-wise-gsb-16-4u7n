import type { Ear, Order } from "../types";
import {
  EAR_LABEL,
  currentVersion,
  earStatus,
} from "../domain/packageRules";
import { EarPackageCard } from "./EarPackageCard";

interface Props {
  order: Order;
  onDate: string;
  onFollowUp: (orderNo: string, ear: Ear, date: string, effect: string) => string | null;
  onRenew: (
    orderNo: string,
    ear: Ear,
    reason: string,
    times: number,
    warranty: string
  ) => string | null;
}

export function OrderCard({ order, onDate, onFollowUp, onRenew }: Props) {
  const activeCount = order.套餐.filter(
    (e) => earStatus(e, onDate) === "active"
  ).length;
  const renewalCount = order.套餐.length - activeCount;
  const totalLeft = order.套餐.reduce(
    (sum, e) => sum + currentVersion(e).剩余次数,
    0
  );
  const totalFollowUps = order.套餐.reduce(
    (sum, e) => sum + e.版本.reduce((s, v) => s + v.随访.length, 0),
    0
  );

  return (
    <article className="order-card panel">
      <header className="order-head">
        <div>
          <p className="order-no">{order.订单号}</p>
          <h3>{order.客户}</h3>
          <p className="muted">
            建档 {order.建档时间.slice(0, 10)} ·{" "}
            {order.套餐.map((e) => EAR_LABEL[e.耳别]).join(" / ")}
          </p>
        </div>
        <div className="order-badges">
          <span className="badge ok">在途 {activeCount} 耳</span>
          {renewalCount > 0 && (
            <span className="badge danger">待续费 {renewalCount} 耳</span>
          )}
          <span className="badge">剩余合计 {totalLeft} 次</span>
          <span className="badge">累计随访 {totalFollowUps} 次</span>
        </div>
      </header>

      <div className="ear-card-grid">
        {order.套餐.map((e) => (
          <EarPackageCard
            key={order.订单号 + e.耳别}
            orderNo={order.订单号}
            ear={e}
            onDate={onDate}
            onFollowUp={onFollowUp}
            onRenew={onRenew}
          />
        ))}
      </div>
    </article>
  );
}
