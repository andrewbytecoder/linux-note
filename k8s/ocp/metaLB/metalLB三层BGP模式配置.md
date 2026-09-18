##  1. BGP 模式概述
**MetalLB 是host网络。**

在 BGP 模式下，集群中的每个节点都与网络路由器建立 BGP 对等会话，并利用该会话通告外部集群服务的 VIP。只要路由器配置支持多路径，即可实现真正的负载均衡：MetalLB 发布的各条路由除下一跳地址外完全等价，因此路由器会同时使用所有下一跳，并在它们之间均匀分配流量。

BGP 模式支持跨三层网段部署，多个节点可以同时发布 VIP，具有高性能和高可用性的特点。路由器根据数据包头的某些字段进行哈希计算（如五元组），将不同连接均匀分散到各节点，但同一个连接的多个数据包会始终指向同一个后端。

## 2. 前置要求
配置 BGP 模式前需满足以下条件：

| 要求                | 说明                                   |
| ----------------- | ------------------------------------ |
| **Kubernetes 集群** | 版本 1.13.0 或更高，且未内置网络负载均衡功能           |
| **BGP 路由器**       | 支持 BGP 协议的一台或多台路由器                   |
| **IP 地址池**        | 供 MetalLB 分配的 IPv4 地址（如内网 IP 段）      |
| **AS 号**          | 为 MetalLB 集群指定自治系统号（ASN），并获取路由器的 ASN |

## 3. 安装与配置
### 3.1 安装 MetalLB
方案一：Helm 安装
```bash
helm repo add metallb https://metallb.github.io/metallb
helm install metallb metallb/metallb --namespace metallb-system --create-namespace
```
方案二：原生清单安装
```bash
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.9/config/manifests/metallb-native.yaml
```
### 3.2 配置 IP 地址池 (IPAddressPool)
定义 MetalLB 可分配给 LoadBalancer 类型 Service 的 IP 范围：
```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: bgp-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.9.1-192.168.9.5  # IP 范围
  autoAssign: true
```
> `autoAssign: true` 表示允许 `MetalLB` 自动从该池分配 IP；设为 false 则需要手动指定 `spec.loadBalancerIP`。

### 3.3 配置 BGP 对等体 (BGPPeer)
特别说明
```bash
1、与bgp 建链，用默认的ovn网络的网卡，原因如下：
  a 默认路由配置在上面
  b 当数据包到达节点后，kube-proxy 负责流量路由的最后一跳，将数据包发送到服务中的某个特定 Pod。
2、建链后，只宣告metalllb的路由，通过svc查看的
```

基础 BGPPeer 配置：

```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-peer-sample
  namespace: metallb-system
spec:
  myASN: 64500            # MetalLB 使用的 AS 号
  peerASN: 64501          # 对端路由器 AS 号
  peerAddress: 10.0.0.1   # 路由器 IP
```

```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-peer-worker1
  namespace: metallb-system
spec:
  myASN: 65580
  peerASN: 65520
  peerAddress: 10.161.41.253
  sourceAddress: 100.1.9.9   # 关键：锁定出口IP
  nodeSelectors:
    - matchLabels:
        kubernetes.io/hostname: worker1.z3.ameidc3.com # 替换为你的worker1主机名
```
> ⚠️ v1beta1 版本的 BGPPeer 已弃用，请使用 v1beta2 版本。

高级配置选项：

- 限制对等体到特定节点：通过 nodeSelectors 指定哪些节点与此 BGP 对等体建立会话：

```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-peer-limit
  namespace: metallb-system
spec:
  myASN: 64500
  peerASN: 64501
  peerAddress: 10.0.0.1
  nodeSelectors:
    - matchLabels:
        rack: frontend      # 仅带有 rack=frontend 标签的节点建立 BGP 会话
      matchExpressions:
        - key: network-speed
          operator: NotIn
          values: [slow]
```

配置 BFD：使用 FRR 模式时，可为 BGP 会话启用 BFD，实现更快的故障检测：
```yaml
apiVersion: metallb.io/v1beta1
kind: BFDProfile
metadata:
  name: bfd-sample
  namespace: metallb-system
spec:
  receiveInterval: 380
  transmitInterval: 270
---
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-peer-bfd
  namespace: metallb-system
spec:
  myASN: 64500
  peerASN: 64501
  peerAddress: 10.0.0.1
  bfdProfile: bfd-sample
```
- 指定 keepalive 时间：可通过 keepaliveTime 字段设定保活间隔，格式如 30s。
### 3.4 配置 BGP 通告 (`BGPAdvertisement`)
将 IP 地址池通过 BGP 通告出去：

基础通告配置：

```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: bgp-advertisement
  namespace: metallb-system
spec:
  ipAddressPools:
    - bgp-pool
```
高级通告配置选项（详细参数参见下方表格）：

