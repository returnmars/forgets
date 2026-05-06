# forgets 技术栈与脚手架决策

> 决策日期：2026-05-06  
> 结论：TypeScript 和 PerryTS 是核心技术栈；Fastify 是 v1 Perry-native HTTP 传输底座；Rust 是 Perry 源码、runtime/stdlib/FFI 的参考与必要补丁层；Vite+ 适合作为默认脚手架和工作台候选，但不能成为 runtime 语义或 native build contract。

一句话判断：

```txt
Vite+ 做工作台，不做地基。
```

---

## 1. 分层决策

| 层级       | 选择                         | 负责什么                                                | 不负责什么                                  |
| ---------- | ---------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| TypeScript | 用户 API、框架包、compiler/CLI | `@forgets/http`、schema、静态扫描、diagnostics、AI 产物 | 最终 native codegen、Perry runtime 内部实现 |
| PerryTS    | TS -> native 编译目标        | `perry check`、`perry compile`、single-entry native build、Fastify native binding | 通用 JS 工具链、包管理、host-side 单测       |
| Fastify    | v1 native HTTP 传输底座      | Perry 官方可编译 server surface、socket/listen/request/reply 承接 | `@forgets/http` 公开 API、插件契约、框架语义 |
| Rust       | Perry 源码参考/必要补丁层    | 源码审阅、Perry stdlib/FFI 修复、必要 native module      | 默认用户框架实现、默认业务脚手架             |
| Vite+      | 工作区脚手架和开发工具编排   | scaffold、check/test/pack、workspace tasks、agent workflow | runtime 语义、Perry entry、native smoke 标准 |

核心规则：

```txt
公开 API 用 TypeScript 表达。
最终发布必须经过 Perry native check/compile/smoke。
v1 HTTP 底座优先走 Perry 官方 Fastify-compatible path，并用 native tests 固化 forgets 行为。
只有 Fastify path 或 Perry primitive 不足时，才进入 Rust/Perry stdlib/FFI 修复或增强。
Vite+ 可以统一开发入口，但不能改写 native 构建事实。
```

Fastify 版本规则：

```txt
host-side dependency 使用 fastify ^5.8.5。
Fastify 4.x 当前留下 high-severity npm audit 风险，修复路径是 Fastify 5.8.5。
Fastify 5.8.5 已通过 host tests 和 Perry M1 native smoke。
Perry examples 的版本只能作为参考；最终 gate 是 forgets behavior suite 与 Perry native smoke。
```

---

## 2. Perry 与 Rust 的关系

Perry 不是把 TypeScript 翻译成 Rust 源码再编译。当前 Perry 源码和 README 展示的主链路是：

```txt
TypeScript/JavaScript source
  -> SWC parse
  -> Perry HIR lowering
  -> Perry LLVM codegen
  -> native object/link
  -> native executable
```

Rust 在这里有三种角色：

```txt
Perry compiler 本身是 Rust 写的。
Perry runtime/stdlib/native modules 主要由 Rust 实现并参与 link。
forgets 只有在需要修复 Perry stdlib/FFI、补齐 native HTTP primitive 或做不可避免的 native module 时才直接写 Rust。
```

因此，`forgets` 的默认产品栈不应写成 “TS + PerryTS + Rust 三核心”。更准确的是：

```txt
用户和框架 API 层：TypeScript。
native 编译和能力边界：PerryTS。
底层事实核对和必要补丁：Rust/Perry source。
```

---

## 3. Perry 官方 examples 的定位

为了后续开发稳定，已把官方示例仓库拉到本地缓存：

```txt
Local: .forgets/perry-examples
Remote: https://github.com/PerryTS/perry-examples
Checked commit: 88894791bb9b721ff516910e3c481d2510c8a1c6
Commit date: 2026-04-30 17:49:36 +0200
```

这个仓库的定位是“常见 Node 框架/库在 Perry 下的可编译示例”，不是 Perry raw runtime API 设计文档。当前示例覆盖：

```txt
Express + PostgreSQL
Fastify + Redis + MySQL
Hono + MongoDB
Koa + Redis
NestJS + TypeORM
Next.js + Prisma
Blockchain/library compatibility demo
```

