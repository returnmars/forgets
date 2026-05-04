# forgets Server 设计方案

> `forgets` 是一个面向 PerryTS/native TypeScript 的生产级后端服务框架。它废弃 Router Decorator，拒绝 DI/Module/Provider/reflect-metadata 等运行时魔法，采用显式路由、显式依赖、Schema-first 和 Perry-compatible 构建链路。

核心哲学：

> **路由显式注册，依赖显式组合。**

英文表述：

> **Explicit routes. Explicit dependencies. Native production first.**

---

## 0. 项目一句话

**forgets 是一个 native-first TypeScript 后端服务框架，目标是在 PerryTS 上构建高性能、稳定、可生产部署的单体二进制服务。**

它不再追求 NestJS 风格的 Router Decorator。Perry 当前主线会拒绝 TypeScript decorators，且没有 `Reflect` / `reflect-metadata` / runtime type metadata，因此装饰器路线正式废弃。

目标是：

> **Go-like explicit backend framework for native TypeScript production services.**

---

## 1. 设计优先级

优先级只有三个，按顺序排列：

```txt
性能
稳定性
生产环境
```

这意味着：

```txt
优先选择 Perry 已支持、可静态分析、可 AOT 编译的能力
优先保持路由、依赖、生命周期、错误边界可见
优先产出能长期运行、可观测、可部署、可回滚的服务
```

不为了表面 DX 牺牲 native 编译确定性。

---

## 2. Perry 源码调研后的硬约束

基于 Perry 当前源码和文档，forgets 必须承认这些事实：

```txt
TypeScript decorators 不支持，class/method/property/parameter decorators 会被 lowering 阶段拒绝
Reflect API 不支持
reflect-metadata 不存在
类型在编译期擦除，没有运行时 design:type/design:paramtypes
动态 import() 不可作为生产能力
Perry compile 入口是单个 .ts 文件，不是项目目录
perry check 是兼容性检查，不等价于完整业务语义检查
Fastify/fetch/ws/pg/mysql2/better-sqlite3 等有 Perry 原生 stdlib 路径
process.env、fs、JSON、Promise、async/await、timer、TextEncoder/TextDecoder、Uint8Array 等基础能力可作为 M0 验证项
进程信号与 AbortSignal 不是一回事，graceful shutdown 要单独验证
```

所以框架必须从一开始就走：

```txt
显式路由值 API
静态路由表
构建期检查
Perry-compatible runtime subset
native binary deployment
```

---

## 3. 明确不做什么

这些不是后续版本再考虑，而是项目边界：

```txt
不做 Router Decorator
不做 @Controller
不做 @Get/@Post/@Put/@Patch/@Delete
不做 @Injectable
不做 @Inject
不做 @Module
不做 Provider Token
不做 imports/exports 模块系统
不做 reflect-metadata
不做运行时参数注入
不做基于 constructor parameter reflection 的 DI
不做 class-validator/class-transformer 强绑定
不承诺兼容 NestJS 插件
不承诺兼容全部 npm 生态
不依赖 dynamic import() 做路由发现
```

原因很简单：这些能力要么 Perry 当前不支持，要么会把服务框架重新带回运行时黑箱。

---

## 4. 最终开发体验

目标写法应该是这样：

```ts
import {
  createApp,
  group,
  route,
  HttpError,
  type Context,
} from "@forgets/http";

import { schema } from "@forgets/schema";
import { loadConfig } from "@forgets/config";
import { accessLog, createLogger } from "@forgets/logger";

const Config = schema.object({
  PORT: schema.number().default(3000),
  DATABASE_URL: schema.string(),
  LOG_LEVEL: schema.enum(["debug", "info", "warn", "error"]).default("info"),
});

const CreateUser = schema.object({
  name: schema.string().min(1),
  email: schema.string().email(),
});

type CreateUser = schema.Infer<typeof CreateUser>;

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

const config = loadConfig(Config);
const logger = createLogger({ level: config.LOG_LEVEL });

const db = new Database(config.DATABASE_URL);
const usersRepo = new UsersRepository(db);
const usersService = new UsersService(usersRepo);
const usersController = new UsersController(usersService);

const usersRoutes = group("/users", [
  route.get("/:id", ctx => usersController.get(ctx), {
    response: schema.unknown(),
    summary: "Get user by id",
    tags: ["Users"],
  }),
  route.post("/", ctx => usersController.create(ctx), {
    body: CreateUser,
    response: schema.unknown(),
    summary: "Create user",
    tags: ["Users"],
  }),
]);

const app = createApp();

app.use(requestId());
app.use(recovery());
app.use(timeout(30_000));
app.use(accessLog(logger));

app.routes(usersRoutes);

await app.listen(config.PORT);
```

