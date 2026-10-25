## 采用金丝雀部署模式的 Calico Ingress 网关

该实验展示了 Calico 的 Ingress Gateway 功能。该功能为 Kubernetes 提供了用于管理入站流量的 API 支持。您将学习如何部署基于 Envoy 的 Ingress Gateway、如何通过 LoadBalancer 来公开服务，以及如何利用流量分割技术来实现“金丝雀部署”模式。

Calico Ingress Gateway 将 Kubernetes 的 Gateway API 与 Calico 网络技术相结合，从而提供了一种功能强大的、基于 Envoy 的入口解决方案。该方案具备以下功能：

| Feature  特色功能                      | Description  描述                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Gateway API Support  网关 API 支持** | Uses standard Kubernetes Gateway API resources  <br>使用标准的 Kubernetes Gateway API 资源             |
| **Envoy-based  基于消息代理的**           | Leverages Envoy proxy for high-performance traffic management  <br>利用 Envoy 代理来实现高性能的流量管理       |
| **Traffic Splitting  流量分割**        | Route traffic to multiple backends with weighted distribution  <br>通过加权分配的方式，将流量引导至多个后端服务器。     |
| **Canary Deployments  金丝雀部署**      | Gradually roll out new versions with controlled traffic percentages  <br>逐步推出新版本，同时控制不同版本的流量占比。 |
| **BGP Integration  BGP 集成**        | Advertise gateway IPs via BGP for external accessibility  <br>通过 BGP 发布网关 IP 地址，以便外部设备能够访问这些地址  |
### 什么是金丝雀部署
金丝雀发布时一种渐进式发布策略：在将应用程序的新版本全面部署之前，会先在一小部分用户身上进行测试，这种方式有助于团队：
- 及早发现问题：在用户几乎不受影响的情况下就发现各种问题
- 验证新功能：在真实网络环境中测试各项功能是否正常运作
- 迅速回滚：如果出现问题，可以恢复到稳定版本
- 将风险降低至最低：最初，只有极少数用户会看到最新版本
![[Pasted image 20261023161351.png]]

## 实验室topo结构

- 5 个 Kubernetes 节点：1 个控制平面节点+4 个工作节点
- 2 个 BGP 节点（worker、worker2）：与 ToR 建立对等连接，并充当入口网关的托管节点。
- 2 个非 BGP 节点（worker3、worker4）：承担常规工作负载的节点
- 1  Arista cEOS ToR 交换机：负责在各个 VLAN 之间转发数据包。
- 1  外部用户主机：用于模拟 VLAN 30 上的外部客户端。

![[Pasted image 20261023161358.png]]

Traffic Flow:
- VLAN 30 上的外部用户向网关负载均衡器的IP地址 `172.16.0.241` 发送HTTP请求
- ToR交换机通过worker/worker2节点，拥有通过BGP学到通过 `172.16.0.240/28` 的路由
- ECMP将流量均匀分配到两个BGP节点上
- Envoy Gateway 负责接收网络流量，并根据HTTPRoute规则来处理这些流量
- 流量分配： 80%流量流向app-v1稳定版本，20%的流量流向app-v2(canary)
- 后端容器(位于任意节点上)负责处理相应请求

## 清单文件
### 网络topo
```yaml
name: calico-ingress
topology:
  nodes:
    ceos01:
      kind: arista_ceos
      image: ceos:4.34.0F
      startup-config: startup-configs/ceos01-startup-config.config

    k01:
      kind: k8s-kind
      startup-config: k01-no-cni.yaml
      extras:
        k8s_kind:
          deploy:
            wait: 0s
# 这里的命名规则是写死的， <clusterName>-<kind node name>
    k01-control-plane:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.10/24"

    # BGP Peer Node 1 - Connected to ToR (Gateway Node)
    k01-worker:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.11/24"

    # BGP Peer Node 2 - Connected to ToR (Gateway Node)
    k01-worker2:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.12/24"

    # Non-BGP Worker Node - Connected to ToR but no BGP peering
    k01-worker3:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.13/24"

    # Non-BGP Worker Node - Connected to ToR but no BGP peering
    k01-worker4:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.14/24"

    # External User Host on VLAN 30 - Simulates external client accessing services
    # 新增一个外部服务，这个服务，是为了能让用户测试网络连通性
    user:
      kind: linux
      image: nicolaka/netshoot:latest
      exec:
        - "ip addr add dev eth1 10.30.30.100/24"
        - "ip route add 172.16.0.0/16 via 10.30.30.1"

  links:
    # All K8s nodes connected to ToR in VLAN 10
    - endpoints: ["ceos01:eth1", "k01-control-plane:eth1"]
    - endpoints: ["ceos01:eth2", "k01-worker:eth1"]
    - endpoints: ["ceos01:eth3", "k01-worker2:eth1"]
    - endpoints: ["ceos01:eth4", "k01-worker3:eth1"]
    - endpoints: ["ceos01:eth5", "k01-worker4:eth1"]
    # User host connected to ToR in VLAN 30
    - endpoints: ["ceos01:eth6", "user:eth1"]

```

