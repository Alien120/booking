# 门店管理后台（Web）

面向店长/店员/管理员的运营后台：预约看板、核销、客户、服务项目、营业设置、二维码、提醒、统计、账号权限。

**技术栈**：Vue 3（全局构建版，本地 vendor）+ 原生 CSS + fetch，**零构建、零依赖安装**，直接静态托管即可。

---

## 1. 怎么打开

后端启动后直接访问：

```
http://127.0.0.1:3000/admin/
```

后端会把 `../admin` 目录挂到 `/admin`（见 `appointment-core/src/server.ts`），根路径 `/` 自动跳转。

**账号**

初始账号定义在 `appointment-core/sql/002_seed.sql` 中（`admin` 为管理员、`staff01` 为店员），
首次初始化后请**立即在「账号与审计」中修改密码**。

> 出于安全考虑，本文档不记录当前环境的实际密码。
> 如需重置：管理员登录后在「账号与审计」改；或直接改数据库 `admin_user.password_hash`（bcrypt）。
> 重置后在浏览器 `localStorage` 清掉 `salon_admin_token` 重新登录。

**独立部署**（不想和后端同域时）：把整个 `admin/` 丢到 Nginx，再把 `js/api.js` 里的 `BASE` 改成完整后端地址，后端需放开 CORS。

---

## 2. 页面与文件对应

| 页面 | 文件 | 说明 |
|---|---|---|
| 登录 | `js/views/login.js` | 账号密码，5 次错误锁 15 分钟 |
| 预约看板 | `js/views/dashboard.js` | 5 个指标 + 当日时间轴，行内直接核销/完成/未到店，60 秒自动刷新 |
| 预约列表 | `js/views/appointments.js` | 日期区间/状态/项目/关键词筛选、分页、详情抽屉、代客下单、改约、取消 |
| 预约日历 | `js/views/calendar.js` | 一周 × 时段矩阵，格内显示客户名与占用量，已满标红 |
| 客户管理 | `js/views/customers.js` | 列表（脱敏）、详情抽屉、编辑标签/偏好/过敏/内部备注、查看完整手机号（留痕） |
| 服务项目 | `js/views/services.js` | 增删改、上下架、可预约开关；时长自动折算占用时段 |
| 营业时间 | `js/views/hours.js` | 7 天营业配置、容量、预约规则参数、特殊日期 |
| 预约二维码 | `js/views/qrcode.js` | 生成/下载/停用，扫码次数、预约数、转化率、14 天趋势 |
| 提醒设置 | `js/views/reminder.js` | 提醒规则开关、模板 ID、发送记录（含失败原因与重发） |
| 数据统计 | `js/views/stats.js` | 预约量、到店率、取消率、未到店率、新增客户、趋势、项目偏好、时段热度 |
| 账号与审计 | `js/views/users.js` | 账号增改停用、角色分配、操作审计日志 |

公共层：`js/api.js`（请求封装 + 全局状态 + toast）、`js/app.js`（布局 + hash 路由）、`css/app.css`（全部样式）。

---

## 3. 权限矩阵

角色数字越小权限越大：`1 管理员 > 2 店长 > 3 店员`。

| 功能 | 店员 | 店长 | 管理员 |
|---|---|---|---|
| 看板 / 预约列表 / 日历 | ✅ | ✅ | ✅ |
| 核销、完成、未到店、取消、改约、代客下单 | ✅ | ✅ | ✅ |
| 客户列表 / 详情 / 编辑 | ✅ | ✅ | ✅ |
| 查看完整手机号 | ❌ | ✅ | ✅ |
| 服务项目 / 营业时间 / 二维码 / 提醒规则 | ❌ | ✅ | ✅ |
| 数据统计 | ✅ | ✅ | ✅ |
| 门店规则参数（提前天数、取消截止等） | ❌ | ❌ | ✅ |
| 账号管理 / 审计日志 | ❌ | ❌ | ✅ |

后端在 `src/admin/routes.ts` 用 `requireRole()` 强校验，前端仅做菜单隐藏——**改前端绕不过权限**。

---

