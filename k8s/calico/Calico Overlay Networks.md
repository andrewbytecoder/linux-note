通过Calico CNI Overlay网络技术，将节点分布在不同子网中

使用Kind创建4个k8s节点（一个控制平面，3个worker），通过Arista交换机连接位于两个子网中的节点：10.10.10.0、/2（control-plane、worker、worker2），10.10.20.0/24(worker3)

**关键概念**：
- IPPool: calico中管理Pod IP分配的资源配置(192.168.0.0/16)
- VXLAN跨子网通信：仅支持不同子网之间overlay封装功能
- Block Affinities: 显示各个节点如何被分配了相应的Pod CIDR范围
用来展示kubernetes节点位于不同的网络子网时，Calico如何处理节点间通信。通过使用VXLAN隧道技术来传输跨子网流量，同时允许在同一子网内进行直接路由通信。


## manifest
### clab 网络拓扑
```yaml
# 拓扑名称
name: calico-overlay
topology:
  nodes:
    ceos01:
    # arista_ceos **Arista cEOS**​ 虚拟交换机
      kind: arista_ceos
      image: ceos:4.34.0F
      startup-config: startup-configs/ceos01-startup-config.config
    # 创建一个集群 k01 kind k8s集群
    k01:
      kind: k8s-kind
      startup-config: k01-no-cni.yaml
      extras:
        k8s_kind:
          deploy:
            wait: 0s
	# k01-control-plane 必须是 k01中真实存在的 kind创建的容器名字
	#  ext-container 对已经存在的容器 让containerlab做哪些操作
	# 
    k01-control-plane:
      kind: ext-container
      exec:
      #设置MTU
        - "ip link set dev eth1 mtu 1500"
    # 关闭TSO/GSO避免VXLAN问题
        - "ethtool -K eth1 tso off gso off"
    # 配置接口 IP
        - "ip addr add dev eth1 10.10.10.10/24"
    # 添加静态路由
        - "ip route add 10.10.20.0/24 via 10.10.10.1"
    k01-worker:
      kind: ext-container
      exec:
        - "ip link set dev eth1 mtu 1500"
        - "ethtool -K eth1 tso off gso off"
        - "ip addr add dev eth1 10.10.10.11/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1"
    k01-worker2:
      kind: ext-container
      exec:
        - "ip link set dev eth1 mtu 1500"
        - "ethtool -K eth1 tso off gso off"
        - "ip addr add dev eth1 10.10.10.12/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1"
    k01-worker3:
      kind: ext-container
      exec:
        - "ip link set dev eth1 mtu 1500"
        - "ethtool -K eth1 tso off gso off"
        - "ip addr add dev eth1 10.10.20.20/24"
        - "ip route add 10.10.10.0/24 via 10.10.20.1"
  # 将交换机和容器连上网线
  links:
    - endpoints: ["ceos01:eth1", "k01-control-plane:eth1"]
    - endpoints: ["ceos01:eth2", "k01-worker:eth1"]
    - endpoints: ["ceos01:eth3", "k01-worker2:eth1"]
    - endpoints: ["ceos01:eth4", "k01-worker3:eth1"]
```

### 交换机配置 

```bash
! Arista cEOS startup configuration
! 给交换机命名，登录 CLI 时显示 ceos>
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
! 定义 物理端口，用来接网线
! Configure interfaces as access ports in VLAN 10
! 对应containerlab的 ceos01:eth1
interface Ethernet1
   description Connection to k01-control-plane
   switchport mode access
   switchport access vlan 10
! 对应containerlab的 ceos01:eth2
interface Ethernet2
   description Connection to k01-worker
   switchport mode access
   switchport access vlan 10
! 对应containerlab的 ceos01:eth3
interface Ethernet3
   description Connection to k01-worker2
   switchport mode access
   switchport access vlan 10
! 对应containerlab的 ceos01:eth4
interface Ethernet4
   description Connection to k01-worker3
   switchport mode access
   switchport access vlan 20
!
! Layer 3 interface for VLAN 10
! SVI (Switch Virtual Interface)
interface Vlan10
   description Calico Network L3 Interface
   ip address 10.10.10.1/24

interface Vlan20
   description Calico Network L3 Interface
   ip address 10.10.20.1/24
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

end
```

```bash
VLAN 10 (10.10.10.0/24)          VLAN 20 (10.10.20.0/24)
┌─────────────────────┐          ┌─────────────────────┐
│ control-plane (.10) │          │ worker3 (.20)       │
│ worker (.11)        │          └─────────────────────┘
│ worker2 (.12)       │                    │
└─────────────────────┘                    │
           │                              │
     eth1/2/3 (access)              eth4 (access)
           │                              │
     ┌─────┴─────┐                ┌─────┴─────┐
     │  Vlan10   │                │  Vlan20   │
     │ 10.10.10.1│                │ 10.10.20.1│
     └─────┬─────┘                └─────┬─────┘
           │                              │
           └────────── ip routing ────────┘
```