README 的运行方式是进入单个子项目后安装依赖，再执行：

```txt
perry build src/index.ts -o server
./server
```

对 forgets 的影响：

```txt
可以参考 examples 的项目隔离方式：每个 app 一个 single entry。
可以参考 examples 覆盖的生态依赖：db/cache/auth/schema/node framework。
不能复制 examples 的 package.json 作为生产默认依赖。
不能把 Express/Hono/Koa/Nest/Next 示例当成 forgets runtime contract。
Fastify 可以作为 v1 底层传输 substrate，但必须隐藏在 `@forgets/runtime` adapter 后面。
不能把 Fastify plugin/hook/route 语义暴露成 `@forgets/http` 的公开契约。
```

---

## 4. Vite+ 的定位

Vite+ 可以作为 forgets 一等推荐脚手架，原因是它把现代 JS/TS 项目的常见工具统一到 `vp` 工作流：创建项目、安装依赖、dev、check、test、build/pack、workspace task。对 forgets 来说，这适合解决“项目怎么起步、怎么检查、怎么跑本地任务”的问题。

适合交给 Vite+：

```txt
创建 monorepo/app/package scaffold
统一 Node/package-manager/dev-tool bootstrap
运行 host-side TS 检查、lint、format、Vitest
打包 TS library/CLI artifact
通过 vp run 编排 m0、native smoke、release check 等脚本
为 agent/CI 提供单一入口
```

不能交给 Vite+：

```txt
不能决定 .forgets/perry-entry.generated.ts 的内容
不能替代 perry check / perry compile
不能替代 native HTTP behavior suite
不能把 Vite dev server 当成 forgets server runtime
不能把 bundler 输出当成 Perry native dependency graph
不能把 vp build 解释成 native server build
```

特别约束：

```txt
vp build 是 Vite application production build。
forgets native server build 必须走 forgets build -> Perry compile。
如果使用 Vite+ 编排 native 构建，应使用 vp run build:native 或 vp run m0 这类项目脚本。
```

---

## 5. 命令契约

不管是否启用 Vite+，这些命令/工具是 native 发布的事实来源：

```txt
npm run typecheck
npm test
npm run m0
npm run perry:doctor
cargo check / cargo test / cargo fmt  # 只在审阅/修改 Perry 或 native module 时进入 release evidence
perry check .forgets/perry-entry.generated.ts
perry compile .forgets/perry-entry.generated.ts -o dist/server
native smoke / native HTTP behavior suite
```

Perry CLI 安装契约：

```txt
npm install -D @perryts/perry
npx perry --version
npx perry doctor
```

官方文档当前推荐项目内 npm/npx 安装作为默认路径，因为它能把 Perry 版本固定在项目依赖里；全局安装、winget/Homebrew/APT 和源码构建可以作为开发者本机偏好，但 CI 和 scaffold 应优先走项目内 `@perryts/perry`。

截至 2026-05-06，本仓库的可复现 npm Perry 版本仍应固定在 `@perryts/perry 0.5.511`：

```txt
npm view @perryts/perry version dist-tags --json
latest: 0.5.511
```

Perry 官方 GitHub release 已发布 `v0.5.585`，`perry update --check-only` 也能发现 `0.5.511 -> 0.5.585`，但 Windows 自更新路径当前无法下载预期的 `perry-windows-x86_64.zip` release asset。因此现在不能把 `package.json`/`package-lock.json` 直接升级到 `0.5.585`，否则 CI 和新机器会不可复现。

源码跟踪路径：

```txt
Local source: .forgets/perry-github-main
Remote: https://github.com/PerryTS/perry.git
Commit: 9ac09171e17e7eec49e4c9d10054bf1ec2580d2a
Commit date: 2026-05-06 07:55:58 +0200
Workspace version: 0.5.585
```

本机源码构建命令：

```txt
cd .forgets/perry-github-main
cargo build --release -p perry
cargo build --release -p perry-runtime -p perry-stdlib -p perry-ui-windows
```

源码版 Perry 验证命令：

