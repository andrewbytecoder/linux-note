通过与上游网络BGP互联，calico bgp能够实现通过Pod的CIDR地址以及服务相关的CIDR地址。

## 清单文件
### 网络topo 
```yaml
name: calico-bgp
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

# 为没个node添加一个网卡，用来创建ovn网络
    k01-control-plane:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.10/24"

    k01-worker:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.11/24"


    k01-worker2:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.12/24"

  links:
    - endpoints: ["ceos01:eth1", "k01-control-plane:eth1"]
    - endpoints: ["ceos01:eth2", "k01-worker:eth1"]
    - endpoints: ["ceos01:eth3", "k01-worker2:eth1"]
```

![[Pasted image 20261008151128.png]]
### kind配置
```yaml
apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
name: k01
networking:
  disableDefaultCNI: true
  podSubnet: "192.168.0.0/16"
  serviceSubnet: "10.96.0.0/16"

# 和网络配置保持一致
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.10"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.11"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.12"
```

### calico 配置
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

---

# Configures the Calico Goldmane flow aggregator.
apiVersion: operator.tigera.io/v1
kind: Goldmane
metadata:
  name: default

---

# Configures the Calico Whisker observability UI.
apiVersion: operator.tigera.io/v1
kind: Whisker
metadata:
  name: default
```

### bgp 配置
```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false
```

### bgp peer 配置
```yaml
apiVersion: projectcalico.org/v3
kind: BGPPeer
metadata:
  name: bgppeer-arista
spec:
  peerIP: 10.10.10.1           # IP address of your Arista switch
  asNumber: 65001              # AS number of the Arista switch
  nodeSelector: all()  
```

### 交换机配置
```bash
! Arista cEOS startup configuration
!
hostname ceos
!
! Define VLAN 10
!
vlan 10
   name Calico-Network
!
! Define VLAN 20
!
vlan 20
   name Calico-Network-2
!
! Configure interfaces as access ports in VLAN 10
! alias eth1
interface Ethernet1
   description Connection to k01-control-plane
   switchport mode access
   switchport access vlan 10
!
interface Ethernet2
   description Connection to k01-worker
   switchport mode access
   switchport access vlan 10
!
interface Ethernet3
   description Connection to k01-worker2
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

! 进入bgp 配置模式，本地AS 号码  65001
router bgp 65001
!  BGP 邻居识别，路由优选   RR 防环
   router-id 10.10.10.1、
!  动态 BGP 监听（被动模式） 自动归入  peer-group CALICO-K8S 这个group
   bgp listen range 10.10.10.0/24 peer-group CALICO-K8S remote-as 65010
   neighbor CALICO-K8S peer group
   neighbor CALICO-K8S remote-as 65010
   neighbor CALICO-K8S description "Calico Kubernetes Nodes"
   ! ipv4 BGP行为都在这里配置
   address-family ipv4
      neighbor CALICO-K8S activate
      ! 将这条路由  把这条路由 **注入 BGP** 
      network 10.10.10.0/24

end
```

## 环境检查
### 检查网络topo信息
![[Pasted image 20261008150911.png]]

### 检查kubernetes集群
```bash
❯ kubectl get nodes
NAME                STATUS   ROLES           AGE   VERSION
k01-control-plane   Ready    control-plane   18m   v1.35.0
k01-worker          Ready    <none>          17m   v1.35.0
k01-worker2         Ready    <none>          17m   v1.35.0
```

## Calico BGP Resources
### BGP配置
BGP配置是一个集群范围的资源，用于控制Calico的全局BGP设置，包括AS号、日志级别，以及是否启用默认的节点到节点全互联(mesh)。该资源决定了Calico节点在整个集群中如何参与BGP路由。

```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false
```
此配置用来定义Calico在集群中的全局BGP行为：
- `asNumber: 65010`: 为集群中所有的calico 节点分配AS编号 65010
- `nodeToNodeMeshEnabled: false`: 禁用所有Calico 节点之间默认的全网络BGP接入功能
- `logSeverityScreen: Info`: 将BGP日志级别设置为 `Info` 级别，以便于故障排查。
- 在 mesh功能管理的情况下，节点只会与明确配置好的外部BGP邻居进行对等连接

>Pod与Pod跨node进行通信，因为没有节点之间的iBGP路由交换，因此会经过vlan 10理由进行路由之后再进入到对应的pod中。

```bash
Pod A (node1)
  → node1 路由表：192.168.1.0/24 via 10.10.10.1
  → cEOS (10.10.10.1)
  → cEOS 路由表：192.168.1.0/24 via 10.10.10.11 (node2)
  → node2
  → Pod B