这个例子里：

```txt
依赖怎么创建：看得见
路由怎么注册：看得见
handler 绑定到哪个实例：看得见
请求数据从哪里来：看得见
schema 在哪里生效：看得见
OpenAPI 信息来自哪里：看得见
```

没有 decorator。

没有 DI 容器。

没有 Module。

没有 Provider。

没有黑箱。

---

## 5. 核心设计原则

### 原则一：路由必须是显式值

第一版主路径只允许这种：

```ts
const routes = group("/users", [
  route.get("/:id", ctx => usersController.get(ctx)),
  route.post("/", ctx => usersController.create(ctx)),
]);

app.routes(routes);
```

路由定义本身是普通 TypeScript value，而不是 decorator metadata。

这样做的好处：

```txt
Perry 可以编译
工具链可以静态扫描
route inspect 不依赖运行时
OpenAPI 生成不依赖反射
重复路由检查可以在 build 前失败
handler 绑定明确
```

### 原则二：依赖全部手动组合

用户自己写 composition root：

```ts
const db = new Database(config.DATABASE_URL);
const repo = new UsersRepository(db);
const service = new UsersService(repo);
const controller = new UsersController(service);
```

这几行不是样板代码，而是生产服务里最重要的启动逻辑。

收益：

```txt
启动顺序明确
生命周期明确
测试容易
mock 容易
没有容器查找开销
没有 token 解析
没有循环依赖黑洞
```

### 原则三：Context 优先，不做参数注入

不做：

```ts
function get(id: string, body: CreateUser) {}
```

主路径只做：

```ts
async function get(ctx: Context) {
  const id = ctx.params.id;
  const input = await ctx.json(CreateUser);
}
```

原因：

```txt
参数来源清楚
实现简单
AOT 友好
调试简单
和 Go handler 思想一致
```

### 原则四：Schema 是运行时边界

TypeScript 类型会被擦除。所有外部输入输出都必须用 schema 描述：

```ts
const CreateUser = schema.object({
  name: schema.string().min(1),
  email: schema.string().email(),
});

type CreateUser = schema.Infer<typeof CreateUser>;
```

schema 负责：

```txt
config/env 校验
request params 校验
query 校验
JSON body 校验
response 描述
OpenAPI 生成
错误格式
测试 mock
```

### 原则五：生产行为优先于开发期方便

forgets 不能出现这种情况：

```txt
dev 模式能跑
native build 失败
生产行为和开发行为不一致
```

因此：

```txt
forgets check 必须早发现 Perry 不兼容能力
forgets dev 默认应尽量贴近 Perry runtime
Node/Bun simulator 只能作为辅助，不作为生产语义来源
所有稳定 API 都要能被 Perry compile 验证
```

---

## 6. 路由 API 设计

### 基础 API

```ts
app.route("GET", "/users/:id", ctx => usersController.get(ctx));
app.get("/healthz", () => ({ ok: true }));
```

### 推荐 API

```ts
const healthRoutes = group("", [
  route.get("/healthz", healthController.health),
  route.get("/readyz", healthController.ready),
]);

const userRoutes = group("/users", [
  route.get("/:id", ctx => usersController.get(ctx)),
  route.post("/", ctx => usersController.create(ctx)),
]);

app.routes([healthRoutes, userRoutes]);
```

### RouteDefinition

```ts
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: Handler;
  options?: RouteOptions;
}

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

### 静态路由约束

为了支持 `forgets routes` 和 `forgets openapi`，推荐路由必须满足：

```txt
route path 是字符串字面量
HTTP method 是静态值
RouteOptions 中的 schema 是可引用的顶层常量
路由数组是顶层 const/export const
不依赖 dynamic import()
不依赖运行时遍历文件系统发现路由
```

动态注册可以存在，但属于 escape hatch：

```ts
app.get(dynamicPath, handler);
```

动态路由不进入 OpenAPI，不保证出现在静态 route inspect 中。

---

## 7. Context 设计

```ts
export interface Context {
  request: Request;
  response: ResponseBuilder;

  method: string;
  path: string;

  params: Record<string, string>;
  query: QueryParams;
  headers: Headers;

  state: ContextState;
  signal: AbortSignal;