### gatewayapi
```yaml
# Enable Gateway API support in Calico
# This creates the necessary Envoy Gateway components for ingress traffic management
apiVersion: operator.tigera.io/v1
kind: GatewayAPI
metadata:
  name: default
spec:
  gatewayClasses:
    - name: tigera-gateway-class
      gatewayDeployment:
        spec:
          template:
            spec:
              # Deploy Envoy Gateway pods only on BGP peer nodes
              nodeSelector:
                bgp-peer: "true"
---
# Gateway resource that creates an Envoy-based ingress gateway
# The gateway listens on port 80 for HTTP traffic (accepts all hostnames)
# Hostname filtering is done at the HTTPRoute level
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: calico-ingress-gateway
  namespace: default
spec:
# 使用配置了节点选择器功能的GatewayClass 来配置BGP对等节点
# 未指定hostname 说明该网关接收来自任何主机名的请求

  gatewayClassName: tigera-gateway-class
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
        # 允许来自任何命名空间的 HTTP 路由连接到这个监听器
          from: All

---
# ReferenceGrant allows the HTTPRoute in the default namespace
# to reference Services in the ingress-gateway-demo namespace
# 允许 默认命名空间中的 Httproute 引用 ingress-gateway-demo 中的服务 
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-gateway-to-demo
  namespace: ingress-gateway-demo
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: default
  to:
    - group: ""
      kind: Service

```

### BGP 宣告信息
```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false
  # Advertise LoadBalancer IPs to the ToR switch
  # This will allow the Ingress Gateway service to be reachable from external networks
  serviceLoadBalancerIPs:
  - cidr: 172.16.0.240/28

```

## 环境检查

### contianerlab topo 查看
```bash
> containerlab inspect -t topology.clab.yaml
19:19:40 INFO Parsing & checking topology file=topology.clab.yaml
╭────────────────────────────┬──────────────────────────┬─────────┬───────────────────────╮
│            Name            │        Kind/Image        │  State  │     IPv4/6 Address    │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane          │ ext-container            │ running │ 172.21.0.2            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::2 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker                 │ ext-container            │ running │ 172.21.0.6            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::6 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker2                │ ext-container            │ running │ 172.21.0.3            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::3 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker3                │ ext-container            │ running │ 172.21.0.4            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::4 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker4                │ ext-container            │ running │ 172.21.0.5            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::5 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ clab-calico-ingress-ceos01 │ arista_ceos              │ running │ 172.20.20.2           │
│                            │ ceos:4.34.0F             │         │ 3fff:172:20:20::2     │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ clab-calico-ingress-user   │ linux                    │ running │ 172.20.20.3           │
│                            │ nicolaka/netshoot:latest │         │ 3fff:172:20:20::3     │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane          │ k8s-kind                 │ running │ 172.21.0.2            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::2 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker                 │ k8s-kind                 │ running │ 172.21.0.6            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::6 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker2                │ k8s-kind                 │ running │ 172.21.0.3            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::3 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker3                │ k8s-kind                 │ running │ 172.21.0.4            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::4 │
├────────────────────────────┼──────────────────────────┼─────────┼───────────────────────┤
│ k01-worker4                │ k8s-kind                 │ running │ 172.21.0.5            │
│                            │ kindest/node:v1.35.0     │         │ fc00:f853:ccd:e793::5 │
╰────────────────────────────┴──────────────────────────┴─────────┴───────────────────────╯
```

### k8s 环境
确认各个节点是否准备就绪
```bash
> kubectl get nodes -o wide
NAME                STATUS   ROLES           AGE     VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION     CONTAINER-RUNTIME
k01-control-plane   Ready    control-plane   3h11m   v1.35.0   10.10.10.10   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker          Ready    <none>          3h10m   v1.35.0   10.10.10.11   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker2         Ready    <none>          3h10m   v1.35.0   10.10.10.12   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker3         Ready    <none>          3h10m   v1.35.0   10.10.10.13   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker4         Ready    <none>          3h10m   v1.35.0   10.10.10.14   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
```

