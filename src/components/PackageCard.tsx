import { useState } from "react";
import type {
  AidPackage,
  FollowUpInput,
  RenewalFieldErrors,
  RenewalInput,
} from "../types";
import {
  EAR_LABEL,
  addMonthsISO,
  currentVersion,
  getScheduleState,
  todayISO,
  versionFollowUps,
} from "../domain/packages";

interface Props {
  pkg: AidPackage;
  onFollowUp: (packageId: string, input: FollowUpInput) => boolean;
  onMarkPending: (packageId: string) => void;
  onRenew: (
    packageId: string,
    input: RenewalInput
  ) =>
    | { ok: true }
    | { ok: false; message: string; errors?: RenewalFieldErrors };
}

function emptyFollowUp(): FollowUpInput {
  return { date: todayISO(), effect: "" };
}

function emptyRenewal(): RenewalInput {
  return { reason: "", totalCount: 5, warrantyUntil: addMonthsISO(todayISO(), 24) };
}

export function PackageCard({ pkg, onFollowUp, onMarkPending, onRenew }: Props) {
  const cv = currentVersion(pkg);
  const schedule = getScheduleState(pkg);
  const isPending = pkg.status === "pending_renewal";

  const [followForm, setFollowForm] = useState<FollowUpInput>(emptyFollowUp);
  const [followError, setFollowError] = useState("");
  const [showRenew, setShowRenew] = useState(false);
  const [renewForm, setRenewForm] = useState<RenewalInput>(emptyRenewal);
  const [renewErrors, setRenewErrors] = useState<RenewalFieldErrors>({});

  const handleFollow = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onFollowUp(pkg.id, followForm);
    if (ok) {
      setFollowForm(emptyFollowUp());
      setFollowError("");
    } else {
      setFollowError("提交被拒绝，请按上方规则处理");
    }
  };

  const handleRenew = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onRenew(pkg.id, renewForm);
    if (result.ok) {
      setRenewForm(emptyRenewal());
      setRenewErrors({});
      setShowRenew(false);
    } else {
      setRenewErrors(result.errors ?? {});
    }
  };

  return (
    <article className={`package-card status-${pkg.status}`}>
      <header className="pkg-head">
        <div>
          <h3>
            {pkg.customer}
            <span className="pkg-id">{pkg.id}</span>
          </h3>
          <p className="pkg-devices">
            {pkg.devices.map((d) => (
              <span key={d.ear} className="tag">
                {EAR_LABEL[d.ear]} · {d.model}
              </span>
            ))}
            <span className="muted">首配日 {pkg.firstFitDate}</span>
          </p>
        </div>
        <div className="pkg-badges">
          <span className={`badge badge-${pkg.status}`}>{isPending ? "待续费" : "在途"}</span>
          <span className="badge badge-version">v{cv.version}</span>
        </div>
      </header>

      <div className="pkg-metrics">
        <div className={cv.remaining > 0 ? "metric-mini ok" : "metric-mini zero"}>
          <span>剩余次数</span>
          <strong>
            {cv.remaining}
            <em> / {cv.totalCount}</em>
          </strong>
        </div>
        <div className={cv.warrantyUntil >= todayISO() ? "metric-mini ok" : "metric-mini zero"}>
          <span>保修截止</span>
          <strong>{cv.warrantyUntil}</strong>
        </div>
        <div className="metric-mini">
          <span>随访已用（总）</span>
          <strong>{pkg.followUps.length} 次</strong>
        </div>
      </div>

      {/* 随访扣次：仅可排期时开放 */}
      {!schedule.blocked ? (
        <form className="follow-form" onSubmit={handleFollow}>
          <div className="follow-grid">
            <label>
              <span>随访日期</span>
              <input
                type="date"
                value={followForm.date}
                onChange={(e) => setFollowForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <label className="follow-effect">
              <span>随访效果 *</span>
              <input
                value={followForm.effect}
                placeholder="记录本次随访的验配调整与用户反馈"
                onChange={(e) => setFollowForm((f) => ({ ...f, effect: e.target.value }))}
              />
            </label>
          </div>
          {followError && <em className="field-error">{followError}</em>}
          <div className="form-actions">
            <button type="submit" className="primary-action">
              登记随访（{cv.remaining} → {Math.max(cv.remaining - 1, 0)}，扣减 1 次）
            </button>
          </div>
        </form>
      ) : (
        <div className="blocked-box">
          <div className="blocked-msg">排期阻断：{schedule.message}</div>
          {!isPending && (
            <button type="button" className="warn-action" onClick={() => onMarkPending(pkg.id)}>
              转待续费
            </button>
          )}
        </div>
      )}

      {/* 续费：待续费状态专用，原因必填并新建版本 */}
      {isPending && (
        <div className="renew-box">
          {!showRenew ? (
            <button type="button" className="primary-action" onClick={() => setShowRenew(true)}>
              续费（新建版本，恢复排期）
            </button>
          ) : (
            <form className="renew-form" onSubmit={handleRenew} noValidate>
              <h4>续费登记 · 将生成 v{cv.version + 1}</h4>
              <div className="field-grid">
                <label className="full-span">
                  <span>续费原因 *（旧版本与随访保留可查）</span>
                  <input
                    value={renewForm.reason}
                    placeholder="例如：余次清零，客户续购 6 次随访并延保两年"
                    onChange={(e) => setRenewForm((f) => ({ ...f, reason: e.target.value }))}
                  />
                  {renewErrors.reason && <em className="field-error">{renewErrors.reason}</em>}
                </label>
                <label>
                  <span>新套餐次数 *</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={Number.isFinite(renewForm.totalCount) ? renewForm.totalCount : ""}
                    onChange={(e) =>
                      setRenewForm((f) => ({ ...f, totalCount: Number(e.target.value) }))
                    }
                  />
                  {renewErrors.totalCount && (
                    <em className="field-error">{renewErrors.totalCount}</em>
                  )}
                </label>
                <label>
                  <span>新保修截止日 *</span>
                  <input
                    type="date"
                    value={renewForm.warrantyUntil}
                    min={todayISO()}
                    onChange={(e) => setRenewForm((f) => ({ ...f, warrantyUntil: e.target.value }))}
                  />
                  {renewErrors.warrantyUntil && (
                    <em className="field-error">{renewErrors.warrantyUntil}</em>
                  )}
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-action">
                  确认续费
                </button>
                <button type="button" onClick={() => setShowRenew(false)}>
                  取消
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 版本与随访历史：旧次数、续费原因、旧版本随访均可查 */}
      <details className="history-box">
        <summary>
          版本与随访历史（{pkg.versions.length} 个版本 · {pkg.followUps.length} 次随访）
        </summary>
        {pkg.versions
          .map((v, index) => ({ v, index }))
          .reverse()
          .map(({ v, index }) => {
            const fus = versionFollowUps(pkg, v.version);
            const used = v.totalCount - v.remaining;
            return (
              <section
                key={v.version}
                className={`version-block ${index === pkg.versions.length - 1 ? "is-current" : "is-old"}`}
              >
                <div className="version-head">
                  <strong>v{v.version}</strong>
                  {index === pkg.versions.length - 1 && <span className="tag tag-current">当前版本</span>}
                  {index < pkg.versions.length - 1 && <span className="muted">历史版本（只读）</span>}
                  <span className="muted">
                    次数 {v.totalCount} · 已用 {used} · 剩余 {v.remaining}
                  </span>
                  <span className="muted">保修至 {v.warrantyUntil}</span>
                </div>
                {v.renewReason && <p className="renew-reason">续费原因：{v.renewReason}</p>}
                {fus.length === 0 ? (
                  <p className="muted">本版本暂无随访记录</p>
                ) : (
                  <ul className="fu-list">
                    {fus
                      .map((fu) => ({ fu, seq: fus.indexOf(fu) + 1 }))
                      .reverse()
                      .map(({ fu, seq }) => (
                        <li key={fu.id}>
                          <span className="fu-date">{fu.date}</span>
                          <span className="muted">第 {seq} 次</span>
                          <span>{fu.effect}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            );
          })}
      </details>
    </article>
  );
}