| 参数                    | 类型              | 说明                         | 示例                  |
| --------------------- | --------------- | -------------------------- | ------------------- |
| `aggregationLength`   | int             | 路由聚合长度（IPv4），将 /32 聚合为更大前缀 | `24`                |
| `aggregationLengthV6` | int             | 路由聚合长度（IPv6），默认 128        | `64`                |
| `localPref`           | int             | BGP LOCAL_PREF 属性，值越高优先级越高 | `100`               |
| `communities`         | []string        | BGP 团体属性，可为标准社区或大型社区       | `["65535:65282"]`   |
| `ipAddressPools`      | []string        | 通告的 IP 地址池名称列表             | `["production"]`    |
| `nodeSelectors`       | []LabelSelector | 限制仅特定节点作为下一跳宣告服务           | 见下方示例               |
| `peers`               | []string        | 限制仅向特定 BGP 对等体通告           | `["peer1","peer2"]` |

带高级选项的通告示例：
```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: bgp-adv-advanced
  namespace: metallb-system
spec:
  ipAddressPools:
    - bgp-pool
  aggregationLength: 24       # 将 /32 聚合为 /24 向外通告
  localPref: 150              # 提高本地优先级
  communities:
    - "65535:65282"           # no-advertise 团体
  nodeSelectors:
    - matchLabels:
        kubernetes.io/hostname: worker-node-1
    - matchLabels:
        kubernetes.io/hostname: worker-node-2
```
### 3.5 FRR 模式（可选）
MetalLB 提供了 FRR 模式，使用 FRRouting（FRR）容器作为 BGP 会话的后端引擎。该模式支持：
- BGP 会话与 BFD 会话配对
- IPv6 地址通告
- 增强的故障检测能力
启用 FRR 模式的部署方式取决于使用的 Kubernetes 发行版（如 OpenShift 默认使用 FRR 模式）。FRR 模式作为将来 MetalLB 唯一 BGP 实现的长远演进方向，但在生产环境中仍建议评估其对具体网络设备及功能需求的满足程度。

## 4. 高级配置
### 4.1 多 BGP 路由器与多地址池
实际环境中通常配置多台 BGP 路由器以实现高可用：

```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-router-1
  namespace: metallb-system
spec:
  myASN: 64500
  peerASN: 64501
  peerAddress: 10.0.0.1
---
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-router-2
  namespace: metallb-system
spec:
  myASN: 64500
  peerASN: 64502
  peerAddress: 10.0.0.2
```
### 4.2 自定义 BGP 团体（Community）与路由策略
通过 Community CRD 定义团体别名，使配置更清晰可读：

```yaml
apiVersion: metallb.io/v1beta1
kind: Community
metadata:
  name: bgp-communities
  namespace: metallb-system
spec:
  communities:
    - name: vpn-only
      value: "1234:1"      # 标准社区
    - name: production-only
      value: "large:1000:1:2"  # 大型社区
---
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: bgp-adv
  namespace: metallb-system
spec:
  ipAddressPools:
    - external-pool
  communities:
    - "vpn-only"           # 引用定义的别名
    - "production-only"
```
### 4.3 路由聚合（Aggregation）
当需要对外通告聚合路由而内部保持每条 Service 独立路由时，可通过多个 BGPAdvertisement 实现：

```yaml
# 对内通告：/32 精细路由，带 no-advertise 团体，本地优先级高
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: internal
  namespace: metallb-system
spec:
  ipAddressPools:
    - public-pool
  aggregationLength: 32
  localPref: 100
  communities:
    - "65535:65282"        # no-advertise
---
# 对外通告：/24 聚合路由，向外传播
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: external
  namespace: metallb-system
spec:
  ipAddressPools:
    - public-pool
  aggregationLength: 24
```
### 4.4 基于命名空间或 Service 标签分配 IP
可通过 IPAddressPool 的 serviceAllocation 字段限制仅特定命名空间或 Service 使用该地址池：

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: restricted-pool
  namespace: metallb-system
spec:
  addresses:
    - 10.100.0.0/16
  serviceAllocation:
    namespaces:
      - prod
      - staging
    serviceSelectors:
      - matchExpressions:
          - key: app
            operator: In
            values: ["critical", "high-priority"]
```
> ⚠️ serviceAllocation 是 IP 地址池的精细化分配策略。若担心配置过于复杂，可直接使用默认自动分配模式。

### 4.5 限制通告范围
限制到特定节点（nodeSelectors）：仅当 Service 类型为 LoadBalancer 时有效，用于控制哪些节点作为下一跳宣告服务。

限制到特定对等体（peers）：通过 BGPAdvertisement 的 peers 字段，控制服务的 IP 仅通告给指定的 BGP 对等体列表，留空时默认向所有配置的 BGPPeer 通告：

```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: limited-bgp-advertisement
  namespace: metallb-system
spec:
  ipAddressPools:
    - internal-pool
  peers:
    - bgp-router-1
    - bgp-router-3
```

## 5. 验证配置
### 5.1 检查 BGP 会话状态
```bash
# 查看 MetalLB speaker Pod 日志
kubectl logs -n metallb-system -l app=metallb,component=speaker --tail=100
# 使用 FRR 模式时查看 BGPSessionState 资源
kubectl get bgpsessionstate -n metallb-system
```
>若 BGP 会话未能建立，可检查会话参数（ASN、密码、对端 IP）是否匹配，确认网络路由可达，以及查看 FRR 容器日志以定位问题。

### 5.2 验证路由播发
在 BGP 路由器上执行命令检查是否收到 MetalLB 播发的路由：
```bash
# 以 Cisco 为例
show ip bgp
```