### 验证BGP对等体连接
只有worker和worker2(带有 `bgp-peer=true`标签的)节点应该与ToR建立BGP连接。列出带有标签的节点：
```bash
> kubectl get nodes -l bgp-peer=true
NAME          STATUS   ROLES    AGE     VERSION
k01-worker    Ready    <none>   3h13m   v1.35.0
k01-worker2   Ready    <none>   3h13m   v1.35.0
```

连接到cEOS交换机以验证BGP会话是否正常

```bash
> docker exec -it clab-calico-ingress-ceos01 Cli
ceos>enable
ceos#show ip bgp summary 
BGP summary information for VRF default
Router identifier 10.10.10.1, local AS number 65001
Neighbor Status Codes: m - Under maintenance
  Description              Neighbor    V AS           MsgRcvd   MsgSent  InQ OutQ  Up/Down State   PfxRcd PfxAcc
  "Calico Kubernetes Nodes 10.10.10.11 4 65010             40        43    0    0 00:32:01 Estab   1      1
  "Calico Kubernetes Nodes 10.10.10.12 4 65010             44        42    0    0 00:32:01 Estab   2      2
```

### 确认 Gateway API组件的正常运转
**检查 GatewayAPI 的状态**
```bash
kubectl get gatewayapi default -o yaml
```

```yaml
apiVersion: operator.tigera.io/v1
kind: GatewayAPI
metadata:
  name: default
spec:
  crdManagement: Reconcile
  gatewayDeployment:
    spec:
      template:
        spec:
          nodeSelector:
            bgp-peer: "true"
```
>这些节点与 ToR 交换机进行对等连接，能够公告 LoadBalancer 的 IP 地址。
>流量通过这些节点进入，并由当地的 Envoy 代理进行处理。
>这使得数据平面（Envoy）与 BGP 广播路径保持一致。

**检查 GatewayClass**
当启用Gateway API时，`tigera-gateway-class` 会自动创建
```bash
> kubectl get gatewayclasses.gateway.networking.k8s.io
NAME                   CONTROLLER                                      ACCEPTED   AGE
tigera-gateway-class   gateway.envoyproxy.io/gatewayclass-controller   True       42m
```

### 验证应用程序部署情况
检查应用程序的Pod是否在正常运行
```bash
> kubectl get pods -n ingress-gateway-demo -o wide
NAME                      READY   STATUS    RESTARTS   AGE    IP                NODE          NOMINATED NODE   READINESS GATES
app-v1-59b675b776-6hzm7   1/1     Running   0          126m   192.168.209.67    k01-worker3   <none>           <none>
app-v1-59b675b776-srh5k   1/1     Running   0          126m   192.168.136.194   k01-worker4   <none>           <none>
app-v2-5c5b769878-xfncs   1/1     Running   0          126m   192.168.136.195   k01-worker4   <none>           <none>
```

>这些应用程序容器被安排在 worker3 和 worker4 上运行（这些节点不是 BGP 节点），并且使用了节点亲和性机制来将工作负载节点与承载入口网关的 BGP 节点（worker、worker2）区分开来。

```bash
> kubectl get svc -n ingress-gateway-demo
NAME     TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
app-v1   ClusterIP   10.96.148.249   <none>        80/TCP    127m
app-v2   ClusterIP   10.96.205.217   <none>        80/TCP    127m
```

### 创建 Gateway API资源
现在，您需要创建 Gateway API 的资源，以允许进出的流量。本节将逐一介绍这些资源，并说明它们的功能。

**创建网关**
Gateway 是外部流量的入口点。它创建了一个基于 Envoy 的负载均衡器，负责监听 HTTP 流量。

```bash
> kubectl apply -f k8s-manifests/gateway.yaml
```

```bash
> kubectl get gateway
NAME                     CLASS                  ADDRESS        PROGRAMMED   AGE
calico-ingress-gateway   tigera-gateway-class   172.16.0.240   True         132m
```

发生了什么？在创建网关的时候：
1. Calico 在 `tigera-gateway` 命名空间中部署了 Envoy 代理节点
2. 已经创建了一个 LoadBalancer 服务，该服务的 IP 地址来自 BGP 路由通告中的池资源。
3. 该代理配置为通过端口 80 接收所有传入的请求。

**创建参考授权项**
在创建 HTTPRoute 之前，需要先创建 ReferenceGrant。这是一种安全机制，可用于支持跨命名空间引用。
为什么需要这个？HTTPRoute 位于 `default` 命名空间中，但它需要将流量路由到 `ingress-gateway-demo` 命名空间中的服务。由于安全原因，如果没有 ReferenceGrant，这种跨命名空间的引用会被阻止。

