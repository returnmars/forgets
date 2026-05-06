# forgets Server 设计方案

> `forgets` 是一个面向 PerryTS/native TypeScript 的生产级后端服务框架。它不复刻 NestJS，不依赖 decorator、DI 容器、Module、Provider、`reflect-metadata` 或运行时类型反射。它采用显式路由、显式依赖、schema-first、静态检查和 Perry single-entry native build。

核心哲学：

> **路由显式注册，依赖显式组合。**

英文表述：

> **Explicit routes. Explicit dependencies. Native production first.**

---

## 0. 结论

`forgets` 要做的是：

```txt
Go-like explicit backend framework for native TypeScript production services.
```

设计判断：

```txt
Perry 当前能力边界不适合 Router Decorator / NestJS-style DI。
Perry single-entry native compile 很适合显式 composition root。
Perry 官方示例和最新公开源码的服务端路径已经证明 Fastify-compatible server path 可用。
forgets 第一版采用 Fastify 作为 Perry-native HTTP 传输底座，但公开 API 仍是 @forgets/http。
OpenAPI 和 route inspect 必须来自静态 RouteDefinition，不来自运行时反射。
schema 必须是显式 runtime value，不是 TypeScript erased type。
```

因此最终目标不是“Native NestJS”，而是一个完整的生产端 native TypeScript 后端框架：开发者用 TypeScript 编写和使用框架，Perry 负责最终 native 编译和单体二进制部署。

第一版不是最终边界。第一版要先做出 Perry 可验证的生产内核，然后围绕这个内核逐步补齐完整后端框架能力。

源码审阅后的补充判断：

```txt
Perry 编译的是单个入口及其静态依赖图，forgets 必须生成无副作用 native entry。
Perry 支持 TypeScript constructor parameter property，可保留普通 class 人体工学。
Perry 不提供 decorator metadata / runtime type reflection，不能用它换取 NestJS 式 DX。
Perry native async I/O 由 Tokio runtime bridge 承担，但 TS handler 不等于自动多线程并行。
CPU-bound 工作必须显式使用 perry/thread 的 spawn/parallelMap 或 native module。
HTTP accept/connection 可并发，forgets 的 request dispatch/handler 并发语义必须由 M0/M1 native tests 固化。
AbortSignal.timeout 当前不是可靠真实计时取消语义，timeout 只能先做 response boundary。
dynamic import() 在 lowering 中返回 undefined，不适合作为发现机制。
perry-stdlib 的 hyper-based framework 可作为底层参考，但当前 no-Fastify raw server API 还不能作为稳定公开入口。
Perry examples 仓库展示的是 Express/Fastify/Hono/Koa/Nest/Next 等兼容性样板，其中 Fastify 可作为 v1 传输底座参考，但不能成为 forgets 公开框架契约。
```

技术栈与脚手架结论维护在 `docs/forgets-toolchain.md`。摘要如下：

```txt
TypeScript 是用户 API、框架包、compiler/CLI 的主要实现语言。
PerryTS 是最终 native 编译目标和能力边界。
Rust 是 Perry 源码、runtime/stdlib/FFI 的参考与必要补丁层，不是默认用户框架栈。
Vite+ 适合作为默认脚手架和工作台候选，但不作为 runtime、HTTP driver 或 native build contract。
```

---

## 1. 产品目标

`forgets` 的第一性目标按优先级排列：

```txt
性能
稳定性
生产环境
```

这意味着：

```txt
优先使用 Perry 已支持、可静态分析、可 AOT 编译的能力
优先让路由、依赖、生命周期、错误边界和构建入口可见
优先产出能长期运行、可观测、可部署、可回滚的服务
```

开发体验可以好，但不能靠 Perry 不稳定或不可编译的运行时魔法换来。

另外有两个不可降级的产品要求：

```txt
对人友好：显式但不折磨，清晰但不啰嗦，错误能指导修复。
对 AI 友好：结构稳定、信息可机器读取、静态事实可检查、诊断可引用。
```

---

## 2. 完整生产框架范围

`forgets` 的完整形态不是单纯 HTTP router，而是一套 Perry-native production backend framework。

完整框架应覆盖：

```txt
HTTP application model
routing
middleware
schema validation
config/env
structured logging
error handling
request id
access log
timeout response
body limit
concurrency model
backpressure
CPU offload guidance
health/readiness
OpenAPI generation
route inspect
native build
native dev loop
native smoke test
testing helpers
human-readable diagnostics
machine-readable diagnostics
AI context export
database integration
migration
auth helpers
CORS/cookie/JWT
rate limit
metrics/tracing
static file
multipart
WebSocket/SSE
background worker
cron/job
deployment templates
```

但这些能力必须分层落地：

```txt
Core Kernel     必须 Perry native compile/run 验证，所有上层能力依赖它
Production Base 第一版生产服务必须有，默认可用
Production Plus 常见生产功能，验证后加入
Extensions      数据库、auth、jobs、ws 等独立包，单独验证和发布
```

能力矩阵必须维护在设计文档和 release checklist 中：

| 能力                                              | 包                                   | 阶段            | Perry native 验收                             | v1 承诺    |
| ------------------------------------------------- | ------------------------------------ | --------------- | --------------------------------------------- | ---------- |
| HTTP router                                       | `@forgets/http` + `@forgets/runtime` | Core Kernel     | first-party native HTTP route smoke           | 是         |
| response normalization                            | `@forgets/http`                      | Core Kernel     | undefined/null/string/json/error native smoke | 是         |
| schema validation                                 | `@forgets/schema`                    | Core Kernel     | Perry compile + host unit tests               | 是         |
| static route inspect                              | `@forgets/compiler`                  | Core Kernel     | AST scanner golden tests                      | 是         |
| OpenAPI emit                                      | `@forgets/compiler`                  | Core Kernel     | golden JSON schema tests                      | 是         |
| config/env                                        | `@forgets/config`                    | Production Base | process.env native smoke                      | 是         |
| request id/access log/recovery/timeout/body limit | `@forgets/middleware`                | Production Base | native HTTP behavior tests                    | 是         |
| concurrency model/request isolation/backpressure  | `@forgets/http` + `@forgets/runtime` | Production Base | native concurrent request behavior tests      | 是         |
| diagnostics/manifest/AI context                   | `@forgets/compiler` + `@forgets/cli` | Production Base | JSON schema + golden tests                    | 是         |
| graceful shutdown                                 | `@forgets/runtime`                   | Production Plus | signal + close native test                    | 否，先验证 |
| true request cancellation                         | `@forgets/runtime`                   | Production Plus | Abort/cancellation native test                | 否，先验证 |
| CORS/cookie/JWT/rate limit                        | `@forgets/middleware`                | Production Plus | native HTTP behavior tests                    | 分项承诺   |
| metrics/tracing                                   | `@forgets/observability`             | Production Plus | native runtime + exporter tests               | 分项承诺   |
| SQLite/PostgreSQL/MySQL                           | `@forgets/db-*`                      | Extensions      | driver native compile/run tests               | 分项承诺   |
| WebSocket/SSE                                     | `@forgets/realtime`                  | Extensions      | native connection smoke tests                 | 分项承诺   |
| workers/cron/jobs                                 | `@forgets/jobs`                      | Extensions      | native lifecycle tests                        | 分项承诺   |
| deployment templates                              | `@forgets/deploy`                    | Extensions      | generated artifact smoke tests                | 分项承诺   |

