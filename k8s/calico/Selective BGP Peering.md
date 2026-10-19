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




