```yaml
> cat k8s-manifests/reference-grant.yaml
# ReferenceGrant allows the HTTPRoute in the default namespace
# to reference Services in the ingress-gateway-demo namespace
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-gateway-to-demo
  namespace: ingress-gateway-demo
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: default
  to:
    - group: ""
      kind: Service
```

- 该 ReferenceGrant 位于 `ingress-gateway-demo` 命名空间中（即服务所在的位置）。
- 该权限允许来自 `default` 命名空间的 HTTPRoutes 在此处引用服务。
- 该命名空间的所有者可以控制哪些实体可以引用他们的资源

```bash
> kubectl apply -f k8s-manifests/reference-grant.yaml
```

```bash
> kubectl get referencegrant -n ingress-gateway-demo
NAME                    AGE
allow-gateway-to-demo   137m
```

**创建 HTTP 路由**

现在创建 HTTPRoute，以确定流量应该如何被路由到你的后端服务。这个 HTTPRoute 实现了 80/20 的流量分配方案，即 80%的流量用于测试环境，20%的流量用于生产环境。

```yaml
# HTTPRoute for traffic splitting between app-v1 (stable) and app-v2 (canary)
# Initial split: 80% to v1 (stable), 20% to v2 (canary)
# Hostname filtering: Only routes requests with Host: app.demo.lab
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-traffic-split
  namespace: default
spec:
# HTTPRoute 只会匹配包含此主机头请求的请求
# 这里配置的是基于主机名的分路规则（而不是在网关级别进行配置）。
# 那些没有正确主机头信息的请求不会匹配这条路由。
  hostnames:
    - "app.demo.lab"
  parentRefs:
    - name: calico-ingress-gateway
      namespace: default
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: app-v1
          namespace: ingress-gateway-demo
          port: 80
          weight: 80
        - name: app-v2
          namespace: ingress-gateway-demo
          port: 80
          weight: 20
```

```bash
kubectl apply -f k8s-manifests/httproute.yaml
```

流量中 80% 被分配到了app-v1版本(稳定版本)。20%被分配到了app-v2版本(测试版本)


**确认所有资源均已连接。**

现在请确认这三种资源都已正确配置：
```bash
echo "=== Gateway ===" 
kubectl get gateway 
echo "" 
echo "=== HTTPRoute ===" 
kubectl get httproute 
echo "" 
echo "=== ReferenceGrant ===" 
kubectl get referencegrant -n ingress-gateway-demo
```

```bash
=== Gateway === 
NAME CLASS ADDRESS PROGRAMMED AGE 
calico-ingress-gateway tigera-gateway-class 172.16.0.241 True 2m

=== HTTPRoute === 
NAME HOSTNAMES AGE 
canary-traffic-split 1m 

=== ReferenceGrant === 
NAME AGE allow-gateway-to-demo 1m
```

### 检查 Gateway LoadBalancer 服务状态
Gateway 创建了一个 LoadBalancer 服务，该服务从我们经过 BGP 宣传的 IP 池中获取一个 IP 地址：
```bash
> kubectl get svc -n tigera-gateway
NAME                                            TYPE           CLUSTER-IP      EXTERNAL-IP    PORT(S)                                   AGE
envoy-default-calico-ingress-gateway-75f8f111   LoadBalancer   10.96.85.187    172.16.0.240   80:31689/TCP                              3h25m
envoy-gateway                                   ClusterIP      10.96.156.121   <none>         18000/TCP,18001/TCP,18002/TCP,19001/TCP   3h35m
```

### 确认 BGP 路由通告已生效。
通过 cEOS CLI 验证负载均衡器的 IP 地址是否正在被广播：要从主机访问 cEOS CLI，请使用以下命令（如果您的交换机节点名称与 `ceos01` 不同，请将其替换为您自己的节点名称）：
```bash
> docker exec -it clab-calico-ingress-ceos01 Cli
ceos>enable
ceos#show ip route 

VRF: default
Source Codes:
       C - connected, S - static, K - kernel,
       O - OSPF, O IA - OSPF inter area, O E1 - OSPF external type 1,
       O E2 - OSPF external type 2, O N1 - OSPF NSSA external type 1,
       O N2 - OSPF NSSA external type2, O3 - OSPFv3,
       O3 IA - OSPFv3 inter area, O3 E1 - OSPFv3 external type 1,
       O3 E2 - OSPFv3 external type 2,
       O3 N1 - OSPFv3 NSSA external type 1,
       O3 N2 - OSPFv3 NSSA external type2, B - Other BGP Routes,
       B I - iBGP, B E - eBGP, R - RIP, I L1 - IS-IS level 1,
       I L2 - IS-IS level 2, A B - BGP Aggregate,
       A O - OSPF Summary, NG - Nexthop Group Static Route,
       V - VXLAN Control Service, M - Martian,
       DH - DHCP client installed default route,
       DP - Dynamic Policy Route, L - VRF Leaked,
       G  - gRIBI, RC - Route Cache Route,
       CL - CBF Leaked Route

Gateway of last resort is not set

 C        10.10.10.0/24
           directly connected, Vlan10
 C        10.30.30.0/24
           directly connected, Vlan30
 B E      172.16.0.240/32 [200/0]
           via 10.10.10.12, Vlan10
 B E      172.16.0.240/28 [200/0]
           via 10.10.10.11, Vlan10
           via 10.10.10.12, Vlan10
 C        172.20.20.0/24
           directly connected, Management0

ceos#
```