这意味着 MVP 不是降低目标，而是建立完整框架的可编译地基。

但 `v1 承诺` 只表示 foundation line 最终需要具备的能力，不表示第一个公开版本一次性交付全部能力。发布节奏必须按验证边界拆开：

```txt
v0.1 Verified Kernel
HTTP router、Context、response normalization、HttpError、Perry native HTTP smoke。

v0.2 Static Tooling
RouteDefinition、static route inspect、duplicate check、diagnostics、manifest。

v0.3 Schema/OpenAPI
schema MVP、schema 静态子集、config/env、OpenAPI emit。

v0.4 Production Base
request id、recovery、timeout response、body limit、access log、healthz/readyz。

v1.0 Foundation Stable
以上能力全部通过 native behavior suite，并冻结 artifact schema 的兼容规则。
```

---

## 3. 人体工程学与 AI 友好

`forgets` 既要 native-first，也要 humane-first。显式 API 不能变成手写样板地狱；静态约束也不能变成用户和 AI 都看不懂的隐形规则。

### 3.1 对人友好

人体工程学目标：

```txt
一个常见任务只有一条推荐路径
简单服务可以很短，复杂服务仍然有清晰结构
显式组合，但用模板和 helper 消除重复劳动
API 命名接近日常后端语义
错误信息带 code、位置、原因、修复建议
CLI 默认输出适合人读
IDE 类型提示能解释 schema、ctx、route options
escape hatch 可以用，但会清楚提示代价
```

对人友好的 API 约束：

```txt
createApp/group/route/schema/loadConfig/createLogger 这些名字稳定且直观
route options 的字段少而固定：params/query/body/response/tags/summary/description/middleware
Context 只暴露高频能力，不把底层 Perry HTTP/runtime 细节倾倒给用户
常见中间件有默认实现：requestId/recovery/timeout/accessLog/bodyLimit
生成器提供推荐目录，不强迫用户理解所有内部包
```

人体工程学预算：

```txt
Hello world 必须少于 10 行用户代码。
REST CRUD 示例必须不用 decorator、DI container、Module 系统也保持可读。
composition root 可以显式，但必须能由 scaffold 生成并长期手写维护。
常见任务必须优先提供 helper，而不是让用户复制内部样板。
高级 escape hatch 必须能跑，但 CLI 要告诉用户失去了哪些静态产物。
```

推荐入口分层：

```txt
src/server.ts 导出 buildServer()，用于 generated native entry。
src/main.ts 可选，只做本地手动启动，不作为 compiler 的事实来源。
src/app.ts 只组合 app/middleware/routes，不读取环境变量。
src/infra/deps.ts 只创建外部依赖，不注册路由。
```

错误信息格式：

```txt
FORGETS_ROUTE_DYNAMIC_PATH
severity: warning
file: src/users/users.routes.ts
message: Dynamic route path cannot be included in OpenAPI.
suggestion: Use a string literal path such as route.get("/:id", handler).
```

CLI 必须同时支持：

```txt
默认人类输出：短、清楚、带建议
--json 机器输出：稳定 schema、可被 AI 和工具消费
```

### 3.2 对 AI 友好

AI 友好不是“给 AI 写提示词”，而是让代码库和工具链产生稳定、明确、可读取的事实。

AI 友好目标：

```txt
项目结构稳定
文件命名可预测
路由、schema、config、构建入口可静态发现
诊断有稳定 code
CLI 支持 JSON 输出
生成产物带 schemaVersion
OpenAPI、routes、manifest、diagnostics 都能机器读取
文档描述可执行规则，而不是只讲理念
```

AI 友好必须靠产物，不靠猜测：

```txt
AI 不需要运行用户服务就能知道 route graph。
AI 不需要读取 secret 就能知道 config keys。
AI 不需要执行 schema factory 就能知道 OpenAPI 静态子集。
AI 不需要理解 Perry HTTP/runtime 内部就能知道 native compatibility status。
AI 能把 diagnostic code、source span、suggestion 直接引用到修复任务中。
```

AI/工具产物必须有正式 schema，并且 schemaVersion 只做向后兼容扩展：

```txt
docs/schemas/manifest.schema.json
docs/schemas/diagnostics.schema.json
docs/schemas/ai-context.schema.json
```

版本规则：

```txt
schemaVersion 增加字段时保持兼容，不递增 major
删除字段、改字段含义、改类型时必须递增 major
CLI --json 输出必须能被对应 schema 校验
golden tests 必须覆盖 manifest/diagnostics/ai-context
```

生成产物：

```txt
.forgets/routes.generated.ts
.forgets/openapi.generated.json
.forgets/manifest.generated.json
.forgets/diagnostics.generated.json
.forgets/perry-entry.generated.ts
```

`manifest.generated.json` 应包含：

```json
{
  "schemaVersion": 1,
  "framework": "forgets",
  "entry": ".forgets/perry-entry.generated.ts",
  "routes": [
    {
      "method": "GET",
      "path": "/users/:id",
      "source": "src/users/users.routes.ts",
      "factory": "usersRoutes",
      "index": 0,
      "tags": ["Users"]
    }
  ],
  "diagnostics": []
}
```

面向 AI/工具的命令：

```txt
forgets routes --json
forgets openapi --json
forgets check --json
forgets doctor --json
forgets ai-context --json
```

`forgets ai-context --json` 输出框架事实，不输出敏感环境变量：

```txt
Perry version
forgets version
package list
generated entry
route graph
schema names
config schema keys without values
diagnostics
native compatibility status
```

### 3.3 取舍规则

当人体工程学、AI 友好和 native 确定性发生冲突时，按这个顺序处理：

```txt
不能破坏 Perry native compile/run
不能隐藏生产生命周期和错误边界
优先用 scaffold/helper 改善人类体验，而不是引入反射魔法
优先用 manifest/json diagnostics 改善 AI 体验，而不是让 AI 执行用户代码猜事实
escape hatch 必须可运行，但必须从静态产物中明确标记或排除
```

---

## 4. Perry 源码基线

当前审阅基准：

```txt
Perry source: docs/perry-main-src/perry-main
Workspace version: 0.5.494
Compatibility baseline: docs/perry-compat.md
```

Perry 文档和源码可能存在时间差。`forgets` 的能力边界以 Perry 源码审阅加 M0 native compile/run 实测为准。

### 4.1 Decorators

Perry HIR lowering 会拒绝 TypeScript decorators：

```txt
class decorators
method decorators
property decorators
private method/property decorators
constructor parameter decorators
method parameter decorators
```

源码位置：

```txt
docs/perry-main-src/perry-main/crates/perry-hir/src/lower_decl.rs
```

框架结论：

```txt
不做 @Controller
不做 @Get/@Post/@Put/@Patch/@Delete
不做 @Injectable/@Inject/@Module
不做 Router Decorator
```

同时，Perry 源码已经处理 TypeScript parameter properties：

```txt
constructor(private repo: UsersRepository) {}
constructor(public name: string) {}
```

这类语法会被 lowering 注册为 class field，并合成 `this.field = param`。框架可以保留这种普通 TypeScript 人体工学；禁用的是 decorator metadata 和 constructor parameter injection，不是普通 class。

### 4.2 Reflect / Metadata

