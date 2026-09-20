## 概述
Envoy Gateway 是一种基于 Kubernetes 的 API 网关和反向代理控制平面。它通过使用标准的网关 API 以及自己扩展性的 API，简化了 Envoy Proxy 作为数据平面的部署与运行过程。
实际上，Gateway API 提供了一个标准的接口。而 Envoy Gateway 则在此基础上增加了高级功能，从而填补了简单性与强大功能之间的空白，同时所有操作都遵循了 Kubernetes 的规范。
Gateway API 的一个主要优势在于，开发者可以对其进行扩展。虽然该 API 为标准的路由和流量控制需求提供了基础，但它也允许开发者引入自定义资源以满足特定的应用场景需求。
Envoy Gateway 通过引入一系列 Gateway API 扩展来实现这一模型——这些扩展以 Kubernetes 自定义资源定义（CRD）的形式实现。这些扩展提供了丰富的功能，包括更强的速率限制、身份验证、流量整形等功能。通过使用这些扩展，用户可以以 Kubernetes 原生且声明式的方式访问高级功能，而无需编写复杂的 Envoy 配置。


*架构图*
![[Pasted image 20260920092718.png]]

*组件*
EnvoyProxy：负责管理 Kubernetes 集群中 Envoy 代理的部署与配置，以及其生命周期和设置的维护。
EnvoyPatchPolicy、ClientTrafficPolicy、SecurityPolicy、BackendTrafficPolicy、EnvoyExtensionPolicy、BackendTLSPolicy：这些是专门针对 Envoy Gateway 的额外策略与配置。
**Backend**：这是一个能够简化对集群外部后端资源的路由操作，并使得通过 Unix 域套接字访问外部进程的资源。