#### 验证主机名
```bash
└─[$] <git:(master*)> docker exec -it 553a3b3e592e Cli                 
ceos>show hostname
Hostname: ceos
FQDN:     ceos
```

#### 查看VLAN
```bash
ceos>show vlan brief
VLAN  Name                             Status    Ports
----- -------------------------------- --------- -------------------------------
1     default                          active    
10    Calico-Network                   active    Cpu, Et1, Et2, Et3
20    Calico-Network-2                 active    Cpu, Et4
```

#### 查看接口配置 (Ethernet1-4)
```bash
ceos>show interface status 
Port       Name                            Status       Vlan     Duplex Speed  Type            Flags Encapsulation
Et1        Connection to k01-control-plane connected    10       full   1G     EbraTestPhyPort                   
Et2        Connection to k01-worker        connected    10       full   1G     EbraTestPhyPort                   
Et3        Connection to k01-worker2       connected    10       full   1G     EbraTestPhyPort                   
Et4        Connection to k01-worker3       connected    20       full   1G     EbraTestPhyPort                   
Ma0                                        connected    routed   a-full a-1G   10/100/1000                       

# 进入特权模式
ceos>enable
ceos#show running-config interface Et1
interface Ethernet1
   description Connection to k01-control-plane
   switchport access vlan 10
ceos#
```

在cEos中支持简写网卡名称，因此以上等价于
```bash
ceos#show run int eth1
interface Ethernet4
   description Connection to k01-worker3
   switchport access vlan 20
```

|**<br><br>名称<br><br>**|**<br><br>类型<br><br>**|**<br><br>来源<br><br>**|
|---|---|---|
|`Ethernet1`|**正式接口名（canonical name）**​|cEOS 系统内部|
|`eth1`|**CLI 简写 / 别名**​|Arista EOS CLI 解析器|
对应关系如下

|**<br><br>正式名<br><br>**|**<br><br>合法简写<br><br>**|
|---|---|
|`Ethernet1`|`eth1`|
|`Ethernet2`|`eth2`|
|`Ethernet48`|`eth48`|
|`Management0`|❌ 不能简写成 `m0`|
#### 确认Layer 3 接口和IP路由信息
```bash
ceos#show ip interface brief
                                                                              Address
Interface         IP Address           Status       Protocol           MTU    Owner  
----------------- -------------------- ------------ -------------- ---------- -------
Management0       172.20.20.2/24       up           up                1500           
Vlan10            10.10.10.1/24        up           up                1500           
Vlan20            10.10.20.1/24        up           up                1500           

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
 C        10.10.20.0/24
           directly connected, Vlan20
 C        172.20.20.0/24
           directly connected, Management0
```

#### 查看网卡信息
```bash
ceos#show interface Management0
Management0 is up, line protocol is up (connected)
  Hardware is Ethernet, address is 001c.73a0.1847 (bia 001c.73a0.1847)
  Internet address is 172.20.20.2/24
  Broadcast address is 255.255.255.255
  IPv6 link-local address is fe80::21c:73ff:fea0:1847/64
  IPv6 global unicast address(es):
    3fff:172:20:20::2, subnet is 3fff:172:20:20::/64
  IP MTU 1500 bytes (default), BW 1000000 kbit
  Full-duplex, 1Gb/s, auto negotiation: on, uni-link: n/a
  Up 34 minutes, 47 seconds
  Loopback Mode : None
  3 link status changes since last clear
  Last clearing of "show interface" counters never
  5 minutes input rate 3 bps (0.0% with framing overhead), 0 packets/sec
  5 minutes output rate 64 bps (0.0% with framing overhead), 0 packets/sec
     37 packets input, 4236 bytes
     Received 0 broadcasts, 0 multicast
     0 runts, 0 giants
     0 input errors, 0 CRC, 0 alignment, 0 symbol, 0 input discards
     0 PAUSE input
     108 packets output, 19409 bytes
     Sent 0 broadcasts, 0 multicast
     0 output errors, 0 collisions
     0 late collision, 0 deferred, 0 output discards
     0 PAUSE output
ceos#show interface Vlan10
Vlan10 is up, line protocol is up (connected)
  Hardware is Vlan, address is 001c.7387.1801 (bia 001c.7387.1801)
  Description: Calico Network L3 Interface
  Internet address is 10.10.10.1/24
  Broadcast address is 255.255.255.255
  IP MTU 1500 bytes (default)
  Up 35 minutes, 15 seconds

```