  json<T>(schema?: Schema<T>): Promise<T>;
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;

  status(code: number): ResponseBuilder;
  set(name: string, value: string): void;
}
```

返回值规则：

```txt
object/array 自动 JSON 序列化
string 默认 text/plain
ResponseBuilder 显式控制 status/header/body
undefined 返回 204
throw HttpError 走结构化错误响应
throw Error 走 recovery
```

---

## 8. Middleware 设计

middleware 必须显式组合：

```ts
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

路由级 middleware 放在 `RouteOptions`：

```ts
route.get("/admin", adminController.index, {
  middleware: [auth(), requireRole("admin")],
});
```

不做 `@Use()`。

---

## 9. 错误处理

内置 `HttpError`：

```ts
throw new HttpError(404, "User not found", {
  code: "USER_NOT_FOUND",
});
```

快捷方法：

```ts
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

生产环境默认隐藏 stack。

开发环境可以显示 stack。

---

## 10. 包结构设计

建议 monorepo：

```txt
packages/
  http/
  schema/
  config/
  logger/
  cli/
  compiler/
  runtime/
  testing/
examples/
  hello-world/
  rest-api/
  sqlite-api/
  postgres-api/
  auth-api/
```

### `@forgets/http`

负责 HTTP 应用模型：

```ts
createApp()
route
routes()
group()
Context
HttpError
Middleware
Response helpers
```

底层统一抽象：

```ts
export interface Handler {
  (ctx: Context): unknown | Promise<unknown>;
}

export interface Middleware {
  (next: Handler): Handler;
}
```

### `@forgets/schema`

做轻量 schema，不直接绑定 Zod。

原因：

```txt
Perry 不支持 Reflect/metadata
部分 npm 包可能依赖 Proxy、Symbol、Object descriptor 等能力
自研小 schema 更容易保持 native-compatible
```

MVP 支持：

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
error formatting
Infer<T>
OpenAPI schema emit
```

后续再考虑：

```txt
union
transform
refine async
custom error map
typed client generation
```

### `@forgets/config`

不要模块系统，直接：

```ts
const Config = schema.object({
  PORT: schema.number().default(3000),
  DATABASE_URL: schema.string(),
  LOG_LEVEL: schema.enum(["debug", "info", "warn", "error"]).default("info"),
});

const config = loadConfig(Config);
```

支持：

```txt
env
.env
默认值
类型转换
启动时校验
错误信息打印
```

### `@forgets/logger`

内置结构化日志：

```ts
const logger = createLogger({
  level: config.LOG_LEVEL,
});

logger.info("server started", {
  port: config.PORT,
});
```

输出 JSON：

```json
{
  "level": "info",
  "time": "2026-05-04T12:00:00.000Z",
  "msg": "server started",
  "port": 3000
}
```

### `@forgets/runtime`

短期目标不是重写 HTTP core，而是封装 Perry 已有 native HTTP 能力。

第一版推荐：

```txt
使用 Perry native fastify stdlib 作为底层 driver
forgets 暴露自己的 API，不暴露 Fastify 兼容承诺
后续如果需要更强性能/控制，再迁移到自有 Rust/Perry HTTP core
```

### `@forgets/cli`

命令：

```bash
forgets new my-api
forgets dev
forgets check
forgets routes
forgets openapi
forgets build
```

解释：

```txt
forgets dev       开发期 watch/rebuild/run，尽量贴近 Perry runtime
forgets check     forgets 规则检查 + Perry compatibility check
forgets routes    打印静态路由表
forgets openapi   生成 OpenAPI
forgets build     生成 .forgets 构建产物并调用 perry compile
```

---

## 11. Route Inspect 与 OpenAPI

路由表必须可见。

```bash
forgets routes
```

输出：

```txt
GET     /users/:id      usersRoutes[0]
POST    /users          usersRoutes[1]
GET     /healthz        healthRoutes[0]
GET     /readyz         healthRoutes[1]
```

OpenAPI 信息来自 `RouteOptions`：

```ts
route.post("/", ctx => usersController.create(ctx), {
  body: CreateUser,
  response: User,
  summary: "Create user",
  tags: ["Users"],
});
```

命令：

```bash
forgets openapi > openapi.json
```

---

## 12. Native 构建流程

Perry `compile` 需要单个入口 `.ts` 文件。因此 forgets build 负责生成 Perry 入口。