Perry 源码里存在部分 `Reflect.*`、`Proxy`、`Symbol`、`Object.defineProperty` 的 lowering/codegen/runtime 分支。

但这不等于支持：

```txt
reflect-metadata
design:type
design:paramtypes
decorator metadata
runtime TypeScript type reflection
```

框架结论：

```txt
可以承认部分 Reflect/Proxy/Symbol 存在。
不能把路由、schema、DI、参数注入、OpenAPI 建立在 Reflect/metadata 上。
```

### 4.3 Dynamic Import

动态 `import()` 仍不是可依赖的生产能力。

源码里的 lowering 分支会对 `import("...")` 打 warning，并返回 `undefined`。这不是“功能不完整但可试用”，而是“不能作为框架机制”。

框架结论：

```txt
不依赖 dynamic import() 做路由发现
不在运行时遍历文件系统发现 controller
不做自动模块加载
```

### 4.4 Compile / Check

Perry `compile` 面向单个 `.ts` 入口。`perry check` 可做兼容性前置检查，但不能替代最终 codegen/link/native smoke test。

Perry 不是把 TypeScript 翻译成 Rust 源码再编译。源码和 README 展示的主链路是 SWC parse、HIR lowering、LLVM codegen、object/link、native executable。Rust 是 Perry compiler、runtime、stdlib/native module 的实现语言；forgets 只在审阅 Perry 能力、修复 stdlib/FFI 或补齐必要 native module 时直接进入 Rust/Cargo。

源码里的 compile 流程从 `CompileArgs.input` 收集模块、识别 entry module，并让 entry main 调用非 entry module init。entry module 编译失败会直接拒绝 link。因此 forgets 的 generated entry 必须非常小、确定、无业务副作用，避免把用户 main 的启动副作用混进编译事实。

框架结论：

```txt
forgets build 生成 .forgets/perry-entry.generated.ts
用户导出 buildServer()，generated entry 调用 buildServer() 和 app.listen()
perry check 只是 preflight
发布标准必须包含 perry compile 成功
生产声明必须有 native smoke test
```

### 4.5 First-party Native HTTP

当前结论以三份材料交叉确认：

```txt
本地 Perry source: docs/perry-main-src/perry-main
Perry GitHub main: PerryTS/perry @ 9ac09171e17e7eec49e4c9d10054bf1ec2580d2a
Perry examples: PerryTS/perry-examples @ 88894791bb9b721ff516910e3c481d2510c8a1c6
```

GitHub main 中存在 `crates/perry-ext-fastify`，官方 HTTP server snippet 和 `test_fastify_integration.ts` 都以 Fastify 为服务端集成样例。`perry-examples` 也主要展示 Express、Fastify、Hono、Koa、NestJS、Next.js 等常见 Node 框架/库在 Perry 下的编译兼容性，并在 README 中用每个子项目单独 `perry build src/index.ts -o server` 的方式运行。

这说明 Perry “能处理 HTTP”，并且当前可验证的服务端主线就是 Fastify-compatible path。forgets v1 可以把 Fastify 作为 native HTTP 传输底座，但不能把 Fastify 的插件、hook、route 语义暴露为框架公开契约。

Perry 仍有可利用的 raw native HTTP 事实：`crates/perry-stdlib/src/framework/server.rs` 是 hyper + tokio 的 HTTP server 实现，连接 accept 和 socket I/O 在 Tokio 上运行，请求通过 channel 交给 TS 侧处理，再等待 response channel 写回。这个底层模型适合做 forgets 后续的 no-Fastify driver，但当前直接在 TS 里声明 raw `js_http_*` 符号会踩 ABI/codegen 问题，不能作为 M1 稳定路径。

源码审阅风险：

```txt
官方公开 server 示例当前偏 Fastify/框架兼容
Fastify-compatible path 是当前 v1 可交付 HTTP 底座
no-Fastify raw server API 尚未稳定暴露为 TypeScript 模块
direct js_http_* declarations 在 Perry 0.5.511 下存在 ABI/codegen 风险
hyper-based framework 是否满足 route/path/query/header/body 基线需要 Perry 上游 API 修复后再做 native tests
bodyLimit 必须在 first-party driver 读取 body 时强制执行
undefined/null response 不能继承底层默认语义，必须由 forgets 固定
request id 应由 forgets 自己生成
server close/graceful close 需要 first-party driver native tests
request queue/backpressure/max concurrency 必须成为 forgets 显式配置
```

框架结论：

```txt
第一版封装 Fastify-compatible path 作为 @forgets/runtime 默认 native HTTP driver。
host-side Fastify dependency 使用 ^5.8.5，并以 npm audit + native smoke 作为版本 gate。
公开契约必须是 @forgets/http，不承诺 Fastify 兼容。
route dispatch、middleware、recovery、body limit、request id、timeout、response normalization 都在 forgets 层实现。
M1 native HTTP 以 Fastify-backed driver 通过；raw no-Fastify path 延后到 Perry upstream raw HTTP API/ABI 稳定后再推进。
不通过 forgets 私有 Rust shim 绕过；raw 底层应推动或跟进 Perry stdlib/FFI/codegen 修复。
```

### 4.6 Abort / Signals

`AbortController` / `AbortSignal` 有部分实现，但 `AbortSignal.timeout(ms)` 的真实计时和取消语义必须实测。

源码里 `AbortSignal.timeout(ms)` 当前返回一个 initially not aborted 的 signal，并明确没有启动真实 timer。`AbortController.abort()` 和 listener 触发是有实现的，但不能推出 timeout 能取消底层 IO。

`process.on("exit"/"SIGTERM"/"SIGINT")` 不能直接按 Node.js graceful shutdown 语义假定。

源码里 `process.on` 仅存储 handler；注释说明这些 handler 不会在真实进程退出时触发。

框架结论：

```txt
timeout v1 只承诺返回 timeout response。
timeout v1 不承诺取消底层 in-flight IO。
graceful shutdown 第一版是验证项，不是默认承诺。
```

### 4.7 Async / Concurrency

Perry 的并发模型不是 Node/Bun 单 isolate 事件循环的简单复制，也不是“所有 TS handler 自动跑在 Tokio worker 上”。源码和文档显示它至少有三层：

```txt
Native I/O async
  perry-stdlib 通过全局 Tokio runtime bridge 执行 native async work。
  数据库、HTTP client、WebSocket、部分 crypto/compression 等 async stdlib 都走这个桥。

TS async/await
  Perry 通过 Promise/microtask/state-machine 语义恢复 TS async 函数。
  这是 cooperative async，不等于自动多核 CPU 并行。

CPU parallelism
  perry/thread 提供 spawn/parallelMap，使用真实 OS threads。
  跨线程值通过 serialize/deep copy 传递，每个线程有独立 arena/GC。
```

HTTP server 层的低层实现使用 `hyper + tokio` accept connection，并把请求通过 channel 交给 TS 侧处理，再等待 response channel 返回。这说明 socket/connection I/O 可并发，但不能仅凭这一点承诺每个 TS request handler 都自动多线程并行执行。

源码审阅风险：

```txt
复杂 JSValue 不能在 Tokio worker 上直接创建，必须回主线程 deferred conversion。
CPU-bound TS 代码会占用当前 Perry 执行线程，除非显式 offload。
perry/thread 不共享 mutable JS heap，跨线程是 deep copy，不是 SharedArrayBuffer/Atomics。
inline async route closure 的编译语义必须实测，推荐先以顶层命名 async handler 作为稳定路径。
first-party driver 的 request dispatch 并发行为不能只从 hyper accept 推出，必须用并发请求测试确认。
```