关键观察结果：负载均衡器对应的 CIDR 地址 `172.16.0.240/28` 通过 BGP 广播节点进行通告，采用 ECMP 方式。

### 来自外部用户主机的测试
现在，让我们测试一下来自 VLAN 30 上外部用户主机的入口网关。
由于 Gateway 的配置中使用了主机名 `app.demo.lab` ，因此你在发送请求时必须包含 `Host` 头信息。如果没有正确的 Host 头信息，Gateway 将无法路由你的请求。
请检查用户主机的 IP 地址：

```bash
> docker exec -it clab-calico-ingress-user ip addr show eth1
208: eth1@if207: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9500 qdisc noqueue state UP group default 
    link/ether aa:c1:ab:9c:43:e5 brd ff:ff:ff:ff:ff:ff link-netnsid 1
    altname clab-o-0303a4cfa7162ae0
    inet 10.30.30.100/24 scope global eth1
       valid_lft forever preferred_lft forever
    inet6 fe80::a8c1:abff:fe9c:43e5/64 scope link proto kernel_ll 
       valid_lft forever preferred_lft forever
> 
```
请确认路由表中包含对 LoadBalancer 网络的路径信息：
```bash

> docker exec -it clab-calico-ingress-user ip route
default via 172.20.20.1 dev eth0 
10.30.30.0/24 dev eth1 proto kernel scope link src 10.30.30.100 
172.16.0.0/16 via 10.30.30.1 dev eth1 
172.20.20.0/24 dev eth0 proto kernel scope link src 172.20.20.2 

```
获取网关 IP 地址，然后尝试使用主机名发送一个请求：

```bash
> docker exec -it clab-calico-ingress-user curl -s -H "Host: app.demo.lab" http://172.16.0.240 | grep -o "App Version [12]"
App Version 2
             App Version 2
```
响应会根据流量分配情况而有所不同。

由于需要包含 `-H "Host: app.demo.lab"` 头部信息，因此必须将其保留下来。
- Gateway 监听器已配置为使用主机名 `app.demo.lab`
- HTTPRoute 能够匹配到带有此主机名的请求。
- 如果没有这个头部信息，Envoy 将无法匹配任何路由，然后会返回 404 错误。

**不使用主机头进行的测试（预期会失败）：**
```bash
docker exec -it clab-calico-ingress-user curl -s http://$GATEWAY_IP
```
这会返回一个空响应，或者因为没有任何路由匹配而返回 404 错误。

 **测试流量分配**
```bash
GATEWAY_IP=$(kubectl get svc -n tigera-gateway -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}') 
for i in $(seq 100); do 
  docker exec clab-calico-ingress-user curl -s -H "Host: app.demo.lab" http://$GATEWAY_IP | grep -o "App Version [12]" 
done | sort | uniq -c

80 App Version 1 
20 App Version 2
```
关键观察结果：v1 和 v2 之间的流量分配比例约为 80/20，这与我们的 HTTPRoute 配置一致！

**Detailed Traffic Analysis**

```bash  
GATEWAY_IP=$(kubectl get svc -n tigera-gateway -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')  
  
for i in $(seq 200); do   
docker exec clab-calico-ingress-user curl -s -H "Host: app.demo.lab" http://$GATEWAY_IP | grep -o "App Version [12]"done | awk '/Version 1/ {v1++}  
/Version 2/ {v2++}  
END {  
  total=v1+v2  printf("Version 1 (Stable): %d (%.1f%%)\nVersion 2 (Canary): %d (%.1f%%)\n",         v1, v1/total*100, v2, v2/total*100)}'  
```  
  
```  
Version 1 (Stable): 161 (80.5%)  
Version 2 (Canary): 39 (19.5%)  
```

