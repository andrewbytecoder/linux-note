## 概述
我们实际使用场景中，可以使用kubernetes节点标签，有选择性的选择部分节点作为BGP对等体接入。这种方法对于大型集群来说非常重要，因为如果使用ToR交换机来连接所有节点，将会产生过多的BGP会话。
在大型kubernetes集群中，每个节点都和ToR建立BGP连接会存在如下挑战：

|Challenge|Impact|
|---|---|
|**BGP Session Overhead**|Each node requires a dedicated BGP session, consuming ToR resources|
|**Control Plane Load**|More BGP peers = more route updates = higher CPU/memory usage on network devices|
|**Scalability Limits**|ToR switches have finite BGP peer capacity (often 64-128 peers)|
|**Operational Complexity**|More sessions to monitor, troubleshoot, and maintain|
>指定一部分节点作为BGP speakers，这些节点会与网络基础设施进行通信，并代表集群来广播路由信息。

## Traffic Flow 说明
- 外部客户端想 LoadBalancer的IP地址 `172.16.0.241` 发送流量
- ToR交换机通过ECMP将流量路由到其中一个BGP通告节点（work或work2）
- BGP Speaker节点接收到数据包之后，会使用Kube-proxy/iptables工具将数据包转发到Pod所在的节点
- Pod(可以位于任何节点上，包括像worker4这样的非BGP节点)接收并处理请求

关键洞察：尽管 worker3 和 worker4 没有与 ToR 之间的 BGP 连接，但这些节点上的容器仍然可以访问目标设备。因为流量是通过 BGP 路由节点进入的，然后经由内部容器网络进行转发。

## 实验topo结构
![[Pasted image 20261019104427.png]]

## 资源清单

### clab topo
```yaml
name: selective-bgp-peering
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

    k01-control-plane:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.10/24"

    # BGP Peer Node 1 - Connected to ToR
    k01-worker:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.11/24"

    # BGP Peer Node 2 - Connected to ToR
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

  links:
    # All nodes connected to ToR in VLAN 10
    - endpoints: ["ceos01:eth1", "k01-control-plane:eth1"]
    - endpoints: ["ceos01:eth2", "k01-worker:eth1"]
    - endpoints: ["ceos01:eth3", "k01-worker2:eth1"]
    - endpoints: ["ceos01:eth4", "k01-worker3:eth1"]
    - endpoints: ["ceos01:eth5", "k01-worker4:eth1"]

```

### calico 配置

#### custom resource
```yaml
# This section includes base Calico installation configuration.
# For more information, see: https://docs.tigera.io/calico/latest/reference/installation/api#operator.tigera.io/v1.Installation
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  # Configures Calico networking.
  calicoNetwork:
    ipPools:
    - name: default-ipv4-ippool
      blockSize: 26
      cidr: 192.168.0.0/16
      encapsulation: VXLANCrossSubnet
      natOutgoing: Enabled
      nodeSelector: all()
      disableBGPExport: true
    nodeAddressAutodetectionV4:
      cidrs:
        - 10.10.0.0/16

---

# This section configures the Calico API server.
# For more information, see: https://docs.tigera.io/calico/latest/reference/installation/api#operator.tigera.io/v1.APIServer
apiVersion: operator.tigera.io/v1
kind: APIServer
metadata:
  name: default
spec: {}
```

#### BGPConfiguration
```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false
  serviceLoadBalancerIPs:
  - cidr: 172.16.0.240/28
```

#### BGPPeer
```yaml
apiVersion: projectcalico.org/v3
kind: BGPPeer
metadata:
  name: bgppeer-arista
spec:
  peerIP: 10.10.10.1           # IP address of your Arista switch
  asNumber: 65001              # AS number of the Arista switch
  # Only nodes with the label bgp-peer=true will peer with the ToR
  nodeSelector: bgp-peer == "true"

```

#### IPPool
```yaml
apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
 name: loadbalancer-ip-pool
spec:
 cidr: 172.16.0.240/28
 blockSize: 28
 natOutgoing: true
 disabled: false
 assignmentMode: Automatic
 allowedUses:
  - LoadBalancer

```