框架结论：

```txt
默认异步，显式并行。
I/O-bound handler 使用 async/await，不向用户暴露 Tokio。
CPU-bound handler 使用 perry/thread spawn/parallelMap 或专门 native package。
不承诺所有 TS handler 自动多核并行。
每个 request 必须有独立 Context/state，不允许跨请求复用可变 Context。
backpressure、request queue、max concurrency 必须成为框架显式配置和测试项。
```

---

## 5. 非目标

这些不是“以后再做”，而是项目边界：

```txt
不做 Router Decorator
不做 @Controller/@Get/@Post/@Put/@Patch/@Delete
不做 @Injectable/@Inject/@Module
不做 DI container
不做 Provider Token
不做 imports/exports Module 系统
不做 constructor parameter injection
不做 reflect-metadata
不做 runtime type reflection
不做 class-validator/class-transformer 强绑定
不承诺 NestJS 插件兼容
不暴露 Fastify 公开契约
不承诺 Fastify 插件兼容
不承诺全部 npm 生态兼容
不依赖 dynamic import() 做路由发现
不把 Node/Bun simulator 当生产语义来源
```

原因：

```txt
它们要么 Perry 当前不支持
要么语义不足以作为框架契约
要么会把生产服务重新带回运行时黑箱
```

---

## 6. 目标开发体验

推荐写法：

```ts
import {
  createApp,
  group,
  route,
  HttpError,
  type Context,
} from "@forgets/http";
import { schema } from "@forgets/schema";
import type { Infer } from "@forgets/schema";
import { loadConfig } from "@forgets/config";
import { createLogger } from "@forgets/logger";
import { accessLog, requestId, recovery, timeout } from "@forgets/middleware";

const Config = schema.object({
  PORT: schema.number().default(3000),
  DATABASE_URL: schema.string(),
  LOG_LEVEL: schema.enum(["debug", "info", "warn", "error"]).default("info"),
});

const CreateUser = schema.object({
  name: schema.string().min(1),
  email: schema.string().email(),
});

const User = schema.object({
  id: schema.string(),
  name: schema.string(),
  email: schema.string(),
});

type CreateUser = Infer<typeof CreateUser>;

class UsersRepository {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.queryOne("select * from users where id = ?", [id]);
  }

  async create(input: CreateUser) {
    return this.db.queryOne(
      "insert into users(name, email) values(?, ?) returning *",
      [input.name, input.email],
    );
  }
}

class UsersService {
  constructor(private repo: UsersRepository) {}

  async findById(id: string) {
    const user = await this.repo.findById(id);

    if (!user) {
      throw HttpError.notFound("User not found", {
        code: "USER_NOT_FOUND",
      });
    }

    return user;
  }

  async create(input: CreateUser) {
    return this.repo.create(input);
  }
}

class UsersController {
  constructor(private users: UsersService) {}

  async get(ctx: Context) {
    return this.users.findById(ctx.params.id);
  }

  async create(ctx: Context) {
    const input = await ctx.json(CreateUser);
    return this.users.create(input);
  }
}

export function usersRoutes(controller: UsersController) {
  return group("/users", [
    route.get("/:id", (ctx) => controller.get(ctx), {
      response: User,
      summary: "Get user by id",
      tags: ["Users"],
    }),
    route.post("/", (ctx) => controller.create(ctx), {
      body: CreateUser,
      response: User,
      summary: "Create user",
      tags: ["Users"],
    }),
  ]);
}

export async function buildServer() {
  const config = loadConfig(Config);
  const logger = createLogger({ level: config.LOG_LEVEL });

  const db = new Database(config.DATABASE_URL);
  const repo = new UsersRepository(db);
  const service = new UsersService(repo);
  const controller = new UsersController(service);

  const app = createApp();

  app.use(requestId());
  app.use(recovery());
  app.use(timeout(30_000));
  app.use(accessLog(logger));

  app.routes(usersRoutes(controller));

  return { app, config };
}
```

这个例子里：

```txt
依赖怎么创建：看得见
路由怎么注册：看得见
handler 绑定到哪个实例：看得见
schema 在哪里生效：看得见
OpenAPI 信息来自哪里：看得见
native compile 入口可以生成：看得见
listen 由 generated entry 或显式 main.ts 执行：看得见且不会因 import 重复启动
```

---

## 7. 核心原则

### 7.1 路由必须是显式值

主路径：

```ts
const routes = group("/users", [
  route.get("/:id", (ctx) => controller.get(ctx)),
  route.post("/", (ctx) => controller.create(ctx)),
]);

app.routes(routes);
```

收益：

```txt
Perry 可以编译
工具链可以静态扫描
route inspect 不依赖运行时
OpenAPI 不依赖反射
重复路由检查可以在 build 前失败
handler 绑定明确
```

### 7.2 依赖全部手动组合

用户自己写 composition root：

```ts
const db = new Database(config.DATABASE_URL);
const repo = new UsersRepository(db);
const service = new UsersService(repo);
const controller = new UsersController(service);
```

收益：

```txt
启动顺序明确
生命周期明确
测试容易
没有容器查找开销
没有 token 解析
没有循环依赖黑箱
```

### 7.3 Handler 统一接受 Context

不做参数注入：

```ts
function get(id: string, body: CreateUser) {}
```

只做：

```ts
async function get(ctx: Context) {
  const id = ctx.params.id;
  const input = await ctx.json(CreateUser);
}
```

收益：

```txt
参数来源清楚
实现简单
AOT 友好
调试简单
和 Go handler 思想一致
```

### 7.4 Schema 是 runtime 边界

TypeScript 类型会擦除。所有外部输入输出必须用 schema 显式描述：

```ts
const CreateUser = schema.object({
  name: schema.string().min(1),
  email: schema.string().email(),
});

type CreateUser = Infer<typeof CreateUser>;
```

schema 负责：

```txt
config/env 校验
params/query/body 校验
response 描述
OpenAPI schema emit
错误格式
测试样例生成
```

### 7.5 生产行为优先

不能出现：

```txt
dev 模式能跑
native build 失败
生产行为和开发行为不一致
```

要求：

```txt
forgets check 早发现 Perry 不兼容能力
forgets dev 贴近 Perry runtime
Node/Bun simulator 只能辅助
稳定 API 必须能被 Perry compile 验证
```

---

## 8. 包与边界

建议 monorepo：

```txt
packages/
  http/
  schema/
  config/
  logger/
  middleware/
  observability/
  cli/
  compiler/
  runtime/
  testing/
examples/
  hello-world/
  rest-api/
  sqlite-api/
  postgres-api/
docs/
  perry-compat.md
  forgets-server-design.md
  schemas/
    manifest.schema.json
    diagnostics.schema.json
    ai-context.schema.json
```

### 8.1 `@forgets/http`

职责：

```txt
createApp()
group()
route.get/post/put/patch/delete/head/options
Context
ResponseBuilder
HttpError
Middleware
response normalization
driver adapter interface
```

不负责：

```txt
OpenAPI 文件写入
Perry CLI 调用
数据库封装
```

### 8.2 `@forgets/schema`