### 调整流量分配方案（金丝雀进度模式）
当你对金丝雀版本越来越有信心的时候，就可以提高它的流量比例了
*将金丝雀比例增加到50%*
```bash
kubectl patch httproute canary-traffic-split --type='json' -p='[ {"op": "replace", "path": "/spec/rules/0/backendRefs/0/weight", "value": 50}, {"op": "replace", "path": "/spec/rules/0/backendRefs/1/weight", "value": 50} ]'
```

```bash
> GATEWAY_IP=$(kubectl get svc -n tigera-gateway -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')

for i in $(seq 100); do
  docker exec clab-calico-ingress-user curl -s -H "Host: app.demo.lab" http://$GATEWAY_IP | grep -o "App Version [12]"
done | sort | uniq -c
     98 App Version 1
    102 App Version 2
```


**完整部署（已部署 100%，进入 v2 版本）**

```bash
> kubectl patch httproute canary-traffic-split --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/backendRefs/0/weight", "value": 0},
  {"op": "replace", "path": "/spec/rules/0/backendRefs/1/weight", "value": 100}
]'
httproute.gateway.networking.k8s.io/canary-traffic-split patched
```
测试以确认所有流量都指向 v2：
```bash
> GATEWAY_IP=$(kubectl get svc -n tigera-gateway -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')

for i in $(seq 10); do
  docker exec clab-calico-ingress-user curl -s -H "Host: app.demo.lab" http://$GATEWAY_IP | grep -o "App Version [12]"
done
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
App Version 2
```

**回滚（如有必要）**
```bash
> kubectl patch httproute canary-traffic-split --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/backendRefs/0/weight", "value": 100},
  {"op": "replace", "path": "/spec/rules/0/backendRefs/1/weight", "value": 0}
]'
httproute.gateway.networking.k8s.io/canary-traffic-split patched
```
现在所有的流量都指向v1版本-稳定版本

**View Envoy Gateway Pods**

Calico Gateway API 通过部署 Envoy 节点来处理入站流量：
```bash
> kubectl get pods -n tigera-gateway
NAME                                                             READY   STATUS    RESTARTS   AGE
envoy-default-calico-ingress-gateway-75f8f111-7948cc5cd4-djv52   2/2     Running   0          27h
envoy-gateway-7f87948d56-gx5f2                                   1/1     Running   0          27h
```

检查网关Pod正在运行于哪些节点上：
```bash
> kubectl get pods -n tigera-gateway -o wide
NAME                                                             READY   STATUS    RESTARTS   AGE   IP                NODE          NOMINATED NODE   READINESS GATES
envoy-default-calico-ingress-gateway-75f8f111-7948cc5cd4-djv52   2/2     Running   0          27h   192.168.164.131   k01-worker2   <none>           <none>
envoy-gateway-7f87948d56-gx5f2                                   1/1     Running   0          27h   192.168.209.66    k01-worker3   <none>           <none>
```

>由于在 GatewayAPI CR 中配置了 `nodeSelector: bgp-peer: "true"` ，所以使者节点运行在 worker 或 worker2 上（BGP 对等节点）。这确保了
> 1. 代理服务器在那些有BGP路由通告的位置运行
> 2. 可以通过设置多个副本节点来实现BGP Speaker节点之间的高可用性

## ## Architecture Deep Dive
**Calico Ingress 网关的工作原理**
![[Pasted image 20261025221327.png]]


|Component|Description|
|---|---|
|**GatewayAPI**|Calico CRD that enables Gateway API support|
|**GatewayClass**|Defines the controller (Envoy Gateway)|
|**Gateway**|Creates listener endpoints (Envoy deployment + LoadBalancer service)|
|**HTTPRoute**|Defines routing rules, including traffic splitting|
|**ReferenceGrant**|Allows cross-namespace service references|

### 理解 Gateway、HTTPRoute 和 ReferenceGrant 的概念
这三大资源相互协作，共同构成了一个完整的接入解决方案。了解它们之间的关系对于正确配置 Gateway API 至关重要。