### 交换机配置
```config 
! Arista cEOS startup configuration
!
hostname ceos
!
! Define VLAN 10
!
vlan 10
   name Calico-Network
!
! Configure interfaces as access ports in VLAN 10
! All nodes are connected to VLAN 10, but only worker and worker2 have BGP peering
!
interface Ethernet1
   description Connection to k01-control-plane
   switchport mode access
   switchport access vlan 10
!
interface Ethernet2
   description Connection to k01-worker (BGP Peer)
   switchport mode access
   switchport access vlan 10
!
interface Ethernet3
   description Connection to k01-worker2 (BGP Peer)
   switchport mode access
   switchport access vlan 10
!
interface Ethernet4
   description Connection to k01-worker3
   switchport mode access
   switchport access vlan 10
!
interface Ethernet5
   description Connection to k01-worker4
   switchport mode access
   switchport access vlan 10

!
! Layer 3 interface for VLAN 10
!
interface Vlan10
   description Calico Network L3 Interface
   ip address 10.10.10.1/24
!
! Enable IP routing
!
ip routing
!
! Management interface
!
interface Management0
   ip address dhcp
   no shutdown
!
! User configuration
!
username admin privilege 15 secret admin
!
! Enable HTTP API
!
management api http-commands
   no shutdown

! BGP Configuration
! Note: The ToR accepts BGP connections from the entire subnet, but only nodes
! with the bgp-peer=true label (configured via Calico's nodeSelector) will 
! actually initiate BGP sessions. This is selective peering controlled by Calico.
router bgp 65001
   router-id 10.10.10.1
   bgp listen range 10.10.10.0/24 peer-group CALICO-K8S remote-as 65010
   neighbor CALICO-K8S peer group
   neighbor CALICO-K8S remote-as 65010
   neighbor CALICO-K8S description "Calico Kubernetes Nodes"
   !
   address-family ipv4
      neighbor CALICO-K8S activate
      network 10.10.10.0/24

end

```

## 环境检查
### 检查topo结构
```bash
> containerlab inspect -t topology.clab.yaml
10:56:27 INFO Parsing & checking topology file=topology.clab.yaml
╭───────────────────────────────────┬──────────────────────┬─────────┬───────────────────────╮
│                Name               │      Kind/Image      │  State  │     IPv4/6 Address    │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane                 │ ext-container        │ running │ 172.21.0.6            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::6 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker                        │ ext-container        │ running │ 172.21.0.5            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::5 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2                       │ ext-container        │ running │ 172.21.0.4            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker3                       │ ext-container        │ running │ 172.21.0.3            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker4                       │ ext-container        │ running │ 172.21.0.2            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ clab-selective-bgp-peering-ceos01 │ arista_ceos          │ running │ 172.20.20.2           │
│                                   │ ceos:4.34.0F         │         │ 3fff:172:20:20::2     │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane                 │ k8s-kind             │ running │ 172.21.0.6            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::6 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker                        │ k8s-kind             │ running │ 172.21.0.5            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::5 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2                       │ k8s-kind             │ running │ 172.21.0.4            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker3                       │ k8s-kind             │ running │ 172.21.0.3            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├───────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker4                       │ k8s-kind             │ running │ 172.21.0.2            │
│                                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
╰───────────────────────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

检查节点情况
```bash
> kubectl get node -o wide
NAME                STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION     CONTAINER-RUNTIME
k01-control-plane   Ready    control-plane   74m   v1.35.0   10.10.10.10   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker          Ready    <none>          73m   v1.35.0   10.10.10.11   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker2         Ready    <none>          73m   v1.35.0   10.10.10.12   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker3         Ready    <none>          73m   v1.35.0   10.10.10.13   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker4         Ready    <none>          73m   v1.35.0   10.10.10.14   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
```

本次实验的目的是配置选择性BGP进行互联，使得只有指定的节点能向上游路由器宣告负载均衡的IP地址

### 验证节点标签
```bash
> kubectl get node --show-labels |grep bgp-peer
k01-worker          Ready    <none>          78m   v1.35.0   beta.kubernetes.io/arch=amd64,beta.kubernetes.io/os=linux,bgp-peer=true,kubernetes.io/arch=amd64,kubernetes.io/hostname=k01-worker,kubernetes.io/os=linux
k01-worker2         Ready    <none>          78m   v1.35.0   beta.kubernetes.io/arch=amd64,beta.kubernetes.io/os=linux,bgp-peer=true,kubernetes.io/arch=amd64,kubernetes.io/hostname=k01-worker2,kubernetes.io/os=linux
```
或者直接指定lables来选择Node
```bash
> kubectl get node -l bgp-peer=true
NAME          STATUS   ROLES    AGE   VERSION
k01-worker    Ready    <none>   79m   v1.35.0
k01-worker2   Ready    <none>   79m   v1.35.0
```

### 检查BGPPeer 配置
选择性借入的关键在于BGPPeer资源中的 `nodeSelector`字段，该字段定义在 BGPPeer 配置中

```yaml
> kubectl get bgppeers   -o yaml
apiVersion: v1
items:
- apiVersion: projectcalico.org/v3
  kind: BGPPeer
  metadata:
    name: bgppeer-arista
  spec:
    asNumber: 65001
    nodeSelector: bgp-peer == "true"
    peerIP: 10.10.10.1