```
### BGP Peer
BGP Peer 资源定义了Calico节点应当与之建立会话、以交换路由信息的外部BGP邻居(eBGP)。这使得Calico 能够向外部网络基础设施通告Pod路由，并从上游路由器接收路由。

```yaml
apiVersion: projectcalico.org/v3
kind: BGPPeer
metadata:
  name: bgppeer-arista
spec:
  peerIP: 10.10.10.1           # IP address of your Arista switch
  asNumber: 65001              # AS number of the Arista switch
  nodeSelector: all()  
```

BGP Peer 配置用与外部基础网络设置中的BGP对等体建立连接
- `peerIP: 10.10.10.1`: 要与之建立BGP会话的Arista交换机IP地址
- `asNumber: 65001`: 外部BGP对等体 （Arista交换机）的AS号
- `nodeSelector: all() `: 此对等体配置，应用到Calico集群中的所有节点
- 一旦建立，Calico会向交换机通告Pod子网路由，并接收外部路由

### cEOS BGP 配置

```bash
router bgp 65001
   router-id 10.10.10.1
   bgp listen range 10.10.10.0/24 peer-group CALICO-K8S remote-as 65010
   neighbor CALICO-K8S peer group
   neighbor CALICO-K8S remote-as 65010
   neighbor CALICO-K8S description "Calico Kubernetes Nodes"
   address-family ipv4
      neighbor CALICO-K8S activate
      network 10.10.10.0/24
```

- `router bgp 65001`: 为该交换机配置带有AS编号65001的BGP路由。
- `router-id 10.10.10.1`: 将BGP路由器的ID设置为交换机的IP地址，方便后面一眼看出是哪个ip地址中的BGP
- `bgp listen range 10.10.10.0/24 peer-group CALICO-K8S remote-as 65010`: 为子网中任何具有 AS 65010 的主机启用动态对等连接功能
- `neighbor CALICO-K8S peer group`: 为calico创建一个对等组模板
- `neighbor CALICO-K8S remote-as 65010`: 指定Calico对等体的AS号
- `neighbor CALICO-K8S activate`: 激活与IPv4地址族相关的对等组
- `network 10.10.10.0/24`: 向BGP邻居通告本地子网信息
- 这些配置使得交换机能够自动接受来自 10.10.10.0/24 网络范围内任何节点发送的 BGP 连接请求

## BGP验证
### 在 Calico 中验证 BGP Peering
```bash
❯ calicoctl get bgppeers
NAME             PEERIP       NODE    ASN     
bgppeer-arista   10.10.10.1   all()   65001  
```
- `NAME`: BGP对等体资源名称 `bgppeer-arista`
- `PEERIP`: external BGP 邻居的地址(`10.10.10.1`)
- `NODE`: 节点选择符，用于指定哪些Calico节点奖进行对等连接
- `ASN`: 外部对等体的AS编号(`65001`)

>能得到以上配置，说明BGP对等体配置是有效的，并且所有Calico节点都已配置为与Arista交换机建立BGP会话。

### 在 cEOS中验证BGP Peering
在cEOS中查看，Arista交换机是否与所有的Calico节点已经建立连接
```bash
❯ docker exec -it clab-calico-bgp-ceos01 Cli
ceos>enable 
ceos#show ip bgp summary
BGP summary information for VRF default
Router identifier 10.10.10.1, local AS number 65001
Neighbor Status Codes: m - Under maintenance
  Description              Neighbor    V AS           MsgRcvd   MsgSent  InQ OutQ  Up/Down State   PfxRcd PfxAcc
  "Calico Kubernetes Nodes 10.10.10.10 4 65010            172       177    0    0 02:27:09 Estab   0      0
  "Calico Kubernetes Nodes 10.10.10.11 4 65010            171       177    0    0 02:27:09 Estab   0      0
  "Calico Kubernetes Nodes 10.10.10.12 4 65010            172       174    0    0 02:27:09 Estab   0      0
ceos#
```

- `Router identifier 10.10.10.1` 该交换机的BGP路由器ID
- `local AS number 65001`: 确认该交换机使用AS 65001
- `Neighbor`: 显示已经连接的calico节点的IP地址(`10.10.10.10`,`10.10.10.11`,`10.10.10.12`)
- `V AS`: BGP 版本4, remoter AS number 65010
- `MsgRcvd/MsgSent`: 已交换BGP消息数量，表明当前通信处理活跃状态
- `State`: Estab 已建立，表明所有对等体BGP会话建立成功
- `Up/Down`: BGP会话已建立时长
- `PfxRcd/PfxAcc`: 从每个对等体接收并接收的路由前缀数量，这里为0因为calico还没有同步路由信息

>从配置来看，cEOS交换机已经和三个calico节点建立BGP对等连接。

![[Pasted image 20261008173002.png]]






