```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                   GATEWAY API RESOURCE RELATIONSHIP                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   NAMESPACE: default                          NAMESPACE: ingress-gateway-demo       │
│   ─────────────────────                       ───────────────────────────────       │
│                                                                                     │
│   ┌─────────────────────────┐                                                       │
│   │       Gateway           │                                                       │
│   │  calico-ingress-gateway │                                                       │
│   │  ─────────────────────  │                                                       │
│   │  • Port: 80             │                                                       │
│   │  • Protocol: HTTP       │                                                       │
│   │  • Creates Envoy pods   │                                                       │
│   │  • Gets LoadBalancer IP │                                                       │
│   └───────────┬─────────────┘                                                       │
│               │                                                                     │
│               │ parentRefs                                                          │
│               │                                                                     │
│               ▼                                                                     │
│   ┌─────────────────────────┐                                                       │
│   │      HTTPRoute          │                 ┌─────────────────────────────────┐   │
│   │  canary-traffic-split   │    backendRefs  │       ReferenceGrant            │   │
│   │  ─────────────────────  │ ───────────────►│  allow-gateway-to-demo          │   │
│   │  • Path: /              │  (Cross-NS ref  │  ─────────────────────────────  │   │
│   │  • app-v1: 80% weight   │   requires      │  GRANTS PERMISSION:             │   │
│   │  • app-v2: 20% weight   │   permission)   │  • FROM: HTTPRoute in default   │   │
│   └─────────────────────────┘                 │  • TO: Services in this NS      │   │
│                                               └─────────────────────────────────┘   │
│                                                             │                       │
│                                                             │ Allows access to      │
│                                                             ▼                       │
│                                               ┌─────────────────────────────────┐   │
│                                               │         Services                │   │
│                                               │  ┌─────────┐    ┌─────────┐     │   │
│                                               │  │ app-v1  │    │ app-v2  │     │   │
│                                               │  │ (80%)   │    │ (20%)   │     │   │
│                                               │  └─────────┘    └─────────┘     │   │
│                                               └─────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Gateway 是外部流量进入集群的入口点。它定义了：
- 监听什么：使用 HTTP 协议的端口 80
- 使用哪个控制器：`rigera-gateway-class` 基于Envoy控制器
- 所创建的内容：一个 Envoy 部署以及一个 LoadBalancer 服务。

```yaml
apiVersion: gateway.networking.k8s.io/v1 
kind: Gateway 
metadata: 
  name: calico-ingress-gateway 
  namespace: default 
spec: 
  gatewayClassName: tigera-gateway-class
  listeners: 
    - name: http
      protocol: HTTP 
      port: 80
```

Gateway 资源创建完成之后，calico会完成以下工作
1. 在 `tigera-gateway` 命名空间中部署 Envoy 代理节点
2. 创建了一个 LoadBalancer 服务，该服务从 BGP 路由所指示的 IP 地址池中获取一个 IP 地址。
3. 配置 Envoy 在指定的端口上进行监听。
4. 
**HTTP 路由资源 (httproute.yaml▸)**
HTTPRoute 定义了如何将传入的流量路由到后端服务。它包括：
- 通过 `parentRefs` 连接到网关
- 根据路径、头部信息等来匹配请求
- 通往后端系统的路径，在金丝雀部署中可以选择性地应用流量权重。

```yaml
# HTTPRoute for traffic splitting between app-v1 (stable) and app-v2 (canary)
# Initial split: 80% to v1 (stable), 20% to v2 (canary)
# Hostname filtering: Only routes requests with Host: app.demo.lab
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-traffic-split
  namespace: default
spec:
  hostnames:
    - "app.demo.lab"
  parentRefs:
    - name: calico-ingress-gateway
      namespace: default
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: app-v1
          namespace: ingress-gateway-demo
          port: 80
          weight: 80
        - name: app-v2
          namespace: ingress-gateway-demo
          port: 80
          weight: 20
```

重要提示：请注意，HTTPRoute 属于 `default` 命名空间，但它引用了 `ingress-gateway-demo` 命名空间中的服务。出于安全考虑，这种跨命名空间的引用是默认不允许的。

**参考资源分配（参考-grant.yaml 文件）**

ReferenceGrant 是一种安全机制，它明确允许跨命名空间进行资源引用。它的作用在于解决以下问题：“谁有权限在我的命名空间中引用资源？”
```yaml
# ReferenceGrant allows the HTTPRoute in the default namespace
# to reference Services in the ingress-gateway-demo namespace
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-gateway-to-demo
  namespace: ingress-gateway-demo
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: default
  to:
    - group: ""
      kind: Service
```

| Aspect | Details |
|--------|---------|
| **Placement** | Must be in the **target** namespace (where the referenced services live) |
| **Ownership** | The namespace owner controls who can reference their resources |
| **Granularity** | Can limit by source namespace, resource kind, and target resource type |
| **Security Model** | Follows principle of least privilege - no implicit trust between namespaces |

**为什么会有 ReferenceGrant 这个东西存在？**
如果没有 ReferenceGrant 这个机制，那么任何命名空间中的任何 HTTP 路由规则都可能将流量导向其他命名空间中的任何服务。这将导致严重的安全问题。
1. 未经授权的流量重定向：恶意 HTTP 路由程序可以拦截原本应分配给其他服务的流量。
2. 服务发现暴露：攻击者可以扫描不同命名空间中的服务
3. 命名空间隔离违规：命名空间并未能形成有效的安全边界。
参考：Grant 确保目标命名空间的拥有者必须明确选择允许跨命名空间引用。


**它们如何协同工作**
```
External Request → Gateway (default) → HTTPRoute (default) → ReferenceGrant check → Services (ingress-gateway-demo)
                   │                    │                     │
                   │                    │                     └─ "Is default/HTTPRoute allowed
                   │                    │                         to reference services here?"
                   │                    │                         ✓ Yes (ReferenceGrant exists)
                   │                    │
                   │                    └─ "Route to app-v1 (80%) and app-v2 (20%)
                   │                        in ingress-gateway-demo namespace"
                   │
                   └─ "Accept HTTP traffic on port 80"
