import { useMemo, useState } from "react";
import type {
  ConflictInfo,
  CreateOrderInput,
  Ear,
  EarDraft,
  Order,
} from "../types";
import {
  EAR_LABEL,
  RULE_CONFLICT,
  createOrder,
  findConflicts,
} from "../domain/packageRules";

const EARS: Ear[] = ["L", "R"];

function emptyEar(selected: boolean, onDate: string): EarDraft {
  const [y, m, d] = onDate.split("-").map(Number);
  const warranty = `${y + 2}-${String(m).padStart(2, "0")}-${String(
    d
  ).padStart(2, "0")}`;
  return {
    selected,
    机型: "",
    首配日: onDate,
    套餐次数: "6",
    保修至: warranty,
  };
}

function initialDraft(onDate: string) {
  return {
    客户: "",
    ears: { L: emptyEar(true, onDate), R: emptyEar(true, onDate) },
  };
}

interface Props {
  orders: Order[];
  onDate: string;
  onCreated: (order: Order) => void;
}

export function NewOrderForm({ orders, onDate, onCreated }: Props) {
  const [draft, setDraft] = useState(initialDraft(onDate));
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  // 实时冲突预检：输入到一半也能看到客户、耳别、余次和命中规则
  const liveConflicts = useMemo<ConflictInfo[]>(() => {
    if (!draft.客户.trim()) return [];
    const packages = EARS.filter((e) => draft.ears[e].selected)
      .map((e): CreateOrderInput["套餐"][number] | null => {
        const d = draft.ears[e];
        const times = Number(d.套餐次数);
        if (!Number.isInteger(times) || times <= 0) return null;
        return {
          耳别: e,
          机型: d.机型,
          版本: [
            {
              版本号: 1,
              首配日: d.首配日,
              套餐次数: times,
              剩余次数: times,
              保修至: d.保修至,
              续费原因: null,
              创建时间: "",
              随访: [],
            },
          ],
        };
      })
      .filter((x): x is CreateOrderInput["套餐"][number] => x !== null);
    if (packages.length === 0) return [];
    return findConflicts({ 客户: draft.客户, 套餐: packages }, orders, onDate);
  }, [draft, orders, onDate]);

  function patchEar(ear: Ear, patch: Partial<EarDraft>) {
    setDraft((d) => ({ ...d, ears: { ...d.ears, [ear]: { ...d.ears[ear], ...patch } } }));
    setErrors([]);
    setConflicts([]);
    setLastCreated(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);
    setConflicts([]);
    setLastCreated(null);

    const selectedEars = EARS.filter((e) => draft.ears[e].selected);
    const localErrors: string[] = [];
    if (!draft.客户.trim()) localErrors.push("请填写客户姓名");
    if (selectedEars.length === 0) localErrors.push("请至少勾选一个耳别");
    for (const ear of selectedEars) {
      const d = draft.ears[ear];
      const label = EAR_LABEL[ear];
      if (!d.机型.trim()) localErrors.push(`请填写${label}机型`);
      if (!d.首配日) localErrors.push(`请选择${label}首配日`);
      if (!d.保修至) localErrors.push(`请选择${label}保修截止日`);
      const times = Number(d.套餐次数);
      if (!Number.isInteger(times) || times <= 0)
        localErrors.push(`${label}套餐次数须为正整数`);
    }
    if (localErrors.length > 0) {
      // 校验失败同样保留全部输入
      setErrors(localErrors);
      return;
    }

    const input: CreateOrderInput = {
      客户: draft.客户,
      套餐: selectedEars.map((ear) => {
        const d = draft.ears[ear];
        return {
          耳别: ear,
          机型: d.机型.trim(),
          版本: [
            {
              版本号: 1,
              首配日: d.首配日,
              套餐次数: Number(d.套餐次数),
              剩余次数: Number(d.套餐次数),
              保修至: d.保修至,
              续费原因: null,
              创建时间: new Date().toISOString(),
              随访: [],
            },
          ],
        };
      }),
    };

    const result = createOrder(input, orders, onDate);
    if (!result.ok) {
      // 拒绝：输入原样保留，并展示冲突的客户、耳别、余次、规则
      setErrors([result.error]);
      setConflicts(liveConflicts);
      return;
    }
    onCreated(result.data.order);
    setLastCreated(result.data.order.订单号);
    setDraft(initialDraft(onDate));
  }

  return (
    <section className="panel" id="new-order">
      <div className="section-heading">
        <div>
          <p>新单登记</p>
          <h2>助听器套餐建档</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field-grid">
          <label>
            <span>客户姓名</span>
            <input
              value={draft.客户}
              placeholder="如：刘芳"
              onChange={(e) => {
                setDraft((d) => ({ ...d, 客户: e.target.value }));
                setErrors([]);
                setConflicts([]);
                setLastCreated(null);
              }}
            />
          </label>
          <div className="ear-toggle">
            <span>登记耳别（双耳机型分开登记）</span>
            <div className="chips">
              {EARS.map((ear) => (
                <label key={ear} className="check-chip">
                  <input
                    type="checkbox"
                    checked={draft.ears[ear].selected}
                    onChange={(e) =>
                      patchEar(ear, { selected: e.target.checked })
                    }
                  />
                  {EAR_LABEL[ear]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="ear-form-grid">
          {EARS.map((ear) => {
            const d = draft.ears[ear];
            return (
              <fieldset
                key={ear}
                className={"ear-form" + (d.selected ? "" : " disabled")}
                disabled={!d.selected}
              >
                <legend>{EAR_LABEL[ear]}</legend>
                <label>
                  <span>助听器机型</span>
                  <input
                    value={d.机型}
                    placeholder="如：峰声 Auro RIC 312"
                    onChange={(e) => patchEar(ear, { 机型: e.target.value })}
                  />
                </label>
                <label>
                  <span>首配日</span>
                  <input
                    type="date"
                    value={d.首配日}
                    max={onDate}
                    onChange={(e) => patchEar(ear, { 首配日: e.target.value })}
                  />
                </label>
                <label>
                  <span>套餐次数</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={d.套餐次数}
                    onChange={(e) =>
                      patchEar(ear, { 套餐次数: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>保修至</span>
                  <input
                    type="date"
                    value={d.保修至}
                    onChange={(e) => patchEar(ear, { 保修至: e.target.value })}
                  />
                </label>
              </fieldset>
            );
          })}
        </div>

        {liveConflicts.length > 0 && (
          <div className="conflict-box" role="alert">
            <strong>在途套餐冲突（提交将被拒绝）</strong>
            <ul>
              {liveConflicts.map((c) => (
                <li key={c.订单号 + c.耳别}>
                  客户「{c.客户}」· {EAR_LABEL[c.耳别]} · 订单 {c.订单号} ·
                  剩余 {c.剩余次数} 次 · 规则：{c.规则}
                </li>
              ))}
            </ul>
          </div>
        )}

        {errors.length > 0 && (
          <div className="error-box" role="alert">
            {errors.map((err) => (
              <p key={err}>
                {err === RULE_CONFLICT ? "登记被拒绝：" : ""}
                {err}（输入已保留）
              </p>
            ))}
            {conflicts.length > 0 && (
              <ul>
                {conflicts.map((c) => (
                  <li key={c.订单号 + c.耳别}>
                    客户「{c.客户}」· {EAR_LABEL[c.耳别]} · 订单 {c.订单号} ·
                    剩余 {c.剩余次数} 次 · 规则：{c.规则}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {lastCreated && (
          <div className="success-box" role="status">
            已登记订单 {lastCreated}，可在下方套餐卡继续排期随访。
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary-action">
            登记套餐单
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(initialDraft(onDate));
              setErrors([]);
              setConflicts([]);
            }}
          >
            清空
          </button>
        </div>
      </form>
    </section>
  );
}