## 4. 关键设计

### 4.1 零构建的取舍
门店场景不需要 SPA 工程化，零构建换来：改一行 CSS 刷新即生效、部署只传文件、没有 node_modules 和 CI。
代价是没有单文件组件与热更新，页面靠 `window.Views` 注册。

### 4.2 核销即改状态，不释放名额
- `核销到店` → 状态 3，名额继续占用（人已经来了）
- `完成服务` → 状态 4，名额不释放（历史占用，用于统计）
- `取消 / 未到店` → 名额立即释放，回到可约池

### 4.3 手机号三层保护
列表只返回 `***8001`；点"查看完整手机号"需店长及以上，且**每次查看写 `audit_log`**，店员调用直接 403。

### 4.4 时段容量变更的边界
改「每时段可接待人数」只同步「今天及以后 + `booked_count = 0`」的时段行（`DAYOFWEEK` 对齐星期），避免把已占用时段改小导致 `booked_count > capacity`。

### 4.5 二维码两级降级
- 配了 `WX_APPID` / `WX_SECRET` → 调 `wxauth.getwxacodeunlimit` 生成真小程序码（扫码直达）
- 没配 → 生成本地普通二维码（占位），页面明确标注"开发态占位码，扫码不跳转"

场景值 `scene` 唯一，用于区分台卡/海报/朋友圈来源；同一 openid 同一天同一码只计 1 次扫码。

---

## 5. 接口对照

所有请求走 `/api/admin/v1`，Bearer token（8 小时过期）。

| 功能 | 接口 |
|---|---|
| 登录 / 当前用户 / 改密 | `POST /auth/login`、`GET /auth/me`、`PUT /auth/password` |
| 看板 | `GET /dashboard?date=` |
| 预约 | `GET/POST /appointments`、`GET /appointments/:id`、`POST /appointments/:id/{confirm,arrive,finish,noshow,cancel,reschedule}` |
| 时段（代客下单/改约） | `GET /slots?date=&serviceId=` |
| 客户 | `GET /customers`、`GET /customers/:id`、`PUT /customers/:id`、`GET /customers/:id/phone` |
| 统计 | `GET /stats?from=&to=` |
| 服务 | `GET/POST /services`、`PUT /services/:id`、`PATCH /services/:id/toggle`、`DELETE /services/:id` |
| 营业设置 | `GET/PUT /settings/business-hours`、`PUT /settings/store`、`GET/POST/DELETE /settings/special-dates` |
| 提醒 | `GET/POST /reminder-rules`、`PATCH /reminder-rules/:id/toggle`、`GET /reminder-jobs`、`POST /reminder-jobs/:id/retry` |
| 二维码 | `GET/POST /qrcodes`、`PATCH/DELETE /qrcodes/:id`、`GET /qrcodes/:id/stats` |
| 账号 | `GET/POST /users`、`PUT /users/:id`、`GET /audit-logs` |

---

## 6. 已验证

接口层：`node tests/admin.test.js`（在 `appointment-core` 下）—— **31 项全通过**，覆盖登录、越权、看板、代客下单、核销流转、取消释放名额、客户脱敏、服务折算、营业保存、特殊日期、提醒开关、二维码生成与扫码统计、统计结构、账号、审计留痕。

界面层：内置浏览器逐页截图确认（登录、看板、列表、统计、账号与审计），数据为真实接口返回。

---

## 7. 已知未做

1. **tabBar 式移动端适配**：后台按 1280+ 宽屏设计（侧栏在 <980px 自动折叠成图标栏）。店员用手机管预约建议直接用小程序侧的「我的预约」，不要用手机开后台。
2. **导出 CSV**：PRD 里有，本轮未做（`/appointments/export`、`/customers/export`）。
3. **预约详情里的改约**：改约入口目前在列表行操作里，详情抽屉只提供核销/完成。
4. **多门店切换器**：表结构已带 `store_id`，前端未做切换（单店版）。
5. **图表库**：趋势/排行用纯 CSS 柱状实现，够用且零依赖；要交互式图表（tooltip、缩放）需引 ECharts。