#### 查看启动配置
完整配置见 交换机配置 章节
```bash
ceos#show running-config
```

### kind 集群配置

```yaml
apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
name: k01
networking:
  disableDefaultCNI: true
  podSubnet: "192.168.0.0/16"
  serviceSubnet: "10.96.0.0/16"

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

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.20.20"
```

### Calico VXLAN配置
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
      # 必须和kind中配置的podSubnet保持一致
      cidr: 192.168.0.0/16
      # Node 不封装，要求底层网络已经通Pod路由，通常需要BGP
      # IPIP 同/跨子网都走IPIP
      # VXLAN 同/跨子网都走VXLAN
      # VXLANCrossSubnet 同子网不封装，跨子网才走VXLAN
      encapsulation: VXLANCrossSubnet
      # Pod访问外网的是偶做SNAT
      natOutgoing: Enabled
      nodeSelector: all()
      disableBGPExport: true
    # 见  https://docs.tigera.io/calico/latest/networking/ipam/ip-autodetection
    # 遍历节点上所有接口的 IPv4 地址，找到第一个落在 `10.10.0.0/16` 范围内的 IP，把它作为节点 IP（NodeIP / VTEP IP） 
    # 避免多网卡机器上VXLAN等接口选错
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


## 环境检查
![[Pasted image 20260927115927.png]]

`ext-container 概念`
`ext-container` 是containerLab的一种节点类型，充当现有Docker容器的包装器，提供原始容器所不支持的额外网络配置能力
```bash
k01 (k8s-kind) creates:     ext-container wraps:
├── k01-control-plane  -->  k01-control-plane (ext-container)
├── k01-worker        -->  k01-worker (ext-container)
├── k01-worker2       -->  k01-worker2 (ext-container)
└── k01-worker3       -->  k01-worker3 (ext-container)
```

### 检查交换机配置

显示所有以太网接口的状态，包括每个端口连接到哪个kubernetes节点、VLAN分配 以及链路状态。
```bash
└─[$] <git:(master*)> docker exec -it clab-calico-overlay-ceos01 Cli
ceos>enable
ceos#interface status
% Invalid input
ceos#show interface status
Port       Name                            Status       Vlan     Duplex Speed  Type            Flags Encapsulation
Et1        Connection to k01-control-plane connected    10       full   1G     EbraTestPhyPort                   
Et2        Connection to k01-worker        connected    10       full   1G     EbraTestPhyPort                   
Et3        Connection to k01-worker2       connected    10       full   1G     EbraTestPhyPort                   
Et4        Connection to k01-worker3       connected    20       full   1G     EbraTestPhyPort                   
Ma0                                        connected    routed   a-full a-1G   10/100/1000                       

```

- `Et1 - Et3`: 连接到VLAN10(子网 10.10.10.0/24)中的控制平面和两个worker
- `Et4`: 连接到VLAN20(子网 10.10.20.0/24)中的worker3
- 所有链路均已up，并以1G速率运行

列出所有交换机接口及其分配的IP地址、操作状态和MTU。
```bash
ceos#show ip interface brief
                                                                              Address
Interface         IP Address           Status       Protocol           MTU    Owner  
----------------- -------------------- ------------ -------------- ---------- -------
Management0       172.20.20.2/24       up           up                1500           
Vlan10            10.10.10.1/24        up           up                1500           
Vlan20            10.10.20.1/24        up           up                1500           

```

- `VLAN10` 和 `VLAN20` 是两个子网的SVI(交换虚拟接口)接口，充当每个VLAN中节点的网关
- management0用于带外管理

#### 传统物理接口vs虚拟接口

| **<br><br>类型<br><br>** | **<br><br>例子<br><br>** | **<br><br>说明<br><br>** |
| ---------------------- | ---------------------- | ---------------------- |
| 物理接口                   | `Ethernet1`            | 真实插网线的口                |
| SVI（虚拟）                | `interface Vlan10`     | 软件定义的、逻辑上的接口           |
| **<br><br>词<br><br>**  | **<br><br>含义<br><br>** |                        |
| 交换                     | 这是一台交换机（cEOS）          |                        |
| 虚拟                     | 不是物理口，是软件创建的           |                        |
| 接口                     | 它有 IP、能收发三层包           |                        |
cEOS 本质上是一台**三层交换机**：

- 二层功能：VLAN、MAC 学习、access/trunk
- 三层功能：IP 路由、SVI、静态路由

SVI 就是**把二层 VLAN 和三层路由连接起来的桥梁**。

