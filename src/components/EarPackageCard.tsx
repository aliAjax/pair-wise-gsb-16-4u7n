import { useState } from "react";
import type { Ear, EarPackage, PackageVersion } from "../types";
import {
  EAR_LABEL,
  currentVersion,
  earStatus,
  isWarrantyExpired,
  statusReason,
} from "../domain/packageRules";

interface Props {
  orderNo: string;
  ear: EarPackage;
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

function defaultNewWarranty(onDate: string): string {
  const [y, m, d] = onDate.split("-").map(Number);
  return `${y + 2}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function VersionHistory({ versions }: { versions: PackageVersion[] }) {
  // 旧版本次数与随访仍可查：倒序展示，当前版本置顶
  return (
    <div className="version-history">
      {[...versions].reverse().map((v, idx) => {
        const isCurrent = idx === 0;
        return (
          <article
            key={v.版本号}
            className={"version-block" + (isCurrent ? " current" : "")}
          >
            <header>
              <strong>
                v{v.版本号}
                {isCurrent ? "（当前）" : "（历史版本）"}
              </strong>
              <span>
                首配 {v.首配日} · 套餐 {v.套餐次数} 次 · 剩余 {v.剩余次数} 次 ·
                保修至 {v.保修至}
              </span>
            </header>
            {v.续费原因 && (
              <p className="renew-reason">续费原因：{v.续费原因}</p>
            )}
            <ul className="follow-list">
              {v.随访.length === 0 && <li className="muted">本版本暂无随访</li>}
              {v.随访.map((f) => (
                <li key={f.id}>
                  <time>{f.日期}</time>
                  <span>{f.效果}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

export function EarPackageCard({ orderNo, ear, onDate, onFollowUp, onRenew }: Props) {
  const v = currentVersion(ear);
  const status = earStatus(ear, onDate);
  const active = status === "active";
  const warrantyExpired = isWarrantyExpired(v.保修至, onDate);

  const [followDate, setFollowDate] = useState(onDate);
  const [effect, setEffect] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const [showRenew, setShowRenew] = useState(false);
  const [reason, setReason] = useState("");
  const [times, setTimes] = useState("6");
  const [warranty, setWarranty] = useState(defaultNewWarranty(onDate));

  function submitFollowUp(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionOk(null);
    const err = onFollowUp(orderNo, ear.耳别, followDate, effect);
    if (err) {
      setActionError(err);
      return;
    }
    setActionOk(
      `已扣减 1 次：${v.剩余次数} → ${Math.max(v.剩余次数 - 1, 0)}，效果已记录`
    );
    setEffect("");
  }

  function submitRenew(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionOk(null);
    const err = onRenew(orderNo, ear.耳别, reason, Number(times), warranty);
    if (err) {
      setActionError(err);
      return;
    }
    setActionOk(`已新建 v${v.版本号 + 1} 套餐版本，旧版本次数与随访保留可查`);
    setShowRenew(false);
    setReason("");
    setTimes("6");
    setWarranty(defaultNewWarranty(onDate));
  }

  return (
    <article className={"ear-card " + (active ? "is-active" : "is-renewal")}>
      <header className="ear-head">
        <div>
          <span className="ear-tag">{EAR_LABEL[ear.耳别]}</span>
          <strong className="model-name">{ear.机型}</strong>
        </div>
        <span className={"status-pill " + status}>
          {active ? "在途" : "待续费"}
        </span>
      </header>

      <div className="ear-summary">
        <div>
          <span>剩余次数</span>
          <strong className={v.剩余次数 <= 0 ? "zero" : ""}>
            {v.剩余次数}
            <em> / {v.套餐次数} 次</em>
          </strong>
        </div>
        <div>
          <span>首配日</span>
          <strong>{v.首配日}</strong>
        </div>
        <div>
          <span>保修至</span>
          <strong className={warrantyExpired ? "zero" : ""}>{v.保修至}</strong>
        </div>
        <div>
          <span>版本</span>
          <strong>v{v.版本号}</strong>
        </div>
      </div>

      {!active && (
        <p className="block-rule">
          规则拦截：{statusReason(ear, onDate)}，不得排期随访，只能续费。
        </p>
      )}

      <form className="follow-form" onSubmit={submitFollowUp}>
        <label>
          <span>随访日期</span>
          <input
            type="date"
            value={followDate}
            max={onDate}
            disabled={!active}
            onChange={(e) => setFollowDate(e.target.value)}
          />
        </label>
        <label className="grow">
          <span>随访效果（每次扣减一次）</span>
          <input
            value={effect}
            disabled={!active}
            placeholder="如：嘈杂环境言语清晰度提升"
            onChange={(e) => setEffect(e.target.value)}
          />
        </label>
        <button type="submit" className="primary-action" disabled={!active}>
          排期并扣次
        </button>
      </form>

      {!active && !showRenew && (
        <button className="renew-action" onClick={() => setShowRenew(true)}>
          转待续费 · 办理续费
        </button>
      )}

      {showRenew && (
        <form className="renew-form" onSubmit={submitRenew}>
          <p className="renew-title">续费新版本（旧次数与随访保留）</p>
          <label>
            <span>续费原因（必填）</span>
            <input
              value={reason}
              placeholder={
                v.剩余次数 <= 0 ? "如：随访次数用完，续购6次套餐" : "如：保修到期，延保并续购套餐"
              }
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            <span>新套餐次数</span>
            <input
              type="number"
              min={1}
              step={1}
              value={times}
              onChange={(e) => setTimes(e.target.value)}
            />
          </label>
          <label>
            <span>新保修至</span>
            <input
              type="date"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="primary-action">
              确认续费并新建版本
            </button>
            <button type="button" onClick={() => setShowRenew(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="inline-error" role="alert">
          {actionError}
        </p>
      )}
      {actionOk && (
        <p className="inline-ok" role="status">
          {actionOk}
        </p>
      )}

      <VersionHistory versions={ear.版本} />
    </article>
  );
}
