import { useState } from "react";
import type { Ear, OrderConflict, OrderFieldErrors, OrderInput } from "../types";
import { EAR_LABEL, addMonthsISO, todayISO } from "../domain/packages";
import { ConflictBanner } from "./ConflictBanner";

interface Props {
  onCreate: (input: OrderInput) =>
    | { ok: true }
    | { ok: false; errors?: OrderFieldErrors; conflicts?: OrderConflict[] };
}

const EMPTY: () => OrderInput = () => {
  const firstFitDate = todayISO();
  return {
    customer: "",
    devices: [
      { ear: "L", model: "" },
      { ear: "R", model: "" },
    ],
    firstFitDate,
    totalCount: 5,
    warrantyUntil: addMonthsISO(firstFitDate, 24),
  };
};

const EARS: Ear[] = ["L", "R"];

/** 新单登记表单：拒绝时保留输入，成功后清空 */
export function OrderForm({ onCreate }: Props) {
  const [form, setForm] = useState<OrderInput>(EMPTY);
  const [errors, setErrors] = useState<OrderFieldErrors>({});
  const [conflicts, setConflicts] = useState<OrderConflict[]>([]);

  const patchDevice = (ear: Ear, model: string) => {
    setForm((f) => ({
      ...f,
      devices: f.devices.map((d) => (d.ear === ear ? { ...d, model } : d)),
    }));
    setConflicts([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onCreate(form);
    if (result.ok) {
      setForm(EMPTY());
      setErrors({});
      setConflicts([]);
      return;
    }
    setErrors(result.errors ?? {});
    setConflicts(result.conflicts ?? []);
  };

  return (
    <form className="panel order-form" onSubmit={handleSubmit} noValidate>
      <div className="section-heading">
        <div>
          <p>新单登记</p>
          <h2>助听器套餐开单</h2>
        </div>
      </div>

      {conflicts.length > 0 && <ConflictBanner customer={form.customer} conflicts={conflicts} />}

      <div className="field-grid">
        <label>
          <span>客户姓名 *</span>
          <input
            value={form.customer}
            placeholder="例如：刘雯"
            onChange={(e) => {
              setForm((f) => ({ ...f, customer: e.target.value }));
              setConflicts([]);
            }}
          />
          {errors.customer && <em className="field-error">{errors.customer}</em>}
        </label>

        <label>
          <span>首配日 *</span>
          <input
            type="date"
            value={form.firstFitDate}
            onChange={(e) => setForm((f) => ({ ...f, firstFitDate: e.target.value }))}
          />
          {errors.firstFitDate && <em className="field-error">{errors.firstFitDate}</em>}
        </label>

        {EARS.map((ear) => {
          const device = form.devices.find((d) => d.ear === ear)!;
          return (
            <label key={ear} className="ear-field">
              <span>{EAR_LABEL[ear]}机型（双耳至少填一侧，可不同机型）</span>
              <input
                value={device.model}
                placeholder={ear === "L" ? "左耳助听器型号，无则留空" : "右耳助听器型号，无则留空"}
                onChange={(e) => patchDevice(ear, e.target.value)}
              />
              {errors.model?.[ear] && <em className="field-error">{errors.model[ear]}</em>}
            </label>
          );
        })}
        {errors.ears && <em className="field-error">{errors.ears}</em>}

        <label>
          <span>套餐次数（次）*</span>
          <input
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(form.totalCount) ? form.totalCount : ""}
            onChange={(e) => setForm((f) => ({ ...f, totalCount: Number(e.target.value) }))}
          />
          {errors.totalCount && <em className="field-error">{errors.totalCount}</em>}
        </label>

        <label>
          <span>保修截止日 *（默认首配后 24 个月）</span>
          <input
            type="date"
            value={form.warrantyUntil}
            min={form.firstFitDate}
            onChange={(e) => setForm((f) => ({ ...f, warrantyUntil: e.target.value }))}
          />
          {errors.warrantyUntil && <em className="field-error">{errors.warrantyUntil}</em>}
        </label>
      </div>

      <p className="form-hint">
        剩余次数登记时等于套餐次数；同客户同耳若存在在途套餐（含待续费），本单将被拒绝，表单内容保留。
      </p>

      <div className="form-actions">
        <button type="submit" className="primary-action">
          登记新单
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY());
            setErrors({});
            setConflicts([]);
          }}
        >
          清空
        </button>
      </div>
    </form>
  );
}