显示交换机路由表，展示直连网络

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
 C        10.10.20.0/24
           directly connected, Vlan20
 C        172.20.20.0/24
           directly connected, Management0

ceos#
```

- 交换机通过各自的VLAN接口拥有连个kubernetest节点子网(10.10.10.0/24和10.10.20.1/24)的直连路由
- 管理子网同样为直连
- 未设置默认路由，因此只有本地子网流量会被路由

### 拓扑图
![[Pasted image 20260927150249.png]]
- 相比较ocp的BGP邻里宣告，这里直接将eth1 --> VLAN10/VLAN20 的连接人为在交换机里面固定
- 节点之间通过Arista交换机进行连接
- 跨子网使用calico VXLAN 隧道技术来实现不同子网节点之间的通信
## Calico IPPool 资源
```bash
@andrew ➜ ~  kubectl get ippools default-ipv4-ippool -o yaml
apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
  creationTimestamp: "2026-09-26T11:49:28Z"
  generation: 1
  labels:
    app.kubernetes.io/managed-by: tigera-operator
  name: default-ipv4-ippool
  resourceVersion: "10230"
  uid: 487b8bbc-0cfe-4a2d-aa41-5c40c0b4bc2d
spec:
  allowedUses:
  - Workload
  - Tunnel
  assignmentMode: Automatic
  blockSize: 26
  cidr: 192.168.0.0/16
  disableBGPExport: true
  ipipMode: Never
  natOutgoing: true
  nodeSelector: all()
  vxlanMode: CrossSubnet
```

- allowedUses: 指定可以使用此IP池的流量类型。此处同时允许Workload(Pod)和Tunnel(叠加流量)
- cidr: 地址范围，定义分配Pod IP的地址范围(192.168.0.0/16)
- vxlanMode: 设置CrossSubnet，意味着VXLAN封装仅用于不同子网之间的流量，在优化性能的同时仍启用叠加网络

查看分配给各个子节点的块亲和性（block affinities）
```bash
@andrew ➜ ~  kubectl get blockaffinities -o=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.node}{"\t"}{.spec.cidr}{"\n"}{end}'
k01-control-plane-192-168-23-64-26      k01-control-plane       192.168.23.64/26
k01-worker-192-168-81-64-26     k01-worker      192.168.81.64/26
k01-worker2-192-168-164-128-26  k01-worker2     192.168.164.128/26
k01-worker3-192-168-209-64-26   k01-worker3     192.168.209.64/26
```

#### Encapsulation/Overlay Modes - 封装叠加模式
calico 支持以下封装类型
- `IP-in-IP`: 默认叠加网络模式，将Pod流量封装在IP-in-IP数据包中，用于跨节点通信
- VXLAN：使用VXLAN隧道封装Pod流量，实现跨不同子网或网络的通信。
- None：禁用叠加，要求底层网络直接路由Pod流量(无封装)
- WireGuard: 为叠加流量增加加密，实现节点之间安全通信

## 确认容器路由
>数据会随着kind的每次重启而不同

### 验证同一子网节点的容器路由
> 使用 `/26` 掩码进行过滤，使得输出结果符合 IPAM 块的亲和性要求；而使用 `/26` 掩码则能确保输出结果与 IPAM 块的亲和性保持一致。
```bash
@andrew ➜ ~  kubectl get blockaffinities -o=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.node}{"\t"}{.spec.cidr}{"\n"}{end}'
# 相同子网
k01-control-plane-192-168-23-64-26      k01-control-plane       192.168.23.64/26
k01-worker-192-168-81-64-26     k01-worker      192.168.81.64/26
k01-worker2-192-168-164-128-26  k01-worker2     192.168.164.128/26
# # 不同子网
k01-worker3-192-168-209-64-26   k01-worker3     192.168.209.64/26   