```txt
src/main.ts
  ↓
forgets check
  ↓
scan static route definitions
  ↓
generate .forgets/routes.generated.ts
  ↓
generate .forgets/openapi.generated.json
  ↓
generate .forgets/perry-entry.generated.ts
  ↓
perry check .forgets/perry-entry.generated.ts
  ↓
perry compile .forgets/perry-entry.generated.ts -o dist/server
  ↓
dist/server
```

命令：

```bash
forgets build --target linux-x64 --release
```

部署：

```bash
scp dist/server root@host:/app/server
ssh root@host "systemctl restart forgets-server"
```

---

## 13. 开发模式

### 默认 dev 模式

```bash
forgets dev
```

要求：

```txt
使用同一套 route/schema/config 入口
尽量复用 Perry dev/compile 行为
watch 后重建 .forgets 构建产物
禁止 dev-only API 泄漏到生产代码
```

### Node/Bun simulator

可以作为辅助测试手段，但不作为主语义来源。

原因：

```txt
Node/Bun 支持的动态能力比 Perry 多
过度依赖 simulator 会制造 dev/prod drift
生产目标是 Perry native binary
```

---

## 14. 推荐项目结构

```txt
my-api/
  src/
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
    perry-entry.generated.ts

  forgets.config.ts
  package.json
```

### `src/users/users.routes.ts`

```ts
import { group, route } from "@forgets/http";
import { CreateUser, User } from "./users.schema";
import type { UsersController } from "./users.controller";

export function usersRoutes(controller: UsersController) {
  return group("/users", [
    route.get("/:id", ctx => controller.get(ctx), {
      response: User,
      tags: ["Users"],
    }),
    route.post("/", ctx => controller.create(ctx), {
      body: CreateUser,
      response: User,
      tags: ["Users"],
    }),
  ]);
}
```

### `src/app.ts`

```ts
import { createApp } from "@forgets/http";
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

### `src/main.ts`

```ts
import { loadConfig } from "@forgets/config";
import { buildApp } from "./app";
import { Config } from "./infra/config";

const config = loadConfig(Config);
const deps = await buildDeps(config);
const app = buildApp(deps);

await app.listen(config.PORT);
```

---

## 15. 生产级能力清单

第一版生产级最小能力：

```txt
HTTP router
JSON body parser
schema validation
structured error
structured logger
request id
access log
recovery
timeout
graceful shutdown
healthz
readyz
config/env validation
OpenAPI generation
route inspect
Perry compatibility check
native build
```

第二版：

```txt
CORS
cookie
JWT helper
rate limit
metrics
tracing
static file
multipart
SQLite
Postgres
migration
typed client generation
```

第三版：

```txt
WebSocket
SSE
message queue
cron
background worker
RPC
plugin system
```

---

## 16. MVP 里程碑

### M0：Perry 能力验证

目标：写 `docs/perry-compat.md`，固定 Perry 版本和实际测试结果。

必须验证：

```txt
class
private fields/methods
async/await
Promise
Map/Set
JSON parse/stringify
fetch
Perry native fastify server
fs
process.env
timer
AbortSignal
进程信号/graceful shutdown
Uint8Array
TextEncoder/TextDecoder
Perry check
Perry compile single entry
```

明确记录不可用能力：

```txt
decorators
Reflect
reflect-metadata
dynamic import()
Object descriptor/prototype mutation
Node-only API
```

### M1：最小 HTTP app

代码：

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
```

### M2：显式 RouteDefinition

代码：

```ts
const routes = group("/users", [
  route.get("/:id", ctx => ({ id: ctx.params.id })),
]);

app.routes(routes);
```

必须支持：

```txt
route.get
route.post
route.put
route.patch
route.delete
route.head
route.options
group
app.routes
forgets routes
duplicate route check
```

### M3：Schema

代码：

```ts
const CreateUser = schema.object({
  name: schema.string(),
});

route.post("/", async ctx => {
  const input = await ctx.json(CreateUser);
  return input;
}, {
  body: CreateUser,
});
```

必须支持：

```txt
object
string
number
boolean
array
optional
default
enum
error formatting
OpenAPI emit
```

### M4：生产中间件与错误

必须支持：