| Resource                                                                                                                                                                                                                                                                                                                                                                                                      | API         | Required | Purpose            | References              | Description                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GatewayClass](https://gateway-api.sigs.k8s.io/reference/api-types/gatewayclass/)                                                                                                                                                                                                                                                                                                                             | Gateway API | Yes      | Gateway Config     | Core                    | Defines a class of Gateways with common configuration.                                                                                                                                       |
| [Gateway](https://gateway-api.sigs.k8s.io/reference/api-types/gateway/)                                                                                                                                                                                                                                                                                                                                       | Gateway API | Yes      | Gateway Config     | GatewayClass            | 规定流量如何进群                                                                                                                                                                                     |
| [HTTPRoute](https://gateway-api.sigs.k8s.io/reference/api-types/httproute/) [GRPCRoute](https://gateway-api.sigs.k8s.io/reference/api-types/grpcroute/) [TLSRoute](https://gateway-api.sigs.k8s.io/reference/api-spec/1.4/spec/#tlsroute) [TCPRoute](https://gateway-api.sigs.k8s.io/reference/api-spec/1.4/spec/#tcproute) [UDPRoute](https://gateway-api.sigs.k8s.io/reference/api-spec/1.4/spec/#udproute) | Gateway API | Yes      | Routing            | Gateway                 | Define routing rules for different types of traffic. **Note:**_For simplicity these resources are referenced collectively as Route in the References column_                                 |
| [Backend](https://gateway.envoyproxy.io/docs/tasks/traffic/backend/)                                                                                                                                                                                                                                                                                                                                          | EG API      | No       | Routing            | N/A                     | 该工具可用于通过 FQDN 或 IP 地址将流量路由到集群外的后端服务。此外，当希望扩展 Envoy 功能，以便通过 Unix 域套接字访问外部进程时，也可以使用该工具。                                                                                                        |
| [ClientTrafficPolicy](https://gateway.envoyproxy.io/docs/api/extension_types/#clienttrafficpolicy)                                                                                                                                                                                                                                                                                                            | EG API      | No       | Traffic Handling   | Gateway                 | 规定了处理客户端流量的策略，包括速率限制、重试次数以及其他针对客户端的特定配置。                                                                                                                                                     |
| [BackendTrafficPolicy](https://gateway.envoyproxy.io/docs/api/extension_types/#backendtrafficpolicy)                                                                                                                                                                                                                                                                                                          | EG API      | No       | Traffic Handling   | Gateway, Route          | 规定了针对后端服务的流量管理策略，包括负载均衡、健康检测以及故障转移机制等。注意：大多数具体的配置选项都很有用。                                                                                                                                     |
| [SecurityPolicy](https://gateway.envoyproxy.io/docs/api/extension_types/#securitypolicy)                                                                                                                                                                                                                                                                                                                      | EG API      | No       | Security           | Gateway, Route          | 定义了与安全性相关的策略，例如认证、授权以及加密设置等，这些策略适用于 Envoy Gateway 处理的流量。注意：大多数具体的配置选项都很有用。                                                                                                                   |
| [BackendTLSPolicy](https://gateway-api.sigs.k8s.io/reference/api-types/policy/backendtlspolicy/)                                                                                                                                                                                                                                                                                                              | Gateway API | No       | Security           | Service                 | 定义了后端连接的 TLS 设置，包括证书管理、TLS 版本以及其他安全配置。此策略适用于 Kubernetes 服务。                                                                                                                                  |
| [EnvoyProxy](https://gateway.envoyproxy.io/docs/api/extension_types/#envoyproxy)                                                                                                                                                                                                                                                                                                                              | EG API      | No       | Customize & Extend | GatewayClass, Gateway   | EnvoyProxy 资源代表了 Kubernetes 集群中 Envoy 代理本身的部署与配置情况，负责管理其生命周期及设置。注意：大多数情况下，具体的配置选项会具有优先权。                                                                                                     |
| [EnvoyPatchPolicy](https://gateway.envoyproxy.io/docs/api/extension_types/#envoypatchpolicy)                                                                                                                                                                                                                                                                                                                  | EG API      | No       | Customize & Extend | GatewayClass, Gateway   | This policy defines custom patches to be applied to Envoy Gateway resources, allowing users to tailor the configuration to their specific needs. **Note:**_Most specific configuration wins_ |
| [EnvoyExtensionPolicy](https://gateway.envoyproxy.io/docs/api/extension_types/#envoyextensionpolicy)                                                                                                                                                                                                                                                                                                          | EG API      | No       | Customize & Extend | Gateway, Route, Backend | Allows for the configuration of Envoy proxy extensions, enabling custom behavior and functionality. **Note:**_Most specific configuration wins_                                              |
| [HTTPRouteFilter](https://gateway.envoyproxy.io/docs/api/extension_types/#httproutefilter)                                                                                                                                                                                                                                                                                                                    | EG API      | No       | Customize & Extend | HTTPRoute               | Allows for the additional request/response processing.                                                                                                                                       |

## API 扩展功能
Gateway API 扩展功能允许您配置一些标准 Kubernetes Gateway API 中不包含的额外功能。这些扩展功能是由负责创建和维护 Gateway API 实现的团队所开发的。Gateway API 被设计为具有可扩展性、安全性和可靠性。在旧的 Ingress API 中，人们需要使用自定义注释来添加新功能，但这种方式并不具备类型安全性，因此很难检查配置是否正确。而通过 Gateway API 扩展功能，实现者可以提供类型安全的自定义资源定义（Custom Resource Definitions，CRDs）。这意味着您编写的每一条配置都具有清晰的结构和严格的规则，从而更容易在早期发现错误，并确保您的配置是有效的。

Envoy Gateway API 引入了一组 Gateway API 扩展功能，使用户能够充分利用 Envoy 代理的强大功能。Envoy Gateway 采用策略附加模型，即可以在不修改核心 API 的情况下，将自定义策略应用于标准的 Gateway API 资源（如 HTTPRoute 或 Gateway）。这种设计方式有助于实现职责的分离，并简化不同团队之间的配置管理。

>目前支持的扩展包括 `Backend` 、 `BackendTrafficPolicy` 、 `ClientTrafficPolicy` 、 `EnvoyExtensionPolicy` 、 `EnvoyGateway` 、 `EnvoyPatchPolicy` 、 `EnvoyProxy` 、 `HTTPRouteFilter` 以及 `SecurityPolicy` 。

这些扩展功能是通过 Envoy Gateway 的控制层来处理的，它们会被转化为适用于 Envoy 代理实例的 xDS 配置。这种分层架构能够实现一致、可扩展且符合生产环境的流量控制，而无需直接管理原始的 Envoy 配置。

### `BackendTrafficPolicy`
`BackendTrafficPolicy` 是 Kubernetes Gateway API 的一个扩展功能，它用于控制 Envoy Gateway 如何与您的后端服务进行通信。用户可以配置连接行为、弹性机制以及性能优化设置，而无需对应用程序进行任何修改。

可以将其视为连接网关与后端服务之间的流量控制器。它能够检测问题，防止故障扩散，并优化请求处理流程，从而提高系统的稳定性。

*使用场景*
- 保护您的服务：限制连接数，并在必要时拒绝过多的流量请求
- 构建具有弹性的系统：能够检测到运行中的服务出现孤战，并重新分配流量
- 提升性能：优化请求的分配方式以及相应的处理流程
- 测试系统行为：引入故障并验证你的恢复机制是否有效

### Envoy Gateway 中的 BackendTrafficPolicy 配置
`BackendTrafficPolicy` 是 Envoy Gateway API 套件的一部分，该套件为 Kubernetes Gateway API 增加了额外的功能。它作为一种自定义资源定义（CRD）实现，你可以利用它来配置 Envoy Gateway 如何管理对后端服务的流量传输。

#### 目标
BackendTrafficPolicy 可以通过两种定位机制与 Gateway API 资源关联：
1. Direct Reference(直接引用)：明确指认特定资源的名称和类型
2. Label Selection(标签选择)： 根据标签来匹配资源

```yaml
# Direct reference targeting
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: direct-policy
spec:
  targetRefs:
    - kind: HTTPRoute
      name: my-route
  circuitBreaker:
    maxConnections: 50

---
# Label-based targeting
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: selector-policy
spec:
  targetSelectors:
    - kind: HTTPRoute
      matchLabels:
        app: payment-service
  rateLimit:
    local:
      requests: 10
      unit: Second
```
该政策适用于所有符合任一目标匹配条件的资源。你可以针对各种 Gateway API 资源类型进行目标定位，包括 `Gateway` 、 `ListenerSet` 、 `HTTPRoute` 、 `GRPCRoute` 、 `TCPRoute` 、 `UDPRoute` 、 `TLSRoute` 等。

当 BackendTrafficPolicy 策略针对 `ListenerSet` 目标时，该策略仅适用于该 ListenerSet 中的监听器。它并不适用于由父网关直接管理的监听器。而 `ListenerSet` 目标则可以使用 `sectionName` 来对该 ListenerSet 中的单个监听器应用该策略。

路由级策略适用于目标路由，无论该路由是直接连接到 `Gateway` 还是通过 `ListenerSet` 来连接。
>重要提示：BackendTrafficPolicy 只能针对与自身政策属于同一命名空间的资源进行管理。

#### Precedence 优先级
当多个 BackendTrafficPolicies 适用于同一资源时，Envoy Gateway 会根据目标资源类型、路由附加路径以及部分级别的特异性来排序，从而解决冲突问题。
首先会执行特定路线的策略规定：
- Route rule-level policies: 使用HTTPRoute或GRPCRoute 并带有sectionName来指定具体的规则
- Route-level policies: HTTPRoute, GRPCRoute,不包括sectionName

在路由特定的策略之后，父策略的优先级取决于该路由的附加方式。

对于通过 `ListenerSet` 连接的路线：
1. **ListenerSet listener-level policies** (`ListenerSet` with `sectionName` targeting a specific ListenerSet listener)  
    监听器组制定了监听器级别的策略（ `ListenerSet` ，其中 `sectionName` 指的是特定监听器组）。
2. **ListenerSet-level policies** (`ListenerSet` without `sectionName`)  
    监听器集级别策略（ `ListenerSet` 中没有 `sectionName` ）
3. **Gateway-level policies** (`Gateway` without `sectionName`) on the parent Gateway  
    在父网关上实施的网关级策略（ `Gateway` 中没有 `sectionName` ）
对于直接连接到 `Gateway` 的路线来说：
4. **Gateway listener-level policies** (`Gateway` with `sectionName` targeting specific Gateway-owned listeners)  
    网关监听器级别策略（ `Gateway` ，针对特定由网关管理的监听器，即 `sectionName` ）
5. **Gateway-level policies** (`Gateway` without `sectionName`)  
    门户级政策（ `Gateway` 中没有 `sectionName` ）
Gateway 的监听器级策略是与 ListenerSet 监听器相类似的范畴，它们并不适用于通过 ListenerSet 连接的路由。
```bash
# Gateway-level policy (lower precedence) - Applies to all routes in the gateway
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: gateway-policy
spec:
  targetRefs:
    - kind: Gateway
      name: my-gateway
  circuitBreaker:
    maxConnections: 100

---
# Route-level policy (higher precedence)
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: route-policy
spec:
  targetRefs:
    - kind: HTTPRoute
      name: my-route
  circuitBreaker:
    maxConnections: 50

```
在示例中，HTTPRoute `my-route` 会使用路由级别策略中的 `maxConnections: 50` 值，从而覆盖网关级别设置的 100 值。

##### 同一级别的多项政策
当多个 BackendTrafficPolicies 在相同的层次结构级别针对同一资源时（例如，多个策略都针对同一个 HTTPRoute），Envoy Gateway 会采用以下规则来确定优先级：

1. **Creation Time Priority**: The oldest policy (earliest `creationTimestamp`) takes precedence  
    创建时间优先级：优先级最高的政策（最早创建的政策）会优先处理。
2. **Name-based Sorting**: If policies have identical creation timestamps, they are sorted alphabetically by namespaced name, with the first policy taking precedence  
    基于名称的排序：如果策略具有相同的创建时间戳，那么会按照命名空间中的名称进行字母排序，其中第一个策略会具有优先权。

```bash
# Policy created first - takes precedence
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: alpha-policy
  creationTimestamp: "2023-01-01T10:00:00Z"
spec:
  targetRefs:
    - kind: HTTPRoute
      name: my-route
  circuitBreaker:
    maxConnections: 30

---
# Policy created later - lower precedence
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: beta-policy
  creationTimestamp: "2023-01-01T11:00:00Z"
spec:
  targetRefs:
    - kind: HTTPRoute
      name: my-route
  circuitBreaker:
    maxConnections: 40
```
在示例中，由于 `alpha-policy` 的创建时间更早，因此它具有优先权，此时 HTTPRoute 会使用 `maxConnections: 30` 。
当 `mergeType` 字段未被设置时，就不会发生合并操作，只有最具体的配置才会生效。不过，可以通过 `mergeType` 字段来配置策略与父策略的合并（详见下面的“策略合并”部分）。

#### Policy Merging  政策合并

BackendTrafficPolicy 支持使用 `mergeType` 字段来合并配置。这样，路由级别或路由规则级别的策略可以与父级策略结合，而不是完全覆盖它们。这种机制使得平台团队能够在 Gateway 或 ListenerSet 级别设置基准配置，而应用团队则可以为其特定路由添加具体的策略。
在路由合并发生时，路由级策略会与路由附件层次结构中最近的父级策略进行合并。

- For routes attached directly to a Gateway, the route policy first looks for a Gateway listener-level policy, then a Gateway-level policy.  
    对于直接连接到网关的路由，路由策略会首先查找网关级别的监听器策略，然后才是网关级别的策略。
- For routes attached through a ListenerSet, the route policy first looks for a ListenerSet listener-level policy, then a ListenerSet-level policy, then the parent Gateway-level policy.  
    对于通过 ListenerSet 连接的路由，路由策略会首先查找 ListenerSet 级别的策略，然后是 ListenerSet 本身的策略，最后才是父级 Gateway 级别的策略。
通过 ListenerSet 附加的路由策略不会与网关监听器的策略合并，因为网关监听器与 ListenerSet 监听器属于不同的作用域。

##### Merge Types  合并类型
- **StrategicMerge**: Uses Kubernetes strategic merge patch semantics, providing intelligent merging for complex data structures including arrays  
    StrategicMerge：采用 Kubernetes 的策略性合并补丁机制，能够智能地合并复杂的数据结构，包括数组在内的各种数据结构也能被合并。
- **JSONMerge**: Uses RFC 7396 JSON Merge Patch semantics, with simple replacement strategy where arrays are completely replaced  
    JSONMerge：采用 RFC 7396 中规定的 JSON 合并语义，采用简单的替换策略，其中数组会被完全替换。

###### eg.
```bash
# Platform team: Gateway-level policy with global abuse prevention
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: global-backendtrafficpolicy
spec:
  rateLimit:
    global:
      rules:
      - clientSelectors:
        - sourceCIDR:
            type: Distinct
            value: 0.0.0.0/0
        limit:
          requests: 100
          unit: Second
        shared: true
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: eg

---
# Application team: Route-level policy with specific limits
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: route-backendtrafficpolicy
spec:
  mergeType: StrategicMerge  # Enables merging with gateway policy
  rateLimit:
    global:
      rules:
      - clientSelectors:
        - sourceCIDR:
            type: Distinct
            value: 0.0.0.0/0
        limit:
          requests: 5
          unit: Minute
        shared: false
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: signup-service-httproute
```

在这个示例中，路由级策略与网关级策略合并了，因此同时会执行两种限制：全局的每秒 100 次请求限制，以及针对特定路由的每分钟 5 次请求限制。
>`mergeType` 字段只能应用于针对 xRoute 资源（如 HTTPRoute）的策略，而不适用于父级资源（如 Gateway 或 ListenerSet）。
>当 `mergeType` 未被设置时，就不会发生合并操作——只有最具体的策略才会生效。
>这种合并后的配置方式将两种策略结合在一起，从而实现更全面的防护策略。


### `ClientTrafficPolicy`

`ClientTrafficPolicy` 是 Kubernetes Gateway API 的一个扩展功能，它允许系统管理员配置 Envoy Proxy 服务器与下游客户端之间的交互方式。这是一个策略附加资源，可以应用于 `Gateway` 和 `ListenerSet` 资源，用于设定下游客户端与 Envoy Proxy 监听器之间连接的行为。
可以将 `ClientTrafficPolicy` 视为一组规则，用于配置网关的入口点。通过这些规则，你可以为网关中的每个监听器设置特定的行为。其中，更具体的规则会优先于通用的规则发挥作用。



































