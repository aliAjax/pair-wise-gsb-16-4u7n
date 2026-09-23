import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Ear, Order } from "./types";
import {
  addFollowUp,
  computeMetrics,
  renewPackage,
  todayISO,
} from "./domain/packageRules";
import { loadOrders, resetOrders, saveOrders } from "./storage/orderStore";
import { NewOrderForm } from "./components/NewOrderForm";
import { OrderCard } from "./components/OrderCard";

const project = {
  id: "hxwl-01",
  port: 5101,
  title: "助听器套餐与随访余次台",
  subtitle: "双耳套餐建档 · 随访扣次 · 保修与余次管控 · 续费版本留痕",
  stack: "React + Vite + TypeScript + CSS（localStorage，无新增依赖）",
};

type StatusFilter = "all" | "active" | "renewal";

function App() {
  // 演示基准日取系统当天（种子数据围绕 2026-09 构造）
  const onDate = useMemo(() => todayISO(), []);
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  // 刷新后套餐、余次、随访和版本对应：全部派生自持久化状态
  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  const metrics = useMemo(() => computeMetrics(orders, onDate), [orders, onDate]);

  const visibleOrders = useMemo(() => {
    const kw = keyword.trim();
    return orders.filter((o) => {
      if (kw && !`${o.客户}${o.订单号}`.includes(kw)) return false;
      if (filter === "all") return true;
      return o.套餐.some((e) => {
        const v = e.版本[e.版本.length - 1];
        const renewal = v.剩余次数 <= 0 || v.保修至 < onDate;
        return filter === "renewal" ? renewal : !renewal;
      });
    });
  }, [orders, keyword, filter, onDate]);

  function handleCreated(order: Order) {
    setOrders((prev) => [order, ...prev]);
  }

  function handleFollowUp(
    orderNo: string,
    ear: Ear,
    date: string,
    effect: string
  ): string | null {
    const result = addFollowUp(
      orders,
      { 订单号: orderNo, 耳别: ear, 日期: date, 效果: effect },
      onDate
    );
    if (!result.ok) return result.error;
    setOrders(result.data);
    return null;
  }

  function handleRenew(
    orderNo: string,
    ear: Ear,
    reason: string,
    times: number,
    warranty: string
  ): string | null {
    const result = renewPackage(orders, {
      订单号: orderNo,
      耳别: ear,
      续费原因: reason,
      套餐次数: times,
      保修至: warranty,
    });
    if (!result.ok) return result.error;
    setOrders(result.data);
    return null;
  }

  const metricCards = [
    { label: "在途套餐耳", value: metrics.在途套餐耳 },
    { label: "待续费耳", value: metrics.待续费耳 },
    { label: "剩余随访次数", value: metrics.剩余随访次数 },
    { label: `本月随访（${onDate.slice(0, 7)}）`, value: metrics.本月随访 },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port} · 数据日 {onDate}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈 / 存储</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {metricCards.map((m, index) => (
          <article className="metric-card" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={["status-ok", "status-danger", "status-watch", "status-ok"][index]} />
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>排期规则</h2>
          <ul className="rule-list">
            <li>同一客户同耳已有<strong>在途套餐</strong>时，新单拒绝，输入保留。</li>
            <li>每次随访<strong>扣减 1 次</strong>并记录效果。</li>
            <li><strong>余次为零</strong>或<strong>保修过期</strong>时不得排期，只能转待续费。</li>
            <li>续费必须写原因，并<strong>新建版本</strong>；旧次数与随访仍可查。</li>
          </ul>

          <h2>筛选</h2>
          <div className="chips muted">
            <button
              className={filter === "all" ? "selected" : ""}
              onClick={() => setFilter("all")}
            >
              全部
            </button>
            <button
              className={filter === "active" ? "selected" : ""}
              onClick={() => setFilter("active")}
            >
              在途
            </button>
            <button
              className={filter === "renewal" ? "selected" : ""}
              onClick={() => setFilter("renewal")}
            >
              待续费
            </button>
          </div>

          <h2>数据</h2>
          <p className="muted small">
            所有套餐、余次、随访与版本保存在本机浏览器，刷新后一致。
          </p>
          <button
            className="reset-btn"
            onClick={() => {
              if (window.confirm("恢复示例档案？当前修改将被清除。")) {
                setOrders(resetOrders());
              }
            }}
          >
            恢复示例档案
          </button>
        </aside>

        <NewOrderForm orders={orders} onDate={onDate} onCreated={handleCreated} />
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>套餐台账</p>
            <h2>订单 · 双耳套餐 · 版本与随访</h2>
          </div>
          <label className="search-box">
            <span>搜索客户 / 订单号</span>
            <input
              value={keyword}
              placeholder="如：刘芳 或 PKG"
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
        </div>

        <div className="order-list">
          {visibleOrders.length === 0 && (
            <p className="muted">没有符合条件的套餐单。</p>
          )}
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.订单号}
              order={order}
              onDate={onDate}
              onFollowUp={handleFollowUp}
              onRenew={handleRenew}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