kind: List
```

- `nodeSelector: bgp-peer == "true"` : 这个选择器确保只有带有标签 `bgp-peer=true`的节点才会与ToR键换机建立BGP连接
- `peerIP: 10.10.10.1`: 上游交换机Arista的IP地址
- `asNumber: 65001`: 上游交换机的AS编号
如果没有这个选择器，所有节点都会尝试与ToR进行对等连接，而这种情况正式我们需要在大型集群中避免的。

## 配置负载均衡 IP地址池和负载均衡服务
### 使用负载均衡IP地址池
```bash
> kubectl get ippools
NAME                   CREATED AT
default-ipv4-ippool    2026-10-19T01:54:39Z
loadbalancer-ip-pool   2026-10-19T02:01:14Z
```

### 创建 LoadBalancer服务
```bash
> kubectl apply -f lb-nginx-service.yaml
service/lb-nginx-service unchanged
```

确认服务是否可用

```bash
> kubectl get service -n default
NAME               TYPE           CLUSTER-IP      EXTERNAL-IP    PORT(S)        AGE
kubernetes         ClusterIP      10.96.0.1       <none>         443/TCP        5h15m
lb-nginx-service   LoadBalancer   10.96.142.179   172.16.0.241   80:30897/TCP   4h57m
nginx-service      ClusterIP      10.96.56.99     <none>         80/TCP         4h57m
```

### 创建BGP Configuration用来发布负载均衡ip地址
```bash
> kubectl apply -f bgpconfiguration-lb.yaml
```

确认calico已经将bgp路由发布到了cEOS
```bash
ceos(config-router-bgp)#show ip bgp summary
BGP summary information for VRF default
Router identifier 10.10.10.1, local AS number 65001
Neighbor Status Codes: m - Under maintenance
  Description              Neighbor    V AS           MsgRcvd   MsgSent  InQ OutQ  Up/Down State   PfxRcd PfxAcc
  "Calico Kubernetes Nodes 10.10.10.11 4 65010            351       357    0    0 05:00:43 Estab   1      1
  "Calico Kubernetes Nodes 10.10.10.12 4 65010            350       360    0    0 05:00:43 Estab   1      1
```

## 验证选择性BGP介入功能是否生效
### 检查cEOS上的BGP会话状态
```bash
> docker exec -it clab-selective-bgp-peering-ceos01 Cli
ceos>enable
ceos#show ip bgp summary
BGP summary information for VRF default
Router identifier 10.10.10.1, local AS number 65001
Neighbor Status Codes: m - Under maintenance
  Description              Neighbor    V AS           MsgRcvd   MsgSent  InQ OutQ  Up/Down State   PfxRcd PfxAcc
  "Calico Kubernetes Nodes 10.10.10.11 4 65010            364       370    0    0 05:12:20 Estab   1      1
  "Calico Kubernetes Nodes 10.10.10.12 4 65010            363       374    0    0 05:12:20 Estab   1      1
