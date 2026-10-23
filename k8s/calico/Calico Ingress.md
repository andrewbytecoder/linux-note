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
  gatewayClassName: tigera-gateway-class
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
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
连接到cEOS交换机以验证BGP会话：














































































