@andrew ➜ ~  docker exec -it  k01-worker /bin/bash
root@k01-worker:/# ip route |grep /26
# 进入 k01-control-plane 的流量，直接路由
192.168.23.64/26 via 10.10.10.10 dev eth1 proto 80 onlink 
blackhole 192.168.81.64/26 proto 80
# 进入 k01-worker2 的流量直接路由
192.168.164.128/26 via 10.10.10.12 dev eth1 proto 80 onlink 
# 进入 k01-worker3 的流量，因为跨子网，所有走VXLAN
192.168.209.64/26 via 192.168.209.64 dev vxlan.calico onlink  
```
以上路由演示了calico的CrossSubnet VXLAN模式：子网内直接路由
- 表明同一子网内节点Pod CIDR通过物理接口eth1直接路由
- `blackhole`(黑洞)条目表示节点本地的Pod CIDR
- 发往不同子网中Pod(192.168.209.64/26)的流量通过VXLAN叠加网络进行路由


查看 k01-worker2 子网路由，进行对比验证

```bash
@andrew ➜ ~  docker exec -it  k01-worker2 /bin/bash
root@k01-worker2:/# ip route | grep /26
# k01-control-plane 同子网
192.168.23.64/26 via 10.10.10.10 dev eth1 proto 80 onlink 
# k01-worker 同子网
192.168.81.64/26 via 10.10.10.11 dev eth1 proto 80 onlink 
blackhole 192.168.164.128/26 proto 80
# 跨子网的路由 
192.168.209.64/26 via 192.168.209.64 dev vxlan.calico onlink 
```
- 通过不同node上路由的再次确认，可以肯定通往同一子网其他节点的路由是直接的(via eth1)
- 到不同子网中节点的路由使用VXLAN封装
- Calico 通过避免不必要的叠加隧道优化了同一子网内的网络流量

## 验证同子网的流量
![[Pasted image 20260927162914.png]]
这里选择两个Pod，一个在k01-worker上，另外一个在k01-worker2上
```bash
NAME                                READY   STATUS    RESTARTS      AGE     IP                NODE                NOMINATED NODE   READINESS GATES
multitool-1-2wb86                   1/1     Running   0             7m27s   192.168.81.67     k01-worker          <none>           <none>
multitool-1-n2r5f                   1/1     Running   0             7m27s   192.168.164.133   k01-worker2         <none>           <none>
```

### 验证路由(ip forward)跳数
```bash
% kubectl exec -it multitool-1-2wb86 -- sh
/ # ping 192.168.164.133
PING 192.168.164.133 (192.168.164.133) 56(84) bytes of data.
64 bytes from 192.168.164.133: icmp_seq=1 ttl=62 time=0.984 ms
64 bytes from 192.168.164.133: icmp_seq=2 ttl=62 time=0.611 ms
64 bytes from 192.168.164.133: icmp_seq=3 ttl=62 time=0.598 ms
^C
--- 192.168.164.133 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2025ms
rtt min/avg/max/mdev = 0.598/0.731/0.984/0.178 ms
```
可以看到，ttl为62说明只经过两次路由(ip forward转发)，符合预计

### 按照网络topo对网络全链路进行转包验证
1. 进入 k01-worker 的Pod multitool-1-2wb86 去ping  k01-worker2上的multitool-1-n2r5f 
```bash
@andrew ➜ ~  kubectl exec -it multitool-1-2wb86 -- sh                 
/ # ping 192.168.164.133
PING 192.168.164.133 (192.168.164.133) 56(84) bytes of data.
64 bytes from 192.168.164.133: icmp_seq=1 ttl=62 time=0.479 ms
64 bytes from 192.168.164.133: icmp_seq=2 ttl=62 time=0.633 ms
64 bytes from 192.168.164.133: icmp_seq=3 ttl=62 time=0.557 ms
^C
--- 192.168.164.133 ping statistics ---
8 packets transmitted, 8 received, 0% packet loss, time 7188ms
rtt min/avg/max/mdev = 0.479/0.629/0.728/0.073 ms
/ # 
```

2.  进入 k01-worker 
```bash
[127] % docker ps
CONTAINER ID   IMAGE                  COMMAND                  CREATED        STATUS        PORTS                       NAMES
b0d5dc603d6f   kindest/node:v1.35.0   "/usr/local/bin/entr…"   22 hours ago   Up 19 hours                               k01-worker
% docker inspect b0d5dc603d6f |grep Pid
            "Pid": 2450,
            "PidMode": "",
            "PidsLimit": null,