```

可以看到，目前只建立了两个BGP会话(分别是work 和 work2)，而不是五个。这就是选择性互联的优势所在。
- work(10.10.10.11): BGP会话已建立
- work(10.10.10.12): BGP会话已建立
- control-plane,work3,work4:没有BGP会话，符合预期

### 验证路由表

```bash
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

Gateway of last resort:
 K        0.0.0.0/0 [40/0]
           via 172.20.20.1, Management0

 C        10.10.10.0/24
           directly connected, Vlan10
 B E      172.16.0.240/28 [200/0]
           via 10.10.10.11, Vlan10
           via 10.10.10.12, Vlan10
 C        172.20.20.0/24
           directly connected, Management0
```

负载均衡器CIDR `172.16.0.240/28` 正字啊通过BGP进行路由通告。

## 确认连接是否正常
1. 先查看nginx服务负载均衡地址
```bash
> kubectl get svc lb-nginx-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
172.16.0.241
```
2. 进入到cEOS容器验证对应ip是否能访问服务
```bash
> docker exec -it clab-selective-bgp-peering-ceos01 -- bash
OCI runtime exec failed: exec failed: unable to start container process: exec: "--": executable file not found in $PATH: unknown
> docker exec -it clab-selective-bgp-peering-ceos01 bash
bash-5.1# curl 
curl: try 'curl --help' for more information
bash-5.1# curl http://172.16.0.241:80
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, nginx is successfully installed and working.
Further configuration is required for the web server, reverse proxy, 
API gateway, load balancer, content cache, or other features.</p>

<p>For online documentation and support please refer to
<a href="https://nginx.org/">nginx.org</a>.<br/>
To engage with the community please visit
<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>
For enterprise grade support, professional services, additional 
security features and capabilities please refer to
<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
```

这证实了通过选择性连接的BGP节点实现了端到端的连通性

## 扩充BGP对等体
如果想要添加更多的BGP对等节点，只需要为这些节点添加标签即可：
```bash
# Add a node to the BGP peer group 
kubectl label node k01-worker3 bgp-peer=true 
# Remove a node from the BGP peer group 
kubectl label node k01-worker3 bgp-peer-
```

根据标签变化，Calico会自动建立或终止会话。

## 总结
这个实验展示了如何利用 Calico 的 `nodeSelector` 功能实现选择性地建立 BGP 连接。虽然所有五个节点都与 ToR 交换机进行连接，但实际上只有两个指定节点（标记为 `bgp-peer=true` ）建立了 BGP 会话。
- Node Labels: 节点标签，使用kubernetes标签 (bgp-peer=true)来表示担任BGP发言的节点。
- Selective BGPPeer: 选择性BGP对等体，已经使用 `nodeSelector` 配置BGPPeer，仅针对标记过的节点进行治理
- Reduced BGP Sessions: 减少BGP会话数量，现在只有两个BGP会话，而不是之前的五个会话，能降低60%
- LoadBalancer Advertisement: 负载均衡公告，通过选定的对等体成功发布服务IP地址信息。

优势：

| Benefit                 | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| **Scalability**         | Cluster can grow without proportionally increasing BGP sessions |
| **Resource Efficiency** | ToR switches handle fewer BGP peers and route updates           |
| **Flexibility**         | BGP speakers can be added/removed via label changes             |
| **Predictability**      | Network team knows exactly which nodes participate in BGP       |
| **High Availability**   | Multiple BGP speakers provide redundancy                        |

*生产建议：*
- 每个机架配置2-4个 speaker 节点，以实现冗余备份
- 在各个故障区域之间战略性地放置BGP speaker
- 监控BGP Speaker的健康状况，必要时自动进行故障转移
- 可以考虑使用节点亲和性机制，以确保每个Pod都能够连接到能接收BGP消息的节点