职责：

```txt
schema runtime values
parse/safeParse
default/coerce
error formatting
Infer<T>
serializable descriptor
OpenAPI schema emit
```

推荐导入方式：

```ts
import { schema, type Infer } from "@forgets/schema";

const CreateUser = schema.object({
  name: schema.string().min(1),
});

type CreateUser = Infer<typeof CreateUser>;
```

不推荐把类型工具挂在 `schema.Infer` 上，避免依赖 namespace/value 合并语义，减少 Perry/tsc 兼容风险。

MVP 类型：

```txt
string
number
boolean
object
array
enum
literal
optional
nullable
default
min/max
regex
email
uuid
unknown
```

设计约束：

```txt
不依赖 Reflect metadata
不依赖 decorator
不依赖 Proxy 作为核心机制
不直接绑定 Zod
每个 Schema runtime value 必须携带可序列化 descriptor
compiler 必须能静态读取 @forgets/schema 的 MVP DSL
OpenAPI emit 只承诺静态 schema 子集，不执行用户 schema factory
```

Schema 的双重契约：

```ts
export interface Schema<T> {
  parse(value: unknown): T;
  safeParse(value: unknown): ParseResult<T>;
  describe(): SchemaDescriptor;
}
```

`describe()` 服务于 runtime、测试和调试；`@forgets/compiler` 不能靠执行 `describe()` 来发现用户 schema。compiler 必须用 AST 读取同一套 schema DSL，并把 runtime-valid 但 static-unreadable 的 schema 标记为诊断。

### 8.3 `@forgets/config`

职责：

```txt
读取 process.env
可选读取 .env
按 schema 做类型转换和默认值
启动时失败并打印结构化错误
```

API：

```ts
const Config = schema.object({
  PORT: schema.number().default(3000),
  DATABASE_URL: schema.string(),
});

const config = loadConfig(Config);
```

### 8.4 `@forgets/logger`

职责：

```txt
structured logger
error log
```

输出 JSON：

```json
{
  "level": "info",
  "time": "2026-05-05T12:00:00.000Z",
  "msg": "request completed",
  "requestId": "req_1",
  "method": "GET",
  "path": "/healthz",
  "status": 200,
  "durationMs": 3
}
```

### 8.5 `@forgets/middleware`

职责：

```txt
requestId()
recovery()
timeout()
bodyLimit()
accessLog()
CORS/cookie/JWT/rate limit 等后续生产中间件
```

边界：

```txt
中间件可依赖 @forgets/http 的 Context/Handler/Middleware
中间件不直接依赖底层 Perry HTTP hook 或 driver 私有对象
中间件输出的错误和日志必须走统一 diagnostics/logger 结构
```

### 8.6 `@forgets/observability`

职责：

```txt
metrics
tracing
exporter adapters
runtime health signals
```

这些能力属于 Production Plus，需要单独 native runtime 验证后再承诺。

### 8.7 `@forgets/runtime`

职责：

```txt
实现 first-party Perry-native HTTP driver
提供 driver interface
隔离 Perry HTTP primitive 和 @forgets/http 语义差异
必要时新增/修复 Perry stdlib HTTP FFI
```

公开原则：

```txt
用户不直接感知底层 Perry HTTP primitive
用户不依赖 Fastify plugin 或 Fastify hook
用户 API 保持 @forgets/http 契约
```

### 8.8 `@forgets/cli` / `@forgets/compiler`

CLI：

```txt
forgets dev
forgets check
forgets routes
forgets openapi
forgets doctor
forgets ai-context
forgets build
```

命令约束：

```txt
默认输出给人读：短、明确、带修复建议
--json 输出给工具和 AI 读：稳定 schema、稳定 diagnostic code
```

compiler 负责：

```txt
解析 forgets.config.ts
扫描静态 route definitions
生成 .forgets/routes.generated.ts
生成 .forgets/openapi.generated.json
生成 .forgets/manifest.generated.json
生成 .forgets/diagnostics.generated.json
生成 .forgets/perry-entry.generated.ts
调用 perry check
调用 perry compile
```

---

## 9. HTTP API 契约

### 9.1 RouteDefinition

```ts
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface RouteDefinition {
  kind: "route";
  method: HttpMethod;
  path: string;
  handler: Handler;
  options: RouteOptions;
}

export interface RouteGroup {
  kind: "group";
  prefix: string;
  routes: RouteEntry[];
}

export type RouteEntry = RouteDefinition | RouteGroup;

export interface RouteOptions {
  params?: Schema<any>;
  query?: Schema<any>;
  body?: Schema<any>;
  response?: Schema<any>;
  summary?: string;
  description?: string;
  tags?: string[];
  middleware?: Middleware[];
}
```

### 9.2 Route API

```ts
export const route = {
  get(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
  post(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
  put(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
  patch(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
  delete(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
  head(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
  options(path: string, handler: Handler, options?: RouteOptions): RouteDefinition,
};

export function group(prefix: string, routes: RouteEntry[]): RouteGroup;
```

### 9.3 App API

```ts
export interface App {
  use(middleware: Middleware): void;
  route(
    method: HttpMethod,
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): void;
  get(path: string, handler: Handler, options?: RouteOptions): void;
  post(path: string, handler: Handler, options?: RouteOptions): void;
  routes(routes: RouteEntry | RouteEntry[]): void;
  listen(port: number, options?: ListenOptions): Promise<void>;
}
```

`app.get/post/...` 是 runtime escape hatch。可运行，但只有满足静态子集时才进入 route inspect/OpenAPI。

---

## 10. 静态路由与 OpenAPI

`forgets routes` 和 `forgets openapi` 只读取静态 route shape，不执行用户代码。

扫描器必须基于 TypeScript/SWC AST，不允许用正则表达式解析路由。静态扫描是框架契约的一部分，必须能稳定处理 import、export、顶层 const、route factory、对象字面量、schema DSL 和诊断位置。

### 10.1 允许的静态子集

```txt
group prefix 是字符串字面量
route path 是字符串字面量
method 来自 route.get/post/put/patch/delete/head/options
RouteOptions 是对象字面量
schema 引用是顶层 const 或 import，且定义属于 @forgets/schema 静态子集
tags 是字符串字面量数组
summary/description 是字符串字面量
路由数组是顶层 const/export const，或 exported route factory 直接 return group(...)
handler 表达式可以引用参数、闭包、controller，因为静态扫描不解析 handler 语义
```

允许：

```ts
export function usersRoutes(controller: UsersController) {
  return group("/users", [
    route.get("/:id", (ctx) => controller.get(ctx), {
      response: User,
      tags: ["Users"],
    }),
  ]);
}
```

### 10.2 Schema 静态子集

OpenAPI 只从可静态读取的 schema 子集生成。允许：

```ts
export const User = schema.object({
  id: schema.string().uuid(),
  name: schema.string().min(1),
  email: schema.string().email(),
  role: schema.enum(["admin", "member"]),
  tags: schema.array(schema.string()).default([]),
});
```

MVP 静态 schema 子集：

```txt
schema.string/number/boolean/object/array/enum/literal/unknown
optional/nullable/default/min/max/regex/email/uuid
顶层 const schema
从其他文件 import 的命名 schema
object 字段名必须是静态属性名
enum/literal/default 参数必须是字面量或字面量数组
```

不进入 OpenAPI schema 的写法：