```
**工作流程总结：**
1. Gateway 接受来自 80 端口的入站流量。
2. HTTPRoute（连接到网关）正在评估路由规则
3. HTTPRoute 希望将流量导向另一个命名空间中的服务。
4. Gateway API 会检查目标命名空间中是否存在一个名为 ReferenceGrant 的实体。
5. 引用授权：Grant 允许 HTTPRoutes 引用 `default` 中的服务。
6. 流量被转发到后端服务。

**LoadBalancer 与 BGP 的集成**
实现外部访问的关键在于各组件之间的集成。
1. Calico **LoadBalancer**  IPAM：从配置的池中分配 IP 地址
2. BGP 通告：将负载均衡器的 IP 地址通告给 ToR 节点
3. ECMP：通过多个 BGP 通告节点来分配流量

```
BGP Route Advertisement:

  k01-worker (10.10.10.11)  ─────┐
  (bgp-peer=true)                │
           │                     ▼
           │              ┌─────────────────┐
    Advertises:           │   ToR Switch    │
    172.16.0.240/28       │   (AS 65001)    │
           │              │                 │
           │              │ Routes:         │
  k01-worker2 (10.10.10.12)│ 172.16.0.240/28│
  (bgp-peer=true)         │   via 10.10.11 │──►  Accessible from VLAN 30
           │              │   via 10.10.12 │
           └──────────────└─────────────────┘
```
## Use Cases for Canary Deployments

| Use Case | Description |
|----------|-------------|
| **Feature Rollouts** | Safely release new features to a subset of users |
| **Performance Testing** | Evaluate new version under real traffic |
| **Bug Detection** | Catch critical bugs with minimal user impact |
| **A/B Testing** | Compare different versions for metrics/engagement |
| **Compliance** | Gradual rollout in regulated environments |


## Summary
这个实验展示了 Calico Gateway 在具有金丝雀部署功能下的表现：

| Aspect | Configuration |
|--------|---------------|
| **Gateway Type** | Envoy-based via Gateway API |
| **External Access** | LoadBalancer with BGP advertisement |
| **Traffic Management** | HTTPRoute with weighted backends |
| **Initial Split** | 80% stable, 20% canary |
| **Progression** | Adjustable via kubectl patch |
| **Rollback** | Instant by changing weights |

1. 标准网关 API：使用基于 Kubernetes 的网关 API 资源结构
2. BGP 集成：将 LoadBalancer 的 IP 地址通告给外部网络
3. 灵活的交通控制：可以轻松调整交通分流比例
4. 零停机发布：逐步增加流量，无需中断服务
5. 快速回滚：通过更改 HTTP 路由的权重来立即撤销当前的操作。


## Troubleshooting
**Gateway Not Getting IP**
If the Gateway doesn't get a LoadBalancer IP:

```bash
# Check if IPPool exists
kubectl get ippools

# Check BGPConfiguration for serviceLoadBalancerIPs
kubectl get bgpconfiguration default -o yaml

# Check for any events
kubectl describe gateway calico-ingress-gateway
```

**Traffic Not Reaching Backend**

If traffic doesn't reach the backend services:

```bash
# Check ReferenceGrant exists
kubectl get referencegrant -n ingress-gateway-demo

# Check HTTPRoute status
kubectl describe httproute canary-traffic-split

# Check Envoy pods are running
kubectl get pods -n tigera-gateway
kubectl logs -n tigera-gateway -l gateway.envoyproxy.io/owning-gateway-name=calico-ingress-gateway
```


**BGP Routes Not Advertised**

If LoadBalancer IP is not reachable from external network:

```bash
# Check BGP sessions on cEOS
docker exec -it clab-calico-ingress-ceos01 Cli -c "show ip bgp summary"

# Check routes on cEOS
docker exec -it clab-calico-ingress-ceos01 Cli -c "show ip route"

# Check Calico BGP status
calicoctl node status
```