```txt
request id
recovery
timeout
access log
structured logger
HttpError
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

---

## 17. 数据库策略

不要一上来做 ORM。

Perry/native 生态下，数据库驱动是高风险部分。推荐三阶段：

### 阶段一：用户自带 DB client

框架不管 DB：

```ts
const db = new Database(config.DATABASE_URL);
const usersRepo = new UsersRepository(db);
```

### 阶段二：提供 SQL interface

```ts
const rows = await db.query<UserRow>(
  "select id, name from users where id = ?",
  [id],
);
```

### 阶段三：提供轻量 migration

```ts
export default migration("001_create_users", async db => {
  await db.sql(`
    create table users (
      id text primary key,
      name text not null,
      email text not null
    )
  `);
});
```

优先顺序：

```txt
SQLite
PostgreSQL
MySQL
```

---

## 18. 和现有框架的对比

| 项目 | 重点 | forgets 的取舍 |
| --- | --- | --- |
| NestJS | 企业级 Node 框架，DI/Module/decorator 很强 | 不借鉴 decorator，不兼容 DI/Module |
| Express | 极简 Node HTTP | 我们要 native build、schema、生产工具链 |
| Fastify | 高性能 Node HTTP | 第一版可借 Perry native fastify driver，但不承诺 Fastify 插件兼容 |
| Hono | 轻量 Web 标准 API | 借鉴轻量 handler 思想，不追求多 runtime |
| Go net/http | 显式、稳定、部署简单 | 借鉴显式组合和生产部署形态 |
| PerryTS | TS -> native compiler | 作为最终编译目标和能力边界 |

---

## 19. README 核心文案

````md
# forgets

A native-first TypeScript backend framework for high-performance production services on Perry.

forgets rejects decorators, reflection, dependency injection containers, and hidden lifecycle rules. Routes are explicit values. Dependencies are ordinary constructors. Runtime boundaries are schema-defined.

```ts
const users = new UsersService(new UsersRepository(db));
const controller = new UsersController(users);

const routes = group("/users", [
  route.get("/:id", ctx => controller.get(ctx)),
  route.post("/", ctx => controller.create(ctx), { body: CreateUser }),
]);

const app = createApp();
app.routes(routes);
app.listen(3000);
```

Explicit routes. Explicit dependencies. Native production first.
````

---

## 20. 和 AI 继续讨论时，可以直接丢这个 Prompt

```txt
我想设计一个基于 PerryTS/native TypeScript 的生产级后端服务框架，项目名叫 forgets。

核心理念：
1. 完全废弃 Router Decorator，不做 @Controller/@Get/@Post。
2. 不做 DI 容器、Module、Provider、Inject、Injectable、reflect-metadata。
3. 依赖全部由用户显式 new 和组合。
4. 路由使用显式 RouteDefinition value API，例如 group("/users", [route.get("/:id", handler)])。
5. Handler 统一接受 Context，不做参数注入。
6. Schema-first，所有 request body/query/params/config/response 都用 schema 显式描述。
7. 支持 OpenAPI 生成、route inspect、Perry compatibility check、native single binary build。
8. 构建期生成 .forgets/perry-entry.generated.ts，再调用 perry compile 单文件入口。
9. 核心优先级是性能、稳定性、生产环境。
10. 目标不是兼容 NestJS/Fastify 插件生态，而是在 Perry 能力边界内做显式、稳定、可部署的后端框架。

请帮我从以下角度评审并完善：
- RouteDefinition API 是否足够简洁？
- 如何约束静态路由以支持 route inspect 和 OpenAPI？
- Context 设计是否合理？
- Schema 系统应该如何保持 Perry-compatible？
- runtime driver 应先封装 Perry native fastify，还是直接写 Rust/Perry HTTP core？
- 如何设计 middleware、error handling、graceful shutdown、observability？
- MVP 应该如何拆分？
- 哪些设计会损害性能、稳定性或生产环境确定性？
- 哪些地方会和 PerryTS 当前能力冲突？
```

---

## 21. 最终判断

forgets 不再追求 NestJS 的表面写法。

真正要的是：

```txt
显式路由
显式依赖
schema 边界
静态检查
native binary
生产可观测
长期稳定运行
```

最终形态应该是：

```ts
const app = createApp();

app.use(requestId());
app.use(recovery());
app.use(timeout(30_000));
app.use(accessLog(logger));

app.routes([
  healthRoutes(healthController),
  usersRoutes(
    new UsersController(
      new UsersService(
        new UsersRepository(db),
      ),
    ),
  ),
]);

await app.listen(config.PORT);
```

这就是：

```txt
TypeScript 的表达力
Go 式显式组合
PerryTS 的部署形态
生产环境优先的工程取舍
```

这个方向比“Native NestJS”更小、更硬、更符合 Perry 当前能力边界，也更可能做成真正可生产部署的框架。