```txt
条件表达式生成 schema
函数返回 schema
spread/computed object key
动态 enum 数组
第三方 schema 库直接作为 route body/response
schema.transform/refine/custom 等需要执行用户代码的能力
```

如果 route 可静态发现，但 body/response schema 不可静态读取：

```txt
route 仍进入 routes/manifest
OpenAPI 对应 request/response schema 被省略或降级为 unknown
CLI 输出 warning
--strict-openapi 把该 warning 升级为 error
```

核心诊断 code：

| Code                              | Severity      | 含义                                        |
| --------------------------------- | ------------- | ------------------------------------------- |
| `FORGETS_ROUTE_DYNAMIC_PATH`      | warning/error | route path 不是字符串字面量                 |
| `FORGETS_ROUTE_DYNAMIC_METHOD`    | warning/error | method 不是 `route.get/post/...` 静态调用   |
| `FORGETS_ROUTE_DYNAMIC_OPTIONS`   | warning/error | RouteOptions 不是对象字面量                 |
| `FORGETS_SCHEMA_DYNAMIC_VALUE`    | warning/error | schema 来自条件、函数调用结果或运行时表达式 |
| `FORGETS_SCHEMA_UNSUPPORTED_CALL` | warning/error | schema DSL 调用了 OpenAPI 静态子集外能力    |
| `FORGETS_OPENAPI_SCHEMA_OMITTED`  | warning       | route 存在，但某个 schema 无法生成 OpenAPI  |

### 10.3 不进入静态产物的写法

```txt
动态 path 拼接
动态 method
动态 tags
动态 schema
for/map/filter/reduce 生成路由
运行时文件系统遍历
dynamic import()
app.get(dynamicPath, handler)
```

这些写法可以作为 escape hatch 运行，但 CLI 必须 warning，并排除在 `forgets routes` 和 OpenAPI 之外。

### 10.4 CLI 输出

```bash
forgets routes
```

```txt
GET     /users/:id      usersRoutes[0]
POST    /users          usersRoutes[1]
GET     /healthz        healthRoutes[0]
GET     /readyz         healthRoutes[1]
```

```bash
forgets openapi > openapi.json
```

---

## 11. Context 与响应规则

```ts
export interface CancellationSignal {
  aborted: boolean;
  reason?: unknown;
  onAbort(handler: () => void): void;
}

export interface Context {
  request: RequestView;
  response: ResponseBuilder;

  method: string;
  path: string;

  params: Record<string, string>;
  query: QueryParams;
  headers: HeaderBag;

  state: ContextState;
  signal?: CancellationSignal;

  json<T>(schema?: Schema<T>): Promise<T>;
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;

  status(code: number): ResponseBuilder;
  set(name: string, value: string): void;
}
```

`RequestView`、`HeaderBag` 是 forgets 自己的抽象。不要在第一版承诺完整 Web `Request` / `Headers` 兼容，除非 M0/M1 已经验证 Perry 对这些 API 的语义。

`signal` 也是 forgets 自己的取消抽象。第一版只承诺它能表达“请求已被框架标记为超时/中止”，不承诺底层 IO 被真实取消。只有 M0/M1 证明 Perry 的 Abort/cancellation 语义可用后，才可以把它映射为完整 AbortSignal 行为。

响应规则：

```txt
object/array 自动 JSON 序列化
string 默认 text/plain
Uint8Array 默认 application/octet-stream
ResponseBuilder 显式控制 status/header/body
undefined 返回 204
null 返回 JSON null，除非 ResponseBuilder 指定 204
throw HttpError 走结构化错误响应
throw Error 走 recovery
```

这些规则由 `@forgets/http` wrapper 固定，不继承底层 Perry HTTP primitive 的默认响应语义。

---

## 12. Middleware 与错误处理

### 12.1 Middleware

```ts
export type ResponseValue =
  | undefined
  | null
  | string
  | Uint8Array
  | Record<string, unknown>
  | unknown[]
  | ResponseBuilder;

export type Handler = (ctx: Context) => Promise<ResponseValue> | ResponseValue;
export type Middleware = (next: Handler) => Handler;
```

使用：

```ts
app.use(requestId());
app.use(recovery());
app.use(timeout(30_000));
app.use(accessLog(logger));
```

执行顺序：

```txt
global middleware 按 app.use 顺序包裹
route middleware 在 global middleware 之后、handler 之前执行
recovery 应覆盖后续 middleware 和 handler
accessLog 应在响应归一化后记录 status/duration
```

### 12.2 HttpError

```ts
throw new HttpError(404, "User not found", {
  code: "USER_NOT_FOUND",
});

throw HttpError.notFound("User not found");
throw HttpError.badRequest("Invalid body");
throw HttpError.unauthorized("Unauthorized");
```

默认错误响应：

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

生产环境默认隐藏 stack，开发环境可以显示 stack。

错误处理由 forgets wrapper 保证，不依赖 Fastify `setErrorHandler`、`onError` 或任何插件生命周期。

### 12.3 Timeout

第一版 timeout 语义：

```txt
超过时限返回 504
记录 timeout error
不承诺取消底层 in-flight IO
不承诺 AbortSignal.timeout 真实取消
```

后续只有在 M0/M1 证明 Abort/cancellation 可用后，才升级为可取消语义。

---

## 13. Runtime Driver

第一版 driver：

```txt
@forgets/runtime Fastify-backed native HTTP driver
```

实现策略：

```txt
使用 Perry 官方 Fastify-compatible server path 作为 v1 native HTTP 传输底座。
host-side dependency 当前为 fastify ^5.8.5，避免 Fastify 4.x 的 high-severity audit 风险。
runtime adapter 负责把 inspected routes 映射到 Fastify，并在进入 forgets handler 前捕获 method/path/query/header/body。
Fastify 只承担 listen/socket/request/reply 承接，不承诺插件、hook、route 语义兼容。
raw no-Fastify driver 继续作为实验路径；等 Perry 暴露稳定 no-Fastify raw HTTP server module 后再升级。
如果现有 primitives 不满足 route dispatch/body limit/header/status/concurrency 需求，就在 Perry upstream stdlib/FFI/codegen 层补齐最小 HTTP core。
不把 forgets 私有 Rust wrapper 作为生产路径。
```

但公开契约：

```txt
@forgets/http App
@forgets/http Context
@forgets/http Middleware
@forgets/http ResponseValue
@forgets/http HttpError
```

Driver interface：

```ts
export interface HttpDriver {
  register(route: RuntimeRoute): void;
  listen(port: number, options: ListenOptions): Promise<void>;
}

export interface RuntimeRoute {
  method: HttpMethod;
  path: string;
  handler: Handler;
}
```

driver 适配层必须做：

```txt
把 Perry request 转成 forgets Context
执行 middleware chain
执行 handler
执行 response normalization
把 forgets response 写回 Perry reply
捕获同步 throw 和 async rejection
```

### 13.1 Driver 并发契约

公开并发语义由 forgets 定义，不把 Tokio、Perry HTTP primitive 或内部调度模型暴露给业务代码：

```txt
I/O-bound handler 默认使用 async/await。
独立 I/O 可以用 Promise.all 表达并发等待。
CPU-bound 工作必须显式用 perry/thread spawn/parallelMap 或 native module offload。
每个 request 创建独立 Context、state、request id、timeout state。
middleware 和 handler 不得持有可变全局 request 状态。
driver 必须记录 in-flight request，并为后续 maxConcurrentRequests/requestQueueLimit 留接口。
timeout v1 只切断 response boundary，不宣称取消底层 I/O。
```

