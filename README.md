# hxwl-01 助听器套餐与随访余次台

门店听力师的助听器套餐登记、随访扣次与续费版本工作台，由原“听力验配记录”扩展而来。

## 技术栈

React + Vite + TypeScript + CSS，localStorage 本地持久化，无新增依赖。

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5101

## 功能与规则

- 每单登记客户、双耳机型（可不同机型）、首配日、套餐次数，剩余次数初始等于套餐次数
- 同一客户同一耳存在在途套餐（在途 / 待续费）时，新单拒绝并保留表单输入；冲突显示客户、耳别、余次和命中规则
- 每次随访扣减 1 次并记录随访效果；剩余次数为零或保修过期时不可排期，只能转待续费
- 续费必须填写原因并新建版本（v2、v3…），旧版次数、保修与随访记录仍可按版本查询
- 刷新页面后套餐、余次、随访与版本保持一致（localStorage），支持一键恢复演示资料

## 代码分层

- `src/types.ts`：资料类型
- `src/domain/packages.ts`：冲突校验、扣次、保修阻断、转待续费、续费版本（纯函数）
- `src/data/seed.ts`：演示资料
- `src/storage/packageStore.ts`：localStorage 读写
- `src/hooks/usePackages.ts`：状态编排与持久化
- `src/components/`：新单表单、冲突提示、套餐卡片（随访 / 续费 / 版本历史）
- `src/App.tsx`：页面装配（看板、筛选、列表）