```txt
$env:PERRY = (Resolve-Path ".forgets/perry-github-main/target/release/perry.exe").Path
$env:PERRY_RUNTIME_DIR = (Resolve-Path ".forgets/perry-github-main/target/release").Path
$env:PERRY_LIB_DIR = $env:PERRY_RUNTIME_DIR
npm run m0
npm run m1:http
```

规则：

```txt
CI/scaffold 默认用 npm Perry 0.5.511，直到 npm 发布更高版本。
本机 research/nightly 可以用 PERRY/PERRY_RUNTIME_DIR/PERRY_LIB_DIR 覆盖到源码版 0.5.585。
涉及 Perry 源码研读、stdlib/FFI 修复、HTTP raw primitive 判断、Fastify native binding 行为时，优先用源码版验证。
文档必须同时记录 npm 可复现版本和源码跟踪版本。
```

Windows native compile 还需要 Perry doctor 通过 LLVM/codegen 检查。轻量路径是：

```txt
winget install LLVM.LLVM
perry setup windows
```

如果 LLVM 没进 PATH，可以设置 `PERRY_LLVM_CLANG` 指向 `clang.exe`。MSVC linker 存在不等于 Perry compile 完整可用，`clang (LLVM codegen)` 必须通过。

启用 Vite+ 后推荐的工作流：

```txt
vp check              # 格式、lint、类型检查等快速静态检查
vp test               # host-side JS/TS tests
vp pack               # TS library/CLI artifact 打包，适用于包产物
vp run m0             # 编排 Perry M0 compatibility script
vp run build:native   # 编排 forgets build -> Perry compile
```

CI 可以选择直接运行 npm/perry，也可以用 Vite+ 编排。但 release gate 必须以 Perry/native smoke 的结果为准，不能只看 Vite+ 是否通过。Cargo 只在任务触碰 Perry 源码、stdlib、FFI 或 native module 时成为 gate。

---

## 6. 推荐仓库形态

第一方框架仓库推荐结构：

```txt
package.json
tsconfig.json
vitest.config.ts
vite.config.ts            # 启用 Vite+ 时存在，只管理 tooling

packages/
  http/
  schema/
  runtime/
  compiler/
  cli/
  middleware/

crates/
  perry-stdlib-patches/   # 只有需要补齐 Perry stdlib/FFI 时存在
  native-modules/         # 只有不可避免的 native module 需要独立维护时存在

scripts/
  forgets-m0.ps1
  native-smoke.ps1

docs/
  forgets-server-design.md
  forgets-toolchain.md
  perry-compat.md
  schemas/
```

生成的用户项目可以默认带 Vite+，但必须保留普通 package scripts，保证没有 `vp` 的环境仍能看懂和复现核心任务。

---

## 7. 升级与降级规则

Vite+ 升级属于 tooling change，不应改变：

```txt
public @forgets/* API
.forgets generated artifact schema
Perry generated entry contract
native HTTP behavior
release gate
```

如果某个环境无法安装或运行 Vite+：

```txt
允许回退到 npm/pnpm + tsc + vitest + perry。
如果当前任务触碰 Perry 源码或 native module，再额外进入 cargo。
不得因此降低 Perry native 验证要求。
不得把 Vite+ 不可用当作 runtime 缺陷。
```

如果 Vite+ 与 Perry native build 产生冲突：

```txt
Perry native build 优先。
Vite+ 配置必须调整或绕开。
不能为了适配 Vite+ 改变 generated Perry entry 或 runtime contract。
```

---

## 8. 当前采纳结论

`forgets` 应采用这个策略：

```txt
默认 scaffold 可以使用 Vite+。
核心源码和 CI 必须保留直接 npm/perry 路径。
触碰 Perry 源码、stdlib、FFI 或 native module 时，再把 cargo 纳入验证路径。
@forgets/runtime 继续自写 first-party native HTTP driver contract。
Rust/Perry source 负责底层事实核对和必要补丁，不作为默认业务框架栈。
TypeScript 层负责用户 API、静态产物和工具体验。
```

这让项目同时获得较好的 TS 开发体验和明确的 native 发布边界。