推荐 handler 形态：

```ts
app.get("/users/:id", getUser);

async function getUser(ctx: Context) {
  const [user, orders] = await Promise.all([
    users.find(ctx.params.id),
    orders.list(ctx.params.id),
  ]);

  return { user, orders };
}
```

CPU-bound handler 必须显式表达：

```ts
import { spawn } from "perry/thread";

async function makeReport(ctx: Context) {
  const input = await ctx.json();
  const result = await spawn(() => buildLargeReport(input));
  return result;
}
```

不要把这些语义暴露成 Fastify hooks。forgets driver 必须自己拥有 hook、error、bodyLimit、close、backpressure 和 response boundary 语义，并用 native behavior suite 固化。

---

## 14. 构建与开发流程

### 14.0 Workspace Tooling

`forgets` 可以默认使用 Vite+ 生成和维护工作区，但 native 构建事实必须独立于 Vite+：

```txt
Vite+ 负责 scaffold、check/test/pack 和 workspace task 编排。
forgets compiler 负责 .forgets/perry-entry.generated.ts 和静态产物。
Perry 负责 perry check / perry compile / native binary。
Rust/Cargo 只在审阅/修改 Perry 源码、stdlib、FFI 或 native module 时进入验证路径。
```

推荐命令分层：

```txt
vp check              host-side format/lint/type checks
vp test               host-side Vitest tests
vp pack               TS library/CLI artifact packaging
vp run m0             Perry compatibility script wrapper
vp run build:native   forgets build -> Perry compile wrapper
```

约束：

```txt
vp build 是 Vite application production build，不是 forgets native server build。
native server build 必须走 forgets build -> perry compile。
CI 可以用 Vite+ 编排，但 release gate 必须看 Perry/native smoke 结果；只有触碰 Perry 源码、stdlib、FFI 或 native module 时，Cargo 才成为 gate。
没有 Vite+ 的环境必须仍能通过 npm/perry 命令复现核心任务；触碰 Perry 源码或 native module 的任务再额外要求 cargo。
```

### 14.1 Build

Perry `compile` 需要单个入口。因此：

```txt
src/server.ts exports buildServer()
  ↓
forgets check
  ↓
scan static route definitions
  ↓
generate .forgets/routes.generated.ts
  ↓
generate .forgets/openapi.generated.json
  ↓
generate .forgets/manifest.generated.json
  ↓
generate .forgets/diagnostics.generated.json
  ↓
generate .forgets/perry-entry.generated.ts
  ↓
perry check .forgets/perry-entry.generated.ts
  ↓
perry compile .forgets/perry-entry.generated.ts -o dist/server
  ↓
dist/server
```

`.forgets/perry-entry.generated.ts` 只做三件事：

```txt
导入用户 buildServer
导入 forgets runtime wrapper 和生成产物
调用 buildServer()
调用 app.listen(config.PORT)
```

`src/server.ts` 是 framework build contract，必须无顶层 listen 副作用。`src/main.ts` 可以存在，但只能是本地开发入口或用户手动启动入口；compiler 不把它当作 native build 的事实来源。

成功标准：

```txt
forgets 静态规则通过
diagnostics 无 error 级别问题
perry check generated entry 通过
perry compile generated entry 通过
native smoke test 必须启动并访问 healthz
native HTTP behavior tests 必须覆盖 v1 承诺的生产语义
```

v1 发布阻断项：

```txt
undefined -> 204 native 行为不通过，阻断发布
null -> JSON null native 行为不通过，阻断发布
throw HttpError -> structured error native 行为不通过，阻断发布
throw Error / async rejection -> recovery native 行为不通过，阻断发布
bodyLimit native 行为不通过，阻断发布
request id/access log native 行为不通过，阻断发布
timeout response native 行为不通过，阻断发布
routes/openapi/manifest/diagnostics JSON schema 校验不通过，阻断发布
```

### 14.2 Dev

```bash
forgets dev
```

要求：

```txt
使用同一套 route/schema/config 入口
围绕 .forgets/perry-entry.generated.ts 生成和启动
尽量复用或贴近 Perry dev/watch/recompile/relaunch
watch 后重建 .forgets 构建产物
禁止 dev-only API 泄漏到生产代码
```

Node/Bun simulator 可以存在，但只作为辅助测试手段，不作为主语义来源。

---

## 15. 推荐项目结构

```txt
my-api/
  src/
    server.ts
    main.ts
    app.ts

    users/
      users.controller.ts
      users.service.ts
      users.repository.ts
      users.schema.ts
      users.routes.ts

    health/
      health.controller.ts
      health.routes.ts

    infra/
      db.ts
      logger.ts
      config.ts

  .forgets/
    routes.generated.ts
    openapi.generated.json
    manifest.generated.json
    diagnostics.generated.json
    perry-entry.generated.ts

  forgets.config.ts
  package.json
```

`src/users/users.routes.ts`：

```ts
import { group, route } from "@forgets/http";
import { CreateUser, User } from "./users.schema";
import type { UsersController } from "./users.controller";

export function usersRoutes(controller: UsersController) {
  return group("/users", [
    route.get("/:id", (ctx) => controller.get(ctx), {
      response: User,
      tags: ["Users"],
    }),
    route.post("/", (ctx) => controller.create(ctx), {
      body: CreateUser,
      response: User,
      tags: ["Users"],
    }),
  ]);
}
```

`src/app.ts`：

```ts
import { createApp } from "@forgets/http";
import { accessLog, recovery, requestId, timeout } from "@forgets/middleware";
import { usersRoutes } from "./users/users.routes";
import { healthRoutes } from "./health/health.routes";

export function buildApp(deps: AppDeps) {
  const app = createApp();

  app.use(requestId());
  app.use(recovery());
  app.use(timeout(30_000));
  app.use(accessLog(deps.logger));

  app.routes([
    healthRoutes(deps.healthController),
    usersRoutes(deps.usersController),
  ]);

  return app;
}
```

`src/server.ts`：

```ts
import { loadConfig } from "@forgets/config";
import { buildApp } from "./app";
import { Config } from "./infra/config";
import { buildDeps } from "./infra/deps";

export async function buildServer() {
  const config = loadConfig(Config);
  const deps = await buildDeps(config);
  const app = buildApp(deps);

  return { app, config };
}
```

`src/main.ts` 是可选本地启动器，不是 compiler 入口契约：

```ts
import { buildServer } from "./server";

const { app, config } = await buildServer();

await app.listen(config.PORT);
```

---

## 16. 生产级能力清单

第一版最小生产能力：

```txt
HTTP router
JSON body parser
body size limit
schema validation
response normalization
structured error
structured logger
request id
access log
recovery
timeout response
healthz
readyz
config/env validation
OpenAPI generation
route inspect
human-readable diagnostics
machine-readable diagnostics
AI context export
Perry compatibility check
native build
native smoke test
```

验证项，不作为第一版默认承诺：

```txt
true graceful shutdown
true request cancellation
底层 Perry HTTP close/shutdown compatibility
底层 Perry HTTP connection draining compatibility
full Web Request/Headers compatibility
```

