import { useMemo, useState } from "react";
import "./styles.css";
import { OrderForm } from "./components/OrderForm";
import { PackageCard } from "./components/PackageCard";
import { usePackages } from "./hooks/usePackages";
import { currentVersion, getScheduleState, ORDER_RULES } from "./domain/packages";
import type { AidPackage, PackageStatus } from "./types";

type FilterKey = "all" | PackageStatus | "blocked";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "在途" },
  { key: "pending_renewal", label: "待续费" },
  { key: "blocked", label: "不可排期" },
];

function MetricCard({ label, value, tone }: { label: string; value: string; tone: number }) {
  const statusColors = ["status-ok", "status-watch", "status-danger", "status-ok"];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[tone % statusColors.length]} />
    </article>
  );
}

export default function App() {
  const { packages, notice, submitOrder, addFollowUp, toPendingRenewal, renew, reset } =
    usePackages();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [keyword, setKeyword] = useState("");

  const metrics = useMemo(() => {
    const active = packages.filter((p) => p.status === "active");
    const pending = packages.filter((p) => p.status === "pending_renewal");
    const remainingTotal = packages.reduce((sum, p) => sum + currentVersion(p).remaining, 0);
    const blocked = packages.filter((p) => getScheduleState(p).blocked);
    return {
      active: active.length,
      pending: pending.length,
      remainingTotal,
      blocked: blocked.length,
    };
  }, [packages]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLocaleLowerCase("zh-Hans-CN");
    return packages
      .filter((p: AidPackage) => {
        if (filter === "active") return p.status === "active";
        if (filter === "pending_renewal") return p.status === "pending_renewal";
        if (filter === "blocked") return getScheduleState(p).blocked;
        return true;
      })
      .filter((p) => {
        if (!kw) return true;
        const haystack = [p.customer, p.id, ...p.devices.map((d) => `${d.model}`)]
          .join(" ")
          .toLocaleLowerCase("zh-Hans-CN");
        return haystack.includes(kw);
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [packages, filter, keyword]);

  return (
    <main className="app-shell">
      {notice && (
        <div className={`toast toast-${notice.type}`} role="status">
          {notice.text}
        </div>
      )}

      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-01 · port 5101</p>
          <h1>助听器套餐与随访余次台</h1>
          <p className="subtitle">
            登记客户双耳机型与首配日，按套餐管理剩余次数；每次随访扣减一次并记录效果，余次为零或保修过期只能转待续费，续费生成新版本且旧记录可查。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈与存储</span>
          <strong>React + Vite + TypeScript + CSS · localStorage 本地持久化</strong>
          <span>资料 / 扣次规则 / 存储 / 页面分层，无新增依赖</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="在途套餐" value={String(metrics.active)} tone={0} />
        <MetricCard label="待续费套餐" value={String(metrics.pending)} tone={1} />
        <MetricCard label="当前版本剩余次数合计" value={String(metrics.remainingTotal)} tone={3} />
        <MetricCard label="不可排期套餐" value={String(metrics.blocked)} tone={2} />
      </section>

      <section className="panel rules-panel">
        <div className="section-heading">
          <div>
            <p>业务规则</p>
            <h2>开单 · 扣次 · 阻断 · 续费</h2>
          </div>
        </div>
        <ol className="rules-list">
          {ORDER_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </section>

      <OrderForm onCreate={submitOrder} />

      <section className="panel list-panel">
        <div className="section-heading">
          <div>
            <p>套餐档案</p>
            <h2>套餐 · 余次 · 随访 · 版本</h2>
          </div>
          <button type="button" onClick={reset}>
            恢复演示资料
          </button>
        </div>

        <div className="list-toolbar">
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? "chip-active" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="search-box"
            value={keyword}
            placeholder="按客户姓名 / 机型 / 单号搜索"
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {visible.length === 0 ? (
          <p className="empty-hint">没有符合条件的套餐，可尝试调整筛选或在上方登记新单。</p>
        ) : (
          <div className="package-list">
            {visible.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onFollowUp={addFollowUp}
                onMarkPending={toPendingRenewal}
                onRenew={renew}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
