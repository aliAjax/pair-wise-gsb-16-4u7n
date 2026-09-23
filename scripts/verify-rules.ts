import assert from "node:assert";
import { seedOrders } from "../src/seed";
import {
  addFollowUp,
  computeMetrics,
  createOrder,
  currentVersion,
  earStatus,
  renewPackage,
  statusReason,
} from "../src/domain/packageRules";
import type { CreateOrderInput, EarPackage } from "../src/types";

const TODAY = "2026-09-23";
let orders = structuredClone(seedOrders);

// 1. 种子派生：刘芳双耳在途；陈晨左耳余次为零待续费、右耳在途；赵伟左耳保修过期待续费
const liu = orders[0], chen = orders[1], zhao = orders[2];
assert.equal(earStatus(liu.套餐[0], TODAY), "active");
assert.equal(earStatus(liu.套餐[1], TODAY), "active");
assert.equal(earStatus(chen.套餐[0], TODAY), "renewal");
assert.ok(statusReason(chen.套餐[0], TODAY).includes("次数为零"));
assert.equal(earStatus(chen.套餐[1], TODAY), "active");
assert.equal(earStatus(zhao.套餐[0], TODAY), "renewal");
assert.ok(statusReason(zhao.套餐[0], TODAY).includes("保修"));

// 2. 新单：同客户同耳在途 => 拒绝且冲突带客户/耳别/余次/规则
const draft: CreateOrderInput = {
  客户: "刘芳",
  套餐: [
    {
      耳别: "L",
      机型: "新机",
      版本: [{
        版本号: 1, 首配日: TODAY, 套餐次数: 6, 剩余次数: 6,
        保修至: "2028-09-23", 续费原因: null, 创建时间: "", 随访: [],
      }],
    },
  ],
};
const rejected = createOrder(draft, orders, TODAY);
assert.equal(rejected.ok, false);
if (!rejected.ok) assert.ok(rejected.error.includes("在途套餐"));

// 不同耳（假设赵伟只有左耳）：赵伟右耳可建档
const draftR: CreateOrderInput = {
  客户: "赵伟",
  套餐: [
    {
      耳别: "R",
      机型: "新机",
      版本: [{
        版本号: 1, 首配日: TODAY, 套餐次数: 3, 剩余次数: 3,
        保修至: "2028-09-23", 续费原因: null, 创建时间: "", 随访: [],
      }],
    },
  ],
};
const r2 = createOrder(draftR, orders, TODAY);
assert.equal(r2.ok, true);
if (r2.ok) {
  assert.ok(r2.data.order.订单号.startsWith("PKG-"));
  orders = [r2.data.order, ...orders];
}

// 待续费耳的同耳新单应被允许吗？规则只拦截在途 => 允许
const draftChen: CreateOrderInput = {
  客户: "陈晨",
  套餐: [
    {
      耳别: "L",
      机型: "新机",
      版本: [{
        版本号: 1, 首配日: TODAY, 套餐次数: 4, 剩余次数: 4,
        保修至: "2028-09-23", 续费原因: null, 创建时间: "", 随访: [],
      }],
    },
  ],
};
assert.equal(createOrder(draftChen, orders, TODAY).ok, true);

// 3. 随访扣次：刘芳左耳 4 -> 3，效果入当前版本
const before = currentVersion(liu.套餐[0]).剩余次数;
const fu = addFollowUp(orders, {
  订单号: "PKG-20260812-0001", 耳别: "L", 日期: "2026-09-22", 效果: "调试良好",
}, TODAY);
assert.equal(fu.ok, true);
if (fu.ok) {
  orders = fu.data;
  const updated = orders.find((o) => o.订单号 === "PKG-20260812-0001")!;
  const v = currentVersion(updated.套餐[0]);
  assert.equal(v.剩余次数, before - 1);
  assert.equal(v.随访.at(-1)!.效果, "调试良好");
}

// 未来日期拒绝
assert.equal(addFollowUp(orders, {
  订单号: "PKG-20260812-0001", 耳别: "L", 日期: "2026-09-30", 效果: "x",
}, TODAY).ok, false);
// 空效果拒绝
assert.equal(addFollowUp(orders, {
  订单号: "PKG-20260812-0001", 耳别: "L", 日期: "2026-09-22", 效果: "  ",
}, TODAY).ok, false);

// 余次为零耳拒绝排期
const blockedZero = addFollowUp(orders, {
  订单号: "PKG-20260603-0002", 耳别: "L", 日期: "2026-09-22", 效果: "想随访",
}, TODAY);
assert.equal(blockedZero.ok, false);
if (!blockedZero.ok) assert.ok(blockedZero.error.includes("不能排期"));

// 保修过期耳拒绝排期
assert.equal(addFollowUp(orders, {
  订单号: "PKG-20250920-0003", 耳别: "L", 日期: "2026-09-22", 效果: "想随访",
}, TODAY).ok, false);

// 4. 续费：无原因拒绝
assert.equal(renewPackage(orders, {
  订单号: "PKG-20260603-0002", 耳别: "L", 续费原因: "  ",
  套餐次数: 6, 保修至: "2028-09-23",
}).ok, false);

// 续费成功：新版本号+1，余次重置，旧次数与随访仍可查
const rn = renewPackage(orders, {
  订单号: "PKG-20260603-0002", 耳别: "L", 续费原因: "随访次数用完，续购6次",
  套餐次数: 6, 保修至: "2028-09-23",
});
assert.equal(rn.ok, true);
if (rn.ok) {
  orders = rn.data;
  const chen2 = orders.find((o) => o.订单号 === "PKG-20260603-0002")!;
  const ear: EarPackage = chen2.套餐[0];
  assert.equal(ear.版本.length, 2);
  const old = ear.版本[0], cur = ear.版本[1];
  assert.equal(old.剩余次数, 0);
  assert.equal(old.随访.length, 4);
  assert.equal(cur.版本号, 2);
  assert.equal(cur.剩余次数, 6);
  assert.equal(cur.续费原因, "随访次数用完，续购6次");
  assert.equal(cur.首配日, old.首配日);
  assert.equal(earStatus(ear, TODAY), "active");
  // 续费后可以随访并扣新版本的次
  const fu2 = addFollowUp(orders, {
    订单号: "PKG-20260603-0002", 耳别: "L", 日期: "2026-09-23", 效果: "新版本首访",
  }, TODAY);
  assert.equal(fu2.ok, true);
  if (fu2.ok) {
    orders = fu2.data;
    const ear3 = orders.find((o) => o.订单号 === "PKG-20260603-0002")!.套餐[0];
    assert.equal(currentVersion(ear3).剩余次数, 5);
    assert.equal(ear3.版本[0].随访.length, 4, "旧版本随访不受影响");
  }
}

// 5. 指标
const m = computeMetrics(seedOrders, TODAY);
// 在途耳：刘芳2 + 陈晨右1 = 3；待续费：陈晨左1 + 赵伟左1 = 2
assert.equal(m.在途套餐耳, 3);
assert.equal(m.待续费耳, 2);
// 剩余次数：刘芳4+5 + 陈晨右2 = 11
assert.equal(m.剩余随访次数, 11);
// 2026-09 月随访：刘芳 L 09-09、R 09-09；陈晨 R 09-02 = 3
assert.equal(m.本月随访, 3);

console.log("所有领域规则断言通过 ✔");