---

## 17. MVP 路线

M0-M6 是 foundation implementation milestones，不是单个发布包。公开版本必须按 v0.1-v1.0 节奏切分，只有当前 release 范围内的 native tests 通过后才允许声明生产能力。

### M0：Perry 能力验证

产物：

```txt
docs/perry-compat.md
test-files/forgets-m0/*.ts
scripts/forgets-m0.ps1
```

必须验证：

```txt
decorators rejected
class/private fields/methods
async/await/Promise
Map/Set
JSON parse/stringify
process.env
timer
Uint8Array/TextEncoder/TextDecoder
Promise.all / async I/O concurrency baseline
perry/thread spawn baseline
perry/thread parallelMap baseline
AbortController.abort
AbortSignal.timeout
dynamic import unsupported behavior
perry check single generated entry
perry compile single generated entry
first-party native HTTP params/query/headers/body
first-party native HTTP status/header/response body
first-party native HTTP undefined/null baseline
first-party native HTTP throw/rejection baseline
first-party native HTTP bodyLimit baseline
first-party native HTTP concurrent requests baseline
process.on signal/graceful shutdown baseline
```

通过标准：

```txt
每个能力有独立样例
每个样例记录 check/compile/run 结果
不稳定能力进入 docs/perry-compat.md 风险区
```

### M1：最小 HTTP App

代码目标：

```ts
const app = createApp();

app.get("/ping", () => ({ message: "pong" }));

await app.listen(3000);
```

必须支持：

```txt
GET
POST
path params
query
JSON body
JSON response
status code
headers
undefined -> 204
throw HttpError
throw Error recovery
concurrent requests do not share Context/state
I/O-bound async handler does not block unrelated request acceptance
CPU-bound handler behavior is documented and offload path is tested
```

M1 不能只通过 host unit tests。以上行为必须在 Perry native 二进制中验证，尤其是 undefined/null、throw/rejection、headers/status/body 顺序。

当前 M1 状态：

```txt
host-side HTTP/kernel tests 已覆盖 Fastify-backed driver 的 inject route dispatch 与 404 normalization。
Fastify-backed native HTTP smoke 已通过：perry check、perry compile、native run、GET /healthz、POST /echo 全部 passed。
raw no-Fastify path 的阻塞点仍是 Perry direct js_http_* ABI/codegen 与 upstream raw server API 暴露，而不是 forgets 业务层。
官方 examples 可作为普通 Node 框架兼容性参考；Fastify path 可作为 v1 传输底座，但不能替代 forgets 行为套件。
```

### M2：RouteDefinition 与静态扫描

代码目标：

```ts
export function usersRoutes(controller: UsersController) {
  return group("/users", [
    route.get("/:id", (ctx) => controller.get(ctx), {
      response: User,
      tags: ["Users"],
    }),
  ]);
}
```

必须支持：

```txt
route.get/post/put/patch/delete/head/options
group
app.routes
duplicate route check
static route inspect
dynamic route warning
AST scanner，不允许 regex scanner
```

### M3：Schema 与 OpenAPI

代码目标：

```ts
const CreateUser = schema.object({
  name: schema.string().min(1),
});

route.post(
  "/",
  async (ctx) => {
    const input = await ctx.json(CreateUser);
    return input;
  },
  {
    body: CreateUser,
    response: CreateUser,
  },
);
```

必须支持：

```txt
parse/safeParse
object/string/number/boolean/array
optional/default/enum/literal/unknown
error formatting
OpenAPI emit
config/env validation
```

### M4：生产中间件与观测

必须支持：

```txt
request id
recovery
timeout response
body size limit
access log
structured logger
default error response
healthz
readyz
```

### M5：Native Build

命令：

```bash
forgets build --release
```

输出：

```txt
dist/server
```

验证：

```bash
./dist/server
curl localhost:3000/healthz
```

M5 验收必须运行完整 native HTTP behavior suite：

```txt
healthz/readyz
path params/query/header/body
JSON response/status/header
undefined -> 204
null -> JSON null
HttpError structured response
unexpected Error recovery
async rejection recovery
body limit
request id/access log
timeout response
```

### M6：人体工程学与 AI 友好工具面

必须支持：

```txt
diagnostic code
human-readable diagnostic output
JSON diagnostic output
forgets routes --json
forgets check --json
forgets doctor --json
forgets ai-context --json
.forgets/manifest.generated.json
.forgets/diagnostics.generated.json
docs/schemas/manifest.schema.json
docs/schemas/diagnostics.schema.json
docs/schemas/ai-context.schema.json
```

通过标准：

```txt
同一个错误既能被人快速理解，也能被 AI/工具稳定引用
manifest 不包含 secret 值
AI context 能解释 route graph、schema names、config keys、Perry compatibility status
```

---

## 18. 数据库策略

不要一上来做 ORM。

阶段一：

```txt
用户自带 DB client
框架只负责 config/logger/error/http
```

阶段二：

```txt
提供极薄 SQL interface
优先 SQLite
其次 PostgreSQL
然后 MySQL
```

阶段三：

```txt
轻量 migration
typed client generation
```

数据库驱动必须单独经过 Perry native compile/run 验证，不能只因 Perry stdlib 有路径就宣布生产可用。

---

## 19. 和现有框架的对比

| 项目        | 重点                         | forgets 的取舍                                   |
| ----------- | ---------------------------- | ------------------------------------------------ |
| NestJS      | DI/Module/decorator 企业框架 | 不借鉴 decorator，不兼容 DI/Module               |
| Express     | 极简 Node HTTP               | 我们要 native build、schema、生产工具链          |
| Fastify     | 高性能 Node HTTP             | v1 作为 Perry-native 传输底座；不暴露插件/hook 契约 |
| Hono        | 轻量 handler 思想            | 借鉴 Context/Handler，不追求多 runtime           |
| Go net/http | 显式、稳定、部署简单         | 借鉴显式组合和生产部署形态                       |
| Vite+       | 统一 JS/TS 工具链和脚手架    | 作为工作台候选，不决定 runtime/native build 语义 |
| PerryTS     | TS -> native compiler        | 作为最终编译目标和能力边界                       |

---

## 20. README 核心文案

````md
# forgets

A native-first TypeScript backend framework for high-performance production services on Perry.

forgets rejects decorators, reflection-based dependency injection, module containers, and hidden lifecycle rules. Routes are explicit values. Dependencies are ordinary constructors. Runtime boundaries are schema-defined.

```ts
const users = new UsersService(new UsersRepository(db));
const controller = new UsersController(users);

const routes = group("/users", [
  route.get("/:id", (ctx) => controller.get(ctx)),
  route.post("/", (ctx) => controller.create(ctx), { body: CreateUser }),
]);

const app = createApp();
app.routes(routes);
app.listen(3000);
```

Explicit routes. Explicit dependencies. Native production first.
````

---

## 21. 最终判断

`forgets` 的关键不是模仿现有 Node 框架，而是在 Perry 当前能力边界内建立一个可编译、可检查、可部署的后端框架。

最终形态：

```txt
显式路由
显式依赖
schema 边界
静态检查
native binary
生产可观测
长期稳定运行
```

这条路线牺牲了一些表面 DX，但换来的是：

```txt
更少运行时黑箱
更强构建确定性
更清晰生产边界
更符合 Perry single-entry native compile 模型
```