% nsenter -t 2450 -n
nsenter: cannot open /proc/2450/ns/net: Permission denied
[1] % sudo nsenter -t 2450 -n
root@andrew:/home/andrew# tcpdump -nn -v -i eth1 icmp
tcpdump: listening on eth1, link-type EN10MB (Ethernet), snapshot length 262144 bytes
17:15:34.464528 IP (tos 0x0, ttl 63, id 5683, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12258, seq 487, length 64
17:15:34.465074 IP (tos 0x0, ttl 63, id 54974, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.164.133 > 192.168.81.67: ICMP echo reply, id 12258, seq 487, length 64
17:15:35.488510 IP (tos 0x0, ttl 63, id 5890, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12258, seq 488, length 64
17:15:35.489006 IP (tos 0x0, ttl 63, id 55344, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.164.133 > 192.168.81.67: ICMP echo reply, id 12258, seq 488, length 64
^C
4 packets captured
4 packets received by filter
0 packets dropped by kernel
root@andrew:/home/andrew# 
```
3. 进入 ceos
```bash
└─[$] <git:(master*)> docker ps                                     
CONTAINER ID   IMAGE                  COMMAND                  CREATED        STATUS        PORTS                       NAMES
553a3b3e592e   ceos:4.34.0F           "bash -c '/mnt/flash…"   22 hours ago   Up 6 hours                                clab-calico-overlay-ceos01
┌─[andrew@andrew] - [~/k8-networking-calico-containerlab/containerlab/06-calico-overlay] - [Sun Sep 27, 16:59]
└─[$] <git:(master*)> docker inspect 553a3b3e592e |grep Pid            
            "Pid": 1241263,
            "PidMode": "",
            "PidsLimit": null,
┌─[andrew@andrew] - [~/k8-networking-calico-containerlab/containerlab/06-calico-overlay] - [Sun Sep 27, 16:59]
└─[$] <git:(master*)> sudo nsenter -t 1241263 -n 
```

```bash
root@andrew:/home/andrew/k8-networking-calico-containerlab/containerlab/06-calico-overlay# tcpdump -nn -v -i eth2 icmp
tcpdump: listening on eth2, link-type EN10MB (Ethernet), snapshot length 262144 bytes
17:07:16.779976 IP (tos 0x0, ttl 63, id 7663, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12258, seq 1, length 64
17:07:16.780389 IP (tos 0x0, ttl 63, id 3634, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.164.133 > 192.168.81.67: ICMP echo reply, id 12258, seq 1, length 64
17:07:17.825501 IP (tos 0x0, ttl 63, id 8671, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12258, seq 2, length 64
^C
10 packets captured
10 packets received by filter
0 packets dropped by kernel
```

```bash
root@andrew:/home/andrew/k8-networking-calico-containerlab/containerlab/06-calico-overlay# tcpdump -nn -v -i eth3 icmp
tcpdump: listening on eth3, link-type EN10MB (Ethernet), snapshot length 262144 bytes
17:08:23.360824 IP (tos 0x0, ttl 63, id 40732, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12258, seq 66, length 64
17:08:23.360861 IP (tos 0x0, ttl 63, id 35601, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.164.133 > 192.168.81.67: ICMP echo reply, id 12258, seq 66, length 64
17:08:24.384838 IP (tos 0x0, ttl 63, id 41580, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12258, seq 67, length 64
^C
6 packets captured
6 packets received by filter
0 packets dropped by kernel
root@andrew:/home/andrew/k8-networking-calico-containerlab/containerlab/06-calico-overlay# 
```

4. 进入  multitool-1-n2r5f 
```bash
root@andrew:/home/andrew# tcpdump -nn -v -i eth1 icmp
tcpdump: listening on eth1, link-type EN10MB (Ethernet), snapshot length 262144 bytes
16:53:32.142001 IP (tos 0x0, ttl 63, id 44048, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12257, seq 1, length 64
16:53:32.142055 IP (tos 0x0, ttl 63, id 39303, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.164.133 > 192.168.81.67: ICMP echo reply, id 12257, seq 1, length 64
16:53:33.185163 IP (tos 0x0, ttl 63, id 44211, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.164.133: ICMP echo request, id 12257, seq 2, length 64
^C
10 packets captured
10 packets received by filter
0 packets dropped by kernel
root@andrew:/home/andrew# 
```

## 验证不同子内节点的Pod路由

查看node的子网
```bash
@andrew ➜ ~  kubectl get blockaffinities -o=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.node}{"\t"}{.spec.cidr}{"\n"}{end}'
# 相同子网
k01-control-plane-192-168-23-64-26      k01-control-plane       192.168.23.64/26
k01-worker-192-168-81-64-26     k01-worker      192.168.81.64/26
k01-worker2-192-168-164-128-26  k01-worker2     192.168.164.128/26
# # 不同子网
k01-worker3-192-168-209-64-26   k01-worker3     192.168.209.64/26   
```

### 查看 k01-worker 通向 k01-worker3的路由
```bash
[1] % docker exec -it  k01-worker /bin/bash                                                                              
root@k01-worker:/# 
root@k01-worker:/# ip addr | grep vxlan.calico
9: vxlan.calico: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 192.168.81.64/32 scope global vxlan.calico
root@k01-worker:/# 
root@k01-worker:/# 
root@k01-worker:/# ip route | grep 192.168.209.64
192.168.209.64 dev vxlan.calico scope link 
192.168.209.64/26 via 192.168.209.64 dev vxlan.calico onlink 
root@k01-worker:/# 
```

- ip addr输出确认vxlan.calico接口存在，并分配了来自Pod CIDR范围的IP。
- 路由表示，发往192.168.209.64/26 Pod CIDR（属于不同子网中的节点）的流量通过VXLAN叠加接口进行路由；而且`192.168.209.64/26 via 192.168.209.64 dev vxlan.calico onlink ` 确保所有到该Pod CIDR的流量都被封装并通过叠加网络进行发送。
- `192.168.209.64` 这个 IP 就在 `vxlan.calico` 接口上，直连可达; 使得VXLAN VETP在该接口上可以直接访问，因此数据包可以在不通过中间网关的情况下被封装起来。

> VETP(VXLAN  Tunnel Endpoint)


### 查看 k01-worker3 通向 k01-worker的路由

```bash
% docker exec -it  k01-worker3 /bin/bash                                                                                                          ~
root@k01-worker3:/# ip addr | grep vxlan.calico
14: vxlan.calico: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 192.168.209.64/32 scope global vxlan.calico
root@k01-worker3:/# 
root@k01-worker3:/# ip route | grep /26
192.168.23.64/26 via 192.168.23.64 dev vxlan.calico onlink 
192.168.81.64/26 via 192.168.81.64 dev vxlan.calico onlink 
192.168.164.128/26 via 192.168.164.128 dev vxlan.calico onlink 
blackhole 192.168.209.64/26 proto 80 
```
-  由于本节点和其他节点位于不同的子网，到其他节点Pod CIDR的所有路由都使用VXLAN叠加接口（vxlan.calico）
- 当跨子网的时候，匹配的都是vxlan.calico因此会自动进行VXLAN封装

![[Pasted image 20260927184155.png]]

直接在k01-worker3上的vxlan.calico网卡上抓包
```bash
root@andrew:/home/andrew# tcpdump -nn -v -i vxlan.calico 
tcpdump: listening on vxlan.calico, link-type EN10MB (Ethernet), snapshot length 262144 bytes
18:57:31.281095 IP (tos 0x0, ttl 63, id 63052, offset 0, flags [DF], proto TCP (6), length 52)
    192.168.23.73.7443 > 192.168.209.64.43249: Flags [.], cksum 0x772f (correct), ack 38919106, win 77, options [nop,nop,TS val 2329935597 ecr 925650410], length 0
18:57:31.281137 IP (tos 0x0, ttl 64, id 40890, offset 0, flags [DF], proto TCP (6), length 52)
    192.168.209.64.43249 > 192.168.23.73.7443: Flags [.], cksum 0x6a01 (incorrect -> 0x775d), ack 1, win 72, options [nop,nop,TS val 925665411 ecr 2329920554], length 0
18:57:31.522073 IP (tos 0x0, ttl 63, id 61599, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.209.69: ICMP echo request, id 12261, seq 445, length 64
18:57:31.522120 IP (tos 0x0, ttl 63, id 4485, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.209.69 > 192.168.81.67: ICMP echo reply, id 12261, seq 445, length 64
18:57:32.545121 IP (tos 0x0, ttl 63, id 62598, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.209.69: ICMP echo request, id 12261, seq 446, length 64
18:57:32.545166 IP (tos 0x0, ttl 63, id 4654, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.209.69 > 192.168.81.67: ICMP echo reply, id 12261, seq 446, length 64
18:57:32.682026 IP (tos 0x0, ttl 64, id 40891, offset 0, flags [DF], proto TCP (6), length 393)
```

- TTL 为 63 说明当前还只经过了对端主机的的FORWARD（原始为64）

在k01-worker3上的eth1(连接VLAN的接口)网卡上抓包
```bash
root@andrew:/home/andrew# tcpdump -nn -v -i eth1
tcpdump: listening on eth1, link-type EN10MB (Ethernet), snapshot length 262144 bytes
19:03:53.195505 STP 802.1s, Rapid STP, CIST Flags [Proposal, Learn, Forward, Agreement], length 102
        port-role Designated, CIST root-id 8000.00:1c:73:87:18:01, CIST ext-pathcost 0
        CIST regional-root-id 8000.00:1c:73:87:18:01, CIST port-id 8004,
        message-age 0.00s, max-age 20.00s, hello-time 2.00s, forwarding-delay 15.00s
        v3len 64, MCID Name , rev 0,
                digest ac36177f50283cd4b83821d8ab26de62, CIST int-root-pathcost 0,
        CIST bridge-id 8000.00:1c:73:87:18:01, CIST remaining-hops 20
19:03:53.409016 IP (tos 0x0, ttl 63, id 44609, offset 0, flags [none], proto UDP (17), length 134)
    10.10.10.11.39883 > 10.10.20.20.4789: VXLAN, flags [I] (0x08), vni 4096
IP (tos 0x0, ttl 63, id 4511, offset 0, flags [DF], proto ICMP (1), length 84)
    192.168.81.67 > 192.168.209.69: ICMP echo request, id 12261, seq 822, length 64
19:03:53.409078 IP (tos 0x0, ttl 64, id 14230, offset 0, flags [none], proto UDP (17), length 134)
    10.10.20.20.39883 > 10.10.10.11.4789: VXLAN, flags [I] (0x08), vni 4096
IP (tos 0x0, ttl 63, id 56816, offset 0, flags [none], proto ICMP (1), length 84)
    192.168.209.69 > 192.168.81.67: ICMP echo reply, id 12261, seq 822, length 64
^C
9 packets captured
11 packets received by filter
0 packets dropped by kernel
```

|**<br><br>维度<br><br>**|**<br><br>vxlan.calico 上看到<br><br>**|**<br><br>eth1 上看到<br><br>**|
|---|---|---|
|IP 层|`192.168.x.x`（Pod IP）|`10.10.x.x`（节点 IP）|
|协议|ICMP / TCP（原始）|UDP 4789（VXLAN）|
|TTL|63（内层原始值）|63/64（外层）|
|封装|无（已解封）|VXLAN 封装|
|cEOS 能看到|❌ 看不到这个接口|✅ 只看到 eth1 的包|

## VXLAN转发
- Remote VTEP discovery: Calico 通过其控制平面学习远端的VETP地址，并将特定的Pod CIDR指向 vxlan.calico的主机路由
- ingress classfication: 当数据包到达VXLAN接口时，内核执行FDB查找，将目的MAC映射到远端VTEP
- Encapsulation(封装)： Linux用VXLAN头部以及外层Ethernet/IP/UDP（默认UDP端口4789）封装原始帧，并携带VNID。
- Underlay routing: 外层数据包像其他任何IP数据包一样，使用节点的常规路由表向远端VETP路由
- Decapsulation and delivery(解封装与交付)：远端主机剥离外层头部，还原内层帧，并将其交给绑定到目录Pod的本地桥接或接口

### 验证VXLAN转发
1. 先进入 k01-worker3
```bash
% docker exec -it  k01-worker3 /bin/bash
root@k01-worker3:/# ip link show type vxlan
14: vxlan.calico: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
    link/ether 66:d2:0c:f0:ef:e5 brd ff:ff:ff:ff:ff:ff
root@k01-worker3:/# 
```

2. 确认 vxlan.calico 管理状态为up且链路已经up(`LOWER_UP`)，因此内核可以从该接口发起VXLAN封装。该行为还暴露了接口MAC，它将成为封装流量外层以太网源地址。
```bash
root@k01-worker3:/# ip neighbor show | grep vxlan
192.168.164.128 dev vxlan.calico lladdr 66:c7:4d:6e:6b:f3 PERMANENT 
192.168.81.64 dev vxlan.calico lladdr 66:fb:ad:98:aa:13 PERMANENT 
192.168.23.64 dev vxlan.calico lladdr 66:15:9d:fa:c6:aa PERMANENT 
```

 3. Calico 将这些邻居条目编程为 `PERMANENT`，将每个远端 Pod CIDR 的网关 IP 固定绑定到 `vxlan.calico` 上对应的 VTEP MAC。这使内核可以跳过 ARP 解析，立即为隧道数据包构建外层以太网头。
```bash
root@k01-worker3:/# bridge fdb show | grep 66:fb:ad:98:aa:13
66:fb:ad:98:aa:13 dev vxlan.calico dst 10.10.10.11 self permanent
root@k01-worker3:/# 
```

桥接FDB将该MAC关联到远端VETP的 Underlay IP(10.10.10.11), 因此在邻居查找之后，内核便知道 UDP VXLAN 数据包应使用哪个底层目的地址。结合静态邻居条目，这便闭合了从内层目的 MAC(`66:fb:ad:98:aa:13`) 到远端 VTEP IP 的转发环路。

也就是说，根据以上信息，我们就能得到远端的VETP vxlan.calico 的IP地址是 `192.168.81.64`， MAC是 `66:fb:ad:98:aa:13`， 内层网络所需的数据已经全部完整，然后根据静态路由获取外层网络的信息，就能完成对VXLAN数据的封装。

综合来看，它们展示了内核的转发决策链：数据包到达 vxlan.calico，FDB 条目匹配目的 MAC→远端 VTEP IP，邻居表确认 VTEP IP→MAC 解析，从而可以进行封装。





