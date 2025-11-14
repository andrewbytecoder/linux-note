## calico
Calico 是一个 CNI 插件，为 Kubernetes 集群提供容器网络。它使用 Linux 原生工具来促进流量路由和执行网络策略。它还托管一个 BGP 守护进程，用于将路由分发到其他节点。Calico 的工具作为 DaemonSet 在 Kubernetes 集群上运行。这使管理员能够安装 Calico， `kubectl apply -f ${CALICO_MANIFESTS}.yaml` 而无需设置额外的服务或基础设施。
每个部分都涵盖架构建议，有时还包括 Calico 部署中每个问题的配置。在高层次上，主要建议是：
1. 使用 Kubernetes 数据存储。
2. 安装 Typha 以确保数据存储可扩展性。
3. 对单个子网集群不使用封装。
4. 对于多子网集群，在 CrossSubnet 模式下使用 IP-in-IP。
5. 根据网络 MTU 和选择的路由模式配置 Calico MTU。
6. 为能够增长到 50 个以上节点的集群添加全局路由反射器。
7. 将 GlobalNetworkPolicy 用于集群范围的入口和出口规则。通过添加 namespace-scoped 来修改策略NetworkPolicy。

![[Pasted image 20251111145103.png]]

> 注意VxLAN模式不需要BGP协议参与！！！但是IPIP模式是需要的。

### 优缺点
- calico的好处是endpoints组成的网络是单纯的三层网络，报文的流向完全通过路由规则控制，没有overlay等额外开销。
- calico的endpoint可以漂移，并且实现了acl。
- calico的缺点是路由的数目与容器数目相同，非常容易超过路由器、三层交换、甚至node的处理能力，从而限制了整个网络的扩张。
- calico的每个node上会设置大量（海量)的iptables规则、路由，运维、排障难度大。
- calico的原理决定了它不可能支持VPC，容器只能从calico设置的网段中获取ip。
- calico目前的实现没有流量控制的功能，会出现少数容器抢占node多数带宽的情况。
- calico的网络规模受到BGP网络规模的限制。

### calico 组件

Calico组件主要架构由Felix、Confd、BIRD组成

- Felix 运行在每一台 Host 的 agent 进程，Felix负责刷新主机路由和ACL规则等，以便为该主机上的 Endpoint 正常运行提供所需的网络连接和管理。进出容器、虚拟机和物理主机的所有流量都会遍历Calico，利用Linux内核原生的路由和iptables生成的规则。是负责Calico Node运行并作为每个节点Endpoint端点的守护程序，它负责管理当前主机中的Pod信息，与集群etcd服务交换集群Pod信息，并组合路由信息和ACL策略。
- Confd是负责存储集群etcd生成的Calico配置信息，提供给BIRD层运行时使用。
- BIRD（BIRD Internet Routing Daemon）是核心组件，Calico中的BIRD特指BIRD Client和BIRD Route Reflector，负责主动读取Felix在本机上设置的路由信息，并通过BGP广播协议在数据中心中进行分发路由
- etcd, the data store
felix 负责管理设置node
bird是一个开源软路由，支持多种路由协议


### BGP基础概念
- 定义
边界网关协议BGP（Border Gateway Protocol）是一种实现自治系统AS（Autonomous System）之间的路由可达，并选择最佳路由的距离矢量路由协议。早期发布的三个版本分别是BGP-1、BGP-2和BGP-3，1994年开始使用BGP-4，2006年之后单播IPv4网络使用的版本是BGP-4，其他网络（如IPv6等）使用的版本是MP-BGP。

MP-BGP是对BGP-4进行了扩展，来达到在不同网络中应用的目的，BGP-4原有的消息机制和路由机制并没有改变。MP-BGP在IPv6单播网络上的应用称为BGP4+，在IPv4组播网络上的应用称为MBGP（Multicast BGP）。

- 目的
为方便管理规模不断扩大的网络，网络被分成了不同的自治系统。1982年，外部网关协议EGP（Exterior Gateway Protocol）被用于实现在AS之间动态交换路由信息。但是EGP设计得比较简单，只发布网络可达的路由信息，而不对路由信息进行优选，同时也没有考虑环路避免等问题，很快就无法满足网络管理的要求。
BGP是为取代最初的EGP而设计的另一种外部网关协议。不同于最初的EGP，BGP能够进行路由优选、避免路由环路、更高效率的传递路由和维护大量的路由信息。
虽然BGP用在AS之间传递路由信息，但并非所有AS之间传递路由信息都要运行BGP。如数据中心上行到Internet的出口上，为了避免Internet海量路由对数据中心内部网络影响，设备采用静态路由代替BGP与外部网络通信。

- 受益
BGP从多方面保证了网络的安全性、灵活性、稳定性、可靠性和高效性：
BGP采用认证和GTSM的方式，保证了网络的安全性。
BGP提供了丰富的路由策略，能够灵活的进行路由选路，并且能指导邻居按策略发布路由。
BGP提供了路由聚合和路由衰减功能用于防止路由振荡，有效提高了网络的稳定性。
BGP使用TCP作为其传输层协议（端口号为179），并支持BGP与BFD联动、BGP Tracking和BGP GR和NSR，提高了网络的可靠性。
在邻居数目多、路由量大且大多邻居有相同出口策略场景下，BGP用按组打包技术极大提高了BGP打包发包性能。




### BGP Speaker 全互联模式(node-to-node mesh)
全互联模式，就是一个BGP Speaker需要与其它所有的BGP Speaker建立bgp连接(形成一个bgp mesh)。
网络中bgp总连接数是按照O(n^2)增长的，有太多的BGP Speaker时，会消耗大量的连接。
calico默认使用全互联的方式，扩展性比较差，只能支持小规模集群:

> say 50 nodes - although this limit is not set in stone and Calico has been deployed with over 100 nodes in a full mesh topology

可以打开/关闭全互联模式：
```bash
calicoctl config set nodeTonodeMesh off
calicoctl config set nodeTonodeMesh on
```

### BGP Speaker RR模式


RR模式，就是在网络中指定一个或多个BGP Speaker作为Router Reflection，RR与所有的BGP Speaker建立BGP连接。
每个BGP Speaker只需要与RR交换路由信息，就可以得到全网路由信息。
RR则必须与所有的BGP Speaker建立BGP连接，以保证能够得到全网路由信息。
在calico中可以通过Global Peer实现RR模式。
Global Peer是一个BGP Speaker，需要手动在calico中创建，所有的node都会与Global peer建立BGP连接。

路由反射器RR（Route Reflector）：允许把从IBGP对等体学到的路由反射到其他IBGP对等体的BGP设备，类似OSPF网络中的DR。
客户机（Client）：与RR形成反射邻居关系的IBGP设备。在AS内部客户机只需要与RR直连。
非客户机（Non-Client）：既不是RR也不是客户机的IBGP设备。在AS内部非客户机与RR之间，以及所有的非客户机之间仍然必须建立全连接关系。
始发者（Originator）：在AS内部始发路由的设备。Originator_ID属性用于防止集群内产生路由环路。
集群（Cluster）：路由反射器及其客户机的集合。Cluster_List属性用于防止集群间产生路由环路。

![[Pasted image 20251112184253.png]]

对以上三张图的解说：
1. 如果路由学习自非Client IBGP的对等体，则反射给所有Client。
   理解：R2从R3学习到路由，由于水平分割的原理，所以它不会把路由通告给R5。

2. 如果路由学习自Client，则反射给所有非Cilent的IBGP对等体，和除了自己以外的Client。
    正常路由学习

3. 如果路由学习自EBGP对等体，则发送给所有的Client和非Client对等体
   正常路由学。BGP 的全连接，实现路由全部学习到。


>A global BGP peer is a BGP agent that peers with every calico node in the network. A typical use case for a global peer might be a mid-scale deployment where all ofthe calico nodes are on the same L2 network and are each peering with the same Route Reflector (or set of Route Reflectors).

**关闭了全互联模式后，再将RR作为Global Peers添加到calico中**，calico网络就切换到了RR模式，可以支撑容纳更多的node。
calico中也可以通过node Peer手动构建BGP Speaker（也就是node）之间的BGP连接。
node Peer就是手动创建的BGP Speaker，只有指定的node会与其建立连接。

>A BGP peer can also be added at the node scope, meaning only a single specified node will peer with it. BGP peer resources of this nature must specify a node to inform calico which node this peer is targeting.


因此，可以为每一个node指定不同的BGP Peer，实现更精细的规划。
例如当集群规模进一步扩大的时候，可以使用[AS Per Pack model](http://docs.projectcalico.org/v2.1/reference/private-cloud/l3-interconnect-fabric#the-as-per-rack-model "AS Per Rack model"):

每个机架是一个AS
node只与所在机架TOR交换机建立BGP连接
TOR交换机之间作为各自的ebgp全互联

### OSPF介绍
开放式最短路径优先OSPF（Open Shortest Path First）是IETF组织开发的一个基于链路状态的内部网关协议。目前针对IPv4协议使用的是OSPF Version 2（RFC2328）；针对IPv6协议使用OSPF Version 3（RFC2740）。如无特殊说明，本文中所指的OSPF均为OSPF Version 2。

- 目的
在OSPF出现前，网络上广泛使用RIP（Routing Information Protocol）作为内部网关协议。
由于RIP是基于距离矢量算法的路由协议，存在着收敛慢、路由环路、可扩展性差等问题，所以逐渐被OSPF取代。
OSPF作为基于链路状态的协议，能够解决RIP所面临的诸多问题。此外，OSPF还有以下优点：
OSPF采用组播形式收发报文，这样可以减少对其它不运行OSPF路由器的影响。
OSPF支持无类型域间选路（CIDR）。
OSPF支持对等价路由进行负载分担。
OSPF支持报文加密。
由于OSPF具有以上优势，使得OSPF作为优秀的内部网关协议被快速接收并广泛使用

- 特点
OSPF把自治系统AS（Autonomous System）划分成逻辑意义上的一个或多个区域；
OSPF通过LSA（Link State Advertisement）的形式发布路由；
OSPF依靠在OSPF区域内各设备间交互OSPF报文来达到路由信息的统一；
OSPF报文封装在IP报文内，可以采用单播或组播的形式发送。

- 邻居状态机
在OSPF网络中，为了交换路由信息，邻居设备之间首先要建立邻接关系，邻居（Neighbors）关系和邻接（Adjacencies）关系是两个不同的概念。
邻居关系：OSPF设备启动后，会通过OSPF接口向外发送Hello报文，收到Hello报文的OSPF设备会检查报文中所定义的参数，如果双方一致就会形成邻居关系，两端设备互为邻居。
邻接关系：形成邻居关系后，如果两端设备成功交换DD报文和LSA，才建立邻接关系。
OSPF共有8种状态机，分别是：Down、Attempt、Init、2-way、Exstart、Exchange、Loading、Full。
Down：邻居会话的初始阶段，表明没有在邻居失效时间间隔内收到来自邻居路由器的Hello数据包。
Attempt：该状态仅发生在NBMA网络中，表明对端在邻居失效时间间隔（dead interval）超时前仍然没有回复Hello报文。此时路由器依然每发送轮询Hello报文的时间间隔（poll interval）向对端发送Hello报文。
Init：收到Hello报文后状态为Init。
2-way：收到的Hello报文中包含有自己的Router ID，则状态为2-way；如果不需要形成邻接关系则邻居状态机就停留在此状态，否则进入Exstart状态。
Exstart：开始协商主从关系，并确定DD的序列号，此时状态为Exstart。
Exchange：主从关系协商完毕后开始交换DD报文，此时状态为Exchange。
Loading：DD报文交换完成即Exchange done，此时状态为Loading。
Full：LSR重传列表为空，此时状态为Full。

### calico 网络部署
calico网络对底层的网络的要求很少，只要求node之间能够通过IP联通。
在calico中，全网路由的数目和endpoints的数目一致，通过为node分配网段，可以减少路由数目，但不会改变数量级。
如果有1万个endpoints，那么就至少要有一台能够处理1万条路由的设备。
无论用哪种方式部署始终会有一台设备上存放着calico全网的路由。
当要部署calico网络的时候，第一步就是要确认，网络中处理能力最强的设备最多能设置多少条路由。

#### calico在Ethernet interconnect fabric中的部署方式
[calico over an Ethernet interconnect fabric](http://docs.projectcalico.org/v2.1/reference/private-cloud/l2-interconnect-fabric "calico over an Ethernet interconnect fabric")中介绍了在Ethernet interconnect fabric部署calico网络方案。在每个vlan中部署一套calico。
![[Pasted image 20250912173841.png]]
为了保证链路可靠，图中设计了四个并列的二层网，形成fabric。
每个node同时接入四个二层网络，对应拥有四个不同网段的IP。
在每个二层网络中，node与node之间用RR模式建立BGP通信链路:

有四个网段，路由等价，那么进行数据分流的时候会进行平均分配，这样能增加网络的吞吐能力
当从node上去访问另一个node上的endpoint的时候，会有四条下一跳为不同网段的等价路由。
根据[ECMP](https://en.wikipedia.org/wiki/Equal-cost_multi-path_routing "ECMP")协议，报文将会平均分配给这四个等价路由，提高了可靠性的同时增加了网络的吞吐能力

#### calico在ip fabric中的部署方式
如果底层的网络是ip fabric的方式，三层网络是可靠的，只需要部署一套calico。

剩下的关键点就是怎样设计BGP网络，[calico over ip fabrics](https://docs.projectcalico.org/v2.1/reference/private-cloud/l3-interconnect-fabric "calico over ip fabrics")中给出两种设计方式:
1. AS per rack:   每个rack(机架)组成一个AS，每个rack的TOR交换机与核心交换机组成一个AS
2. AS per server: 每个node做为一个AS，TOR交换机组成一个transit AS
这两种方式采用的是[Use of BGP for routing in large-scale data centers](https://tools.ietf.org/html/draft-ietf-rtgwg-bgp-routing-large-dc-11 "Use of BGP for routing in large-scale data centers")中的建议。

##### AS per rack
1. 一个机架作为一个AS，分配一个AS号，node是ibgp，TOR交换机是ebgp
2. node只与TOR交换机建立BGP连接，TOR交换机与机架上的所有node建立BGP连接 
3. 所有TOR交换机之间以node-to-node mesh方式建立BGP连接

TOR交换机之间可以是接入到同一个核心交换机二层可达的，也可以只是IP可达的。

TOR二层联通:
![[Pasted image 20250912175646.png]]



TOR三层联通：
![[Pasted image 20250912175656.png]]

每个机架上node的数目是有限的，BGP压力转移到了TOR交换机。当机架数很多，TOR交换机组成BGP mesh压力会过大。
```
EndpointA发出报文  --> nodeA找到了下一跳地址nodeB --> 报文送到TOR交换机A --> 报文送到核心交换机
                                                                                      |
                                                                                      v
EndpointB收到了报文 <--  nodeB收到了报文 <-- TOR交换机B收到了报文 <--  核心交换机将报文送达TOR交换机B
```

###### AS per server
1. 每个TOR交换机占用一个AS
2. 每个node占用一个AS
3. node与TOR交换机交换BGP信息
4. 所有的TOR交换机组成BGP mesh，交换BGP信息
这种方式消耗了大量的AS，[RFC 4893 - BGP Support for Four-octet AS Number Space](http://www.faqs.org/rfcs/rfc4893.html "RFC 4893 - BGP Support for Four-octet AS Number Space")中考虑将AS号增加到32位。

不是特别明白这种方式的好处在哪里。

TOR二层联通:
![[Pasted image 20250912180507.png]]
TOR三层联通:
![[Pasted image 20250912180900.png]]
#### 优化：“Downward Default model”减少需要记录的路由
Downward Default Model在上面的几种组网方式的基础上，优化了路由的管理。
在上面的三种方式中，每个node、每个TOR交换机、每个核心交换机都需要记录全网路由。
“Downward Default model”模式中:
1. 每个node向上(TOR)通告所有路由信息，而TOR向下(node)只通告一条默认路由
2. 每个TOR向上(核心交换机)通告所有路由，核心交换机向下(TOR)只通告一条默认路由
3. node只知晓本地的路由
4. TOR只知道接入到自己的所有node上的路由
5. 核心交换机知晓所有的路由
这种模式减少了TOR交换机和node上的路由数量，但缺点是，发送到无效IP的流量必须到达核心交换机以后，才能被确定为无效。

endpoints之间的通信过程:

```
EndpointA发出报文  --> nodeA默认路由到TOR交换机A --> TOR交换机A默认路由到核心交换机 --------+
                                                                                      |
                                                                                      v
EndpointB收到了报文 <--  nodeB收到了报文 <-- TOR交换机B收到了报文 <-- 核心交换机找到了下一跳地址nodeB
```

## calico 中的概念

1. IPIP
2. VxLan (Mac in UDP)
3. BGP FullMesh(native Routing(BGP))
4. BGP RR(Router Reflator) (BGP FullMesh enhancement)
5. eBPF Backend(TC/eBPF redirect) with IPIP
6. Calico VPP(Cisco opensource) (矢量路由)

[calicoctl resource definitions](http://docs.projectcalico.org/v2.1/reference/calicoctl/resources/ "calicoctl resource definitions")介绍了每类资源的格式。

### bgpPeer
```yaml
apiVersion: v1
kind: bgpPeer
metadata:
  scope: node
  node: rack1-host1
  peerIP: 192.168.1.1
spec:
  asNumber: 63400
```
bgpPeer的scope可以是node、global。
### ipPool
```yaml
apiVersion: v1
kind: ipPool
metadata:
  cidr: 10.1.0.0/16
spec:
  ipip:
    enabled: true
    mode: cross-subnet
  nat-outgoing: true
  disabled: false
```

### node
```yaml
apiVersion: v1
kind: node
metadata:
  name: node-hostname
spec:
  bgp:
    asNumber: 64512
    ipv4Address: 10.244.0.1/24
    ipv6Address: 2001:db8:85a3::8a2e:370:7334/120
```

### policy

A Policy resource (policy) represents an ordered set of rules which are applied to a collection of endpoints which match a label selector.

Policy resources can be used to define network connectivity rules between groups of calico endpoints and host endpoints, and take precedence over Profile resources if any are defined.

```yaml
apiVersion: v1
kind: policy
metadata:
  name: allow-tcp-6379
spec:
  selector: role == 'database'
  ingress:
  - action: allow
    protocol: tcp
    source:
      selector: role == 'frontend'
    destination:
      ports:
      - 6379
  egress:
  - action: allow
```

### profile

A Profile resource (profile) represents a set of rules which are applied to the individual endpoints to which this profile has been assigned.

```yaml
apiVersion: v1
kind: profile
metadata:
  name: profile1
  labels:
    profile: profile1 
spec:
  ingress:
  - action: deny
    source:
      net: 10.0.20.0/24
  - action: allow
    source:
      selector: profile == 'profile1'
  egress:
  - action: allow 
```

### workloadEndpoint

A Workload Endpoint resource (workloadEndpoint) represents an interface connecting a calico networked container or VM to its host.

```yaml
apiVersion: v1
kind: workloadEndpoint
metadata:
  name: eth0 
  workload: default.frontend-5gs43
  orchestrator: k8s
  node: rack1-host1
  labels:
    app: frontend
    calico/k8s_ns: default
spec:
  interfaceName: cali0ef24ba
  mac: ca:fe:1d:52:bb:e9 
  ipNetworks:
  - 192.168.0.0/16
  profiles:
  - profile1
```

### hostEndpoint

```yaml
apiVersion: v1
kind: hostEndpoint
metadata:
  name: eth0
  node: myhost
  labels:
    type: production
spec:
  interfaceName: eth0
  expectedIPs:
  - 192.168.0.1
  - 192.168.0.2
  profiles:
  - profile1
  - profile2
```

## node的报文处理过程

报文处理过程中使用的标记位：

一共使用了3个标记位，0x7000000对应的标记位
0x1000000:  报文的处理动作，置1表示放行，默认0表示拒绝
0x2000000:  是否已经经过了policy规则检测，置1表示已经过
0x4000000:  报文来源，置1，表示来自host-endpoint

流入报文来源:

1. 以cali+命名的网卡收到的报文，这部分报文是node上的endpoint发出的
   (k8s中，容器的内发出的所有报文都会发送到对应的cali网卡上)
   (通过在容器内添加静态arp，将容器网关的IP映射到cali网卡的MAC上实现)
2. 其他网卡接收的报文，这部分报文是其它node发送或者在node本地发出的


流入的报文去向：

1. 访问本node的host endpoint，通过INPUT过程处理
2. 访问本node的workload endpoint，通过INPUT过程处理
3. 访问其它node的host endpoint，通过FORWARD过程处理。
4. 访问其它node的workload endpoint，通过FORWARD过程处理。


流入的报文在路由决策之前的处理过程相同的，路由决策之后，分别进入INPUT规则链和FORWARD链。

```
raw.PREROUTING -> mangle.PREROUTING -> nat.PREROUTING -> mangle.INPUT -> filter.INPUT 
raw.PREROUTING -> mangle.PREROUTING -> nat.PREROUTING -> mangle.FORWARD -> filter.FORWARD -> mangle.POSTROUTING -> nat.POSTROUTING
```

> 这里分析的calico的版本比较老，和最新版中的规则有一些出入，但是原理相同。

> 新版本的calico的iptables规则可读性更好，可以直接阅读规则。

报文处理流程（全):

```bash
from-XXX: XXX发出的报文            tw: 简写，to wordkoad endpoint
to-XXX: 发送到XXX的报文            po: 简写，policy outbound
cali-: 前缀，calico的规则链        pi: 简写，policy inbound
wl: 简写，workload endpoint        pro: 简写，profile outbound
fw: 简写，from workload endpoint   pri: 简写，profile inbound

(receive pkt)
cali-PREOUTING@raw -> cali-from-host-endpoint@raw -> cali-PREROUTING@nat
                   |                                 ^        |
                   |          (-i cali+)             |        |
                   +--- (from workload endpoint) ----+        |
                                                              |
            (dest  may be container's floating ip)   cali-fip-dnat@nat
                                                              |
                                                     (rotuer decision)
                                                              |
                     +--------------------------------------------+
                     |                                            |
            cali-INPUT@filter                             cali-FORWARD@filter
         (-i cali+)  |                               (-i cali+)   |    (-o cali+)
         +----------------------------+              +------------+-------------+
         |                            |              |            |             |
 cali-wl-to-host           cali-from-host-endpoint   |  cali-from-host-endpoint |
     @filter                       @filter           |         @filter          |
         |                         < END >           |            |             |
         |                                           |   cali-to-host-endpoint  |
         |                                           |         @filter          |
         |                     will return to nat's  |         < END >          |
         |                       cali-POSTROUTING    |                          |
 cali-from-wl-dispatch@filter  <---------------------+   cali-to-wl-dispatch@filter
                      |         \--------------+                       |
          +-----------------------+            |           +----------------------+
          |                       |            |           |                      |
 cali-fw-cali0ef24b1     cali-fw-cali0ef24b2   |  cali tw-cali03f24b1   cali-tw-cali03f24b2
      @filter                 @filter          |       filter                  @filter
  (-i cali0ef24b1)          (-i cali0ef24b2)   |   (-o cali0ef24b1)        (-o cali0ef24b2)
          |                       |            |           |                      |
          +-----------------------+            |           +----------------------+
                      |                        |                       |
           cali-po-[POLICY]@filter             |            cali-pi-[POLICY]@filter
                      |                        |                       |
          cali-pro-[PROFILE]@filter            |           cali-pri-[PROFILE]@filter
                      |                        |                       |
                   < END >                     +------------> cali-POSTROUTING@nat
                                               +---------->/           |
                                               |                cali-fip-snat@nat
                                               |                       |
                                               |              cali-nat-outgoing@nat
                                               |                       |
                                               |       (if dip is local: send to lookup)
                                     +---------+--------+   (else: send to nic's qdisc)
                                     |                  |           < END >    
                     cali-to-host-endpoint@filter       | 
                                     |                  | 
                                     +------------------+ 
                                               ^ (-o cali+)
                                               | 
                                       cali-OUTPUT@filter
                                               ^    
(send pkt)                                     | 
(router descition) -> cali-OUTPUT@nat -> cali-fip-dnat@nat
```

node本地发出的报文，经过路由决策之后，直接进入raw,OUTPUT规则链:

```bash
raw.OUTPUT -> mangle.OUTPUT -> nat.OUTPUT -> filter.OUTPUT -> mangle.POSTROUTING -> nat.POSTROUTING
```

### 路由决策之前：流入node的报文的处理

#### 进入raw表

PREROUTING@raw:

```bash
-A PREROUTING -m comment --comment "cali:6gwbT8clXdHdC1b1" -j cali-PREROUTING
```

cali-PREROUTING@RAW:

```
-A cali-PREROUTING -m comment --comment "cali:x4XbVMc5P_kNXnTy" -j MARK --set-xmark 0x0/0x7000000
-A cali-PREROUTING -i cali+ -m comment --comment "cali:fQeZek80kVOPa0xO" -j MARK --set-xmark 0x4000000/0x4000000
-A cali-PREROUTING -m comment --comment "cali:xp3NolkIpulCQL_G" -m mark --mark 0x0/0x4000000 -j cali-from-host-endpoint
-A cali-PREROUTING -m comment --comment "cali:fbdE50A0BiINbNiA" -m mark --mark 0x1000000/0x1000000 -j ACCEPT

规则1，清空所有标记
规则2，从cali+网卡进入的报文，设置mark: 0x4000000/0x4000000
规则3，非cali+网卡收到的报文，即从host-endpoint进入的报文，进入cali-from-host-endpoints规则链条
```

这里没有设置host-endpoint的策略，所有cali-from-host-endpoint规则链是空的。

#### 进入nat表

PREROUTING@nat:

```
-A PREROUTING -m comment --comment "cali:6gwbT8clXdHdC1b1" -j cali-PREROUTING
-A PREROUTING -m addrtype --dst-type LOCAL -j DOCKER

直接进入cali-PREROUTING
```

cali-PREROUTING@nat:

```
-A cali-PREROUTING -m comment --comment "cali:r6XmIziWUJsdOK6Z" -j cali-fip-dnat

如果目标地址是fip(floating IP)，会在cali-fip-dnat中做dnat转换
```

nat表中做目的IP转换，这里没有设置，所以cali-fip-dnat是空的。

经过nat表之后，会进行路由决策:

```
1. 如果是发送给slave1的报文，经过规则链: INPUT@mangle、INPUT@filter
2. 如果不是发送给slave1报文，经过规则链: FORWARD@mangle、FORWARD@filer、POSTROUTING@mangle、POSTROUTING@nat
```

### 路由决策之后：发送到本node的host endpoint 和 workload endpoint

#### 进入filter表

INPUT@filter:

```
-A INPUT -m comment --comment "cali:Cz_u1IQiXIMmKD4c" -j cali-INPUT

直接进入cali-INPUT
```

cali-INPUT@filter:

```
-A cali-INPUT -m comment --comment "cali:46gVAqzWLjH8U4O2" -m mark --mark 0x1000000/0x1000000 -m conntrack --ctstate UNTRACKED -j ACCEPT
-A cali-INPUT -m comment --comment "cali:5M2EkEm-RVlDLAfE" -m conntrack --ctstate INVALID -j DROP
-A cali-INPUT -m comment --comment "cali:8ggYjLbFRX5Ap9Zj" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A cali-INPUT -i cali+ -m comment --comment "cali:mA3ZJKi9nadUmYVF" -g cali-wl-to-host

-A cali-INPUT -m comment --comment "cali:hI4IjifGj0fegLPE" -j MARK --set-xmark 0x0/0x7000000
-A cali-INPUT -m comment --comment "cali:wdegoKfPlcmsZTOM" -j cali-from-host-endpoint
-A cali-INPUT -m comment --comment "cali:r875VVc8vFk1f-ZA" -m comment --comment "Host endpoint policy accepted packet." -m mark --mark 0x1000000/0x1000000 -j ACCEPT

规则4，从cali+网卡进入的报文，进入wl-to-host的规则链，wl是workload的缩
规则6，非cali+网卡收到的报文，host-endpoint的规则链
```

##### 来自其它node的报文

这里没有对host endpoint设置规则，所以规则链时空

cali-from-host-endpoint@filter:

```
空
```

##### 来自本node上workload endpoint的报文

检察一下是否允许workload enpoint发出这些报文。

cali-wl-to-host@filter:

```
-A cali-wl-to-host -p udp -m comment --comment "cali:aEOMPPLgak2S0Lxs" -m multiport --sports 68 -m multiport --dports 67 -j ACCEPT
-A cali-wl-to-host -p udp -m comment --comment "cali:SzR8ejPiuXtFMS8B" -m multiport --dports 53 -j ACCEPT
-A cali-wl-to-host -m comment --comment "cali:MEmlbCdco0Fefcrw" -j cali-from-wl-dispatch
-A cali-wl-to-host -m comment --comment "cali:Q2b2iY2M-vmds5iY" -m comment --comment "Configured DefaultEndpointToHostAction" -j RETURN

规则1，允许请求DHCP
规则2，允许请求DNS
规则3，匹配workload endpoint各自的规则，将会依次检察policy的egress、各自绑定的profile的egress。
```

根据接收报文的网卡做区分，cali-from-wl-dispatch@filter:

```
-A cali-from-wl-dispatch -i cali0ef24b1 -m comment --comment "cali:RkM6MKQgU0OTxwKU" -g cali-fw-cali0ef24b1
-A cali-from-wl-dispatch -i cali0ef24b2 -m comment --comment "cali:7hIahXYNmY9JDfKG" -g cali-fw-cali0ef24b2
-A cali-from-wl-dispatch -m comment --comment "cali:YKcphdGNZ1PwfGvt" -m comment --comment "Unknown interface" -j DROP

规则1，cali0ef24b1是slave1-frontend1
规则2，cali0ef24b2是slave1-frontend2
```

只查看其中一个，cali-fw-cali0ef24b1@filter:

```
-A cali-fw-cali0ef24b1 -m comment --comment "cali:KOIFJxkWqvpSMSzk" -j MARK --set-xmark 0x0/0x1000000
-A cali-fw-cali0ef24b1 -m comment --comment "cali:Mm_GAikGLiINmRQh" -m comment --comment "Start of policies" -j MARK --set-xmark 0x0/0x2000000
-A cali-fw-cali0ef24b1 -m comment --comment "cali:c6bGtQzwKsoipZq6" -m mark --mark 0x0/0x2000000 -j cali-po-namespace-default
-A cali-fw-cali0ef24b1 -m comment --comment "cali:46b6gNjtXYDXasAi" -m comment --comment "Return if policy accepted" -m mark --mark 0x1000000/0x1000000 -j RETURN
-A cali-fw-cali0ef24b1 -m comment --comment "cali:6kNf2_vqiCYkwInx" -m comment --comment "Drop if no policies passed packet" -m mark --mark 0x0/0x2000000 -j DROP
-A cali-fw-cali0ef24b1 -m comment --comment "cali:GWdesho87l08Srht" -m comment --comment "Drop if no profiles matched" -j DROP

这个endpoint没有绑定profile，所以只做了policy的egress规则检测
规则4，cali-po-namespace-default，policy“namespace-default”的egress规则，po表示policy outbound。
```

slave2上用于service”database”的endpoint绑定了profile，cali-fw-cali0ef24b3@filter:

```
-A cali-fw-cali0ef24b3 -m comment --comment "cali:CxOkDjFlTZaT70VP" -j MARK --set-xmark 0x0/0x1000000
-A cali-fw-cali0ef24b3 -m comment --comment "cali:2QQMYVCQs_pXjuNx" -m comment --comment "Start of policies" -j MARK --set-xmark 0x0/0x2000000
-A cali-fw-cali0ef24b3 -m comment --comment "cali:DyV6lV76WK8YZaJX" -m mark --mark 0x0/0x2000000 -j cali-po-namespace-default
-A cali-fw-cali0ef24b3 -m comment --comment "cali:TvuIyAsPjYsOd6oG" -m comment --comment "Return if policy accepted" -m mark --mark 0x1000000/0x1000000 -j RETURN
-A cali-fw-cali0ef24b3 -m comment --comment "cali:TXGkGvhZNM8gWSFv" -m comment --comment "Drop if no policies passed packet" -m mark --mark 0x0/0x2000000 -j DROP
-A cali-fw-cali0ef24b3 -m comment --comment "cali:sc2HAyx9fn5_mw0k" -j cali-pro-profile-database
-A cali-fw-cali0ef24b3 -m comment --comment "cali:LxL3UEOyLww7VztW" -m comment --comment "Return if profile accepted" -m mark --mark 0x1000000/0x1000000 -j RETURN
-A cali-fw-cali0ef24b3 -m comment --comment "cali:PMXWen2JRtHBNBVn" -m comment --comment "Drop if no profiles matched" -j DROP

可以看到，多了一个cali-pro-profile-database的检测
规则6，cali-pro-profile-database, profile"profile-database"的egress规则，pro表示profile outbound。
```

policy的egress规则，cali-po-namespace-default@filter:

```
-A cali-po-namespace-default -m comment --comment "cali:uT-hMQk_SRgHsKxT" -j MARK --set-xmark 0x1000000/0x1000000
-A cali-po-namespace-default -m comment --comment "cali:KDa-ASKrRQu4eYZs" -m mark --mark 0x1000000/0x1000000 -j RETURN

policy“namespace-default”的egress规则是allow，所以规则1直接打了标记"0x1000000/0x1000000"。
```

slave2上的endpoint绑定的profile规则的egress规则，cali-pro-profile-database@filter:

```
-A cali-pro-profile-database -m comment --comment "cali:laSwzk9Ihy5ArWJB" -j MARK --set-xmark 0x1000000/0x1000000
-A cali-pro-profile-database -m comment --comment "cali:BpvFNyMPRLC0lDtu" -m mark --mark 0x1000000/0x1000000 -j RETURN

profile-database的egress是allow，直接打标记0x1000000/0x1000000。
```

### 路由决策之后：需要转发的报文

filter.FORWARD:

```
-A FORWARD -m comment --comment "cali:wUHhoiAYhphO9Mso" -j cali-FORWARD

直接进入cali-FROWARD
```

filter.cali-FORWARD，根据接收网卡做egress规则匹配，根据目标网卡做ingress规则匹配:

```
-A cali-FORWARD -m comment --comment "cali:jxvuJjmmRV135nVu" -m mark --mark 0x1000000/0x1000000 -m conntrack --ctstate UNTRACKED -j ACCEPT
-A cali-FORWARD -m comment --comment "cali:8YeDX9Z0tXyO0Sp8" -m conntrack --ctstate INVALID -j DROP
-A cali-FORWARD -m comment --comment "cali:1GMSV-PhhZ8QbJg4" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A cali-FORWARD -i cali+ -m comment --comment "cali:36TkoGXj9EF7Plkv" -j cali-from-wl-dispatch
-A cali-FORWARD -o cali+ -m comment --comment "cali:URMhBRo8ugd8J8Yx" -j cali-to-wl-dispatch

-A cali-FORWARD -i cali+ -m comment --comment "cali:FyhWsW08U3a5niLK" -j ACCEPT
-A cali-FORWARD -o cali+ -m comment --comment "cali:G655uIfZuidj1gAw" -j ACCEPT

-A cali-FORWARD -m comment --comment "cali:4GbueNC2iWajKnxO" -j MARK --set-xmark 0x0/0x7000000
-A cali-FORWARD -m comment --comment "cali:bq3wVY3mkXk96NQP" -j cali-from-host-endpoint
-A cali-FORWARD -m comment --comment "cali:G8sjbYXH5_QiYnBl" -j cali-to-host-endpoint
-A cali-FORWARD -m comment --comment "cali:wYFYRdMhtSYCqKNm" -m comment --comment "Host endpoint policy accepted packet." -m mark --mark 0x1000000/0x1000000 -j ACCEPT

规则4，报文是workload endpoint发出的，过对应endpoint的规则的egress规则。
规则5，报文要转发给本地的workload endpoint的，过对应endpoint的ingress规则。

规则6，规则7，默认允许转发。

规则9，报文是其它node发送过来的，过host endpoint的ingress规则。
规则10，报文要转发给host endpoint，过host endpoint的egress规则。
```

filter.cali-from-wl-dispatch，过对应endpoint的egress规则:

```
-A cali-from-wl-dispatch -i cali0ef24b1 -m comment --comment "cali:RkM6MKQgU0OTxwKU" -g cali-fw-cali0ef24b1
-A cali-from-wl-dispatch -i cali0ef24b2 -m comment --comment "cali:7hIahXYNmY9JDfKG" -g cali-fw-cali0ef24b2
-A cali-from-wl-dispatch -m comment --comment "cali:YKcphdGNZ1PwfGvt" -m comment --comment "Unknown interface" -j DROP

规则1, 过对应endpoint的inbound规则， fw表示from workload
```

filter.cali-to-wl-dispatch，过对应endpoint的ingress规则:

```
-A cali-to-wl-dispatch -o cali0ef24b1 -m comment --comment "cali:ofrbQ8PhcrIR6rgF" -g cali-tw-cali0ef24b1
-A cali-to-wl-dispatch -o cali0ef24b2 -m comment --comment "cali:l9Rs20XXIl4D5AVE" -g cali-tw-cali0ef24b2
-A cali-to-wl-dispatch -m comment --comment "cali:dxGyc_mZA_GT16Wb" -m comment --comment "Unknown interface" -j DROP

规则1，过对应endpoint的规则链，tw表示to workload
```

workload endpoint的outbound规则，在前面已经看过了，这里省略，只看inbound。

查看一个workload-endpoint的inbound规则，filter.cali-tw-cali0ef24b1

```
-A cali-tw-cali0ef24b1 -m comment --comment "cali:v-IVzQuOaLDTvlKQ" -j MARK --set-xmark 0x0/0x1000000
-A cali-tw-cali0ef24b1 -m comment --comment "cali:vE8JWROTKOuSK0cA" -m comment --comment "Start of policies" -j MARK --set-xmark 0x0/0x2000000
-A cali-tw-cali0ef24b1 -m comment --comment "cali:fVy5z1nXaCLhF0EQ" -m mark --mark 0x0/0x2000000 -j cali-pi-namespace-default
-A cali-tw-cali0ef24b1 -m comment --comment "cali:_B9yiomhSoQTzhKL" -m comment --comment "Return if policy accepted" -m mark --mark 0x1000000/0x1000000 -j RETURN
-A cali-tw-cali0ef24b1 -m comment --comment "cali:uNPReN9_BghUJj7S" -m comment --comment "Drop if no policies passed packet" -m mark --mark 0x0/0x2000000 -j DROP

首先过policy的ingress规则，然后过绑定的profile的ingress规则:
规则3: cali-pi-namespace-default，pi表示policy inbound。
```

filter.cali-pi-namespace-default，policy inbound规则:

```
-A cali-pi-namespace-default -m comment --comment "cali:K4jTheFcVvdYaw0q" -j DROP
-A cali-pi-namespace-default -m comment --comment "cali:VTQ78plyA8u_8_YC" -m set --match-set cali4-s:CEmFgJFwDvohR01JKvOkO8D src -j MARK --set-xmark 0x1000000/0x1000000
-A cali-pi-namespace-default -m comment --comment "cali:OAWI2ts9a8YpVP2b" -m mark --mark 0x1000000/0x1000000 -j RETURN

注意，规则1直接丢弃了报文，但是规则2又在设置标记，这是因为这里policy的egress规则设置是有问题的:

ingress:
- action: deny
- action: allow
  source:
    selector: namespace == 'default'

配置了两条ingress规则，第一条直接deny，第二条则是对指定的source设置为allwo。这样的规则配置是有问题的。
从上面的iptables规则中也可以看到，iptables规则是按照ingress中的规则顺序设定的。
如果第一条规则直接deny，那么后续的规则就不会发生作用了。
所以结果就是allow规则不生效。
```

salve1上的workload endpoint没有绑定profile，所有没有profile的inbound规则。

slave2上的endpoint设置了profile，允许访问TCP 3306端口，可以看到profile的inbound规则，filter.cali-tw-cali0ef24b3：

```
-A cali-tw-cali0ef24b3 -m comment --comment "cali:-l47AwgMbB6upZ-7" -j MARK --set-xmark 0x0/0x1000000
-A cali-tw-cali0ef24b3 -m comment --comment "cali:3qLl7L7-k49jf6Eu" -m comment --comment "Start of policies" -j MARK --set-xmark 0x0/0x2000000
-A cali-tw-cali0ef24b3 -m comment --comment "cali:Q6ycGZQm9W9l4KiJ" -m mark --mark 0x0/0x2000000 -j cali-pi-namespace-default
-A cali-tw-cali0ef24b3 -m comment --comment "cali:_ILnIsDpaSEGOULc" -m comment --comment "Return if policy accepted" -m mark --mark 0x1000000/0x1000000 -j RETURN
-A cali-tw-cali0ef24b3 -m comment --comment "cali:CtKcOQPXG9FZiCN-" -m comment --comment "Drop if no policies passed packet" -m mark --mark 0x0/0x2000000 -j DROP
-A cali-tw-cali0ef24b3 -m comment --comment "cali:NR6mgOGAOw90NLpp" -j cali-pri-profile-database
-A cali-tw-cali0ef24b3 -m comment --comment "cali:_OapaK4JADerp4Fv" -m comment --comment "Return if profile accepted" -m mark --mark 0x1000000/0x1000000 -j RETURN
-A cali-tw-cali0ef24b3 -m comment --comment "cali:ZVuAf3Bzin6dOKSX" -m comment --comment "Drop if no profiles matched" -j DROP

规则6，多出的profile inboud规则。
```

salve2上的profile的inbound规则，filter.cali-pri-profile-database:

```
-A cali-pri-profile-database -m comment --comment "cali:viAiQwvuZPt5-44a" -j DROP
-A cali-pri-profile-database -p tcp -m comment --comment "cali:Vcuflyj-wUF-f_Mo" -m set --match-set cali4-s:i357Nlxxj3AMBTQ4WyOllNt src -m multiport --dports 3306 -j MARK --set-xmark 0x1000000/0x1000000
-A cali-pri-profile-database -m comment --comment "cali:JWP_zDo3JNywNc0V" -m mark --mark 0x1000000/0x1000000 -j RETURN

同样也是因为profile的ingress第一条是deny的原因，规则1直接全部drop。
规则2，允许访问tcp 3306。
```

nat.POSTROUTING:

```
-A cali-POSTROUTING -m comment --comment "cali:Z-c7XtVd2Bq7s_hA" -j cali-fip-snat
-A cali-POSTROUTING -m comment --comment "cali:nYKhEzDlr11Jccal" -j cali-nat-outgoing

这里没有设置fip，所以cali-fip-snat和cali-nat-outging都是空的
```

### node发送本地发出的报文

OUTPUT@nat:

```
-A OUTPUT -m comment --comment "cali:tVnHkvAo15HuiPy0" -j cali-OUTPUT
-A OUTPUT ! -d 127.0.0.0/8 -m addrtype --dst-type LOCAL -j DOCKER
```

cali-OUTPUT@nat:

```
-A cali-OUTPUT -m comment --comment "cali:GBTAv2p5CwevEyJm" -j cali-fip-dnat
```

OUTPUT@filter:

```
-A OUTPUT -m comment --comment "cali:tVnHkvAo15HuiPy0" -j cali-OUTPUT
```

cali-OUTPUT@filter:

```
-A cali-OUTPUT -m comment --comment "cali:FwFFCT8uDthhfgS7" -m mark --mark 0x1000000/0x1000000 -m conntrack --ctstate UNTRACKED -j ACCEPT
-A cali-OUTPUT -m comment --comment "cali:KQN1p6BZgCGuApYk" -m conntrack --ctstate INVALID -j DROP
-A cali-OUTPUT -m comment --comment "cali:ThMSEAwgeF4nAqRa" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A cali-OUTPUT -o cali+ -m comment --comment "cali:0YpIH4BWIJL90PfX" -j RETURN
-A cali-OUTPUT -m comment --comment "cali:sUIDpoFnawuqGYyG" -j MARK --set-xmark 0x0/0x7000000
-A cali-OUTPUT -m comment --comment "cali:vQVzNX-dNxUnYjUT" -j cali-to-host-endpoint
-A cali-OUTPUT -m comment --comment "cali:Ry2SAIVyda14xWHB" -m comment --comment "Host endpoint policy accepted packet." -m mark --mark 0x1000000/0x1000000 -j ACCEPT

规则4，如果是发送到cali网卡的，报文不出node，没有必要继续匹配了
规则6，过host-endpoint的outbond规则。
```

POSTROUTING@nat:

```
-A POSTROUTING -m comment --comment "cali:O3lYWMrLQYEMJtB5" -j cali-POSTROUTING
-A POSTROUTING -s 172.16.163.0/24 ! -o docker0 -j MASQUERADE
```

nat.cali-POSTROUTING:

```
-A cali-POSTROUTING -m comment --comment "cali:Z-c7XtVd2Bq7s_hA" -j cali-fip-snat
-A cali-POSTROUTING -m comment --comment "cali:nYKhEzDlr11Jccal" -j cali-nat-outgoing
```


## 网络模型

参考资料： [https://developers.redhat.com/blog/2018/10/22/introduction-to-linux-interfaces-for-virtual-networking#netdevsim_interface](https://developers.redhat.com/blog/2018/10/22/introduction-to-linux-interfaces-for-virtual-networking#netdevsim_interface)

### ipvlan
#### ipvlan L2
![[Pasted image 20251113092231.png]]

```bash
# 1.Add ns：
ip netns add net1
ip netns add net2
# 2. Set the ipvlan l2 mode:
ip link add ipvlan1 link ens33 type ipvlan mode l2
ip link add ipvlan2 link ens33 type ipvlan mode l2
# 3.Add the interface to ns:
ip link set ipvlan1 netns net1
ip link set ipvlan2 netns net2
# 4. config ip address:
ip netns exec net1 ifconfig ipvlan1 172.12.1.5/24 up
ip netns exec net2 ifconfig ipvlan2 172.12.1.6/24 up

[root@k8smaster-ims ~]# ip netns exec net1 ping 172.12.1.6
PING 172.12.1.6 (172.12.1.6) 56(84) bytes of data.
64 bytes from 172.12.1.6: icmp_seq=1 ttl=64 time=0.031 ms
64 bytes from 172.12.1.6: icmp_seq=2 ttl=64 time=0.047 ms
64 bytes from 172.12.1.6: icmp_seq=3 ttl=64 time=0.050 ms
64 bytes from 172.12.1.6: icmp_seq=4 ttl=64 time=0.045 ms
^C
--- 172.12.1.6 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3071ms
rtt min/avg/max/mdev = 0.031/0.043/0.050/0.007 ms

[root@k8smaster-ims ~]# ip netns exec net1 ifconfig
ipvlan1: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.12.1.5  netmask 255.255.255.0  broadcast 172.12.1.255
        inet6 fe80::bc24:1100:145:b27d  prefixlen 64  scopeid 0x20<link>
        inet6 fd00:40::bc24:1100:145:b27d  prefixlen 64  scopeid 0x0<global>
        ether bc:24:11:45:b2:7d  txqueuelen 1000  (Ethernet)       # mac bc:24:11:45:b2:7d
        RX packets 2084  bytes 177748 (173.5 KiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 23  bytes 1834 (1.7 KiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

[root@k8smaster-ims ~]# ifconfig ens18
ens18: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.161.40.240  netmask 255.255.255.0  broadcast 10.161.40.255
        inet6 fd00:40::1:2e  prefixlen 128  scopeid 0x0<global>
        inet6 fe80::be24:11ff:fe45:b27d  prefixlen 64  scopeid 0x20<link>
        inet6 fd00:40::be24:11ff:fe45:b27d  prefixlen 64  scopeid 0x0<global>
        ether bc:24:11:45:b2:7d  txqueuelen 1000  (Ethernet)     # mac bc:24:11:45:b2:7d
        RX packets 2084  bytes 177748 (173.5 KiB)
        RX packets 1144219  bytes 317018912 (302.3 MiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 131911  bytes 421622489 (402.0 MiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

[root@k8smaster-ims ~]# ip netns exec net2 ifconfig
ipvlan2: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.12.1.6  netmask 255.255.255.0  broadcast 172.12.1.255
        inet6 fd00:40::bc24:1100:245:b27d  prefixlen 64  scopeid 0x0<global>
        inet6 fe80::bc24:1100:245:b27d  prefixlen 64  scopeid 0x20<link>
        ether bc:24:11:45:b2:7d  txqueuelen 1000  (Ethernet)    # mac bc:24:11:45:b2:7d
        RX packets 2084  bytes 177748 (173.5 KiB)
        RX packets 2114  bytes 180357 (176.1 KiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 23  bytes 1834 (1.7 KiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0


# 生成网络命名空间之后在 /var/run/netns/ 会生成对应的网络命名空间设备，可以使用nsenter进入到对应网络命名空间查看interface
ls -l /var/run/netns/net1
-r--r--r-- 1 root root 0 Nov 13 08:53 /var/run/netns/net1
nsenter --net=/var/run/netns/net1 bash
```

| 特性         | Macvlan                 | IPvlan             |
| ---------- | ----------------------- | ------------------ |
| **MAC 地址** | 每个子接口有**唯一 MAC**        | 所有子接口**共享父接口 MAC** |
| **工作层级**   | L2（数据链路层）               | L3（网络层）            |
| **交换机视角**  | 多个独立设备                  | 一个设备               |
| **适用场景**   | 需要不同 MAC（如 DHCP、某些安全策略） | 高密度容器网络、避免 MAC 表溢出 |
| **混杂模式**   | 父接口需开启混杂模式（promiscuous） | **不需要**混杂模式        |
#### ipvaln L3
在 L3 模式 中，虚拟设备只处理 L3 以上的流量。虚拟设备不响应 ARP 请求，用户必须手动为相关点上的 IPVLAN IP 地址配置邻居条目。相关容器的出口流量会放在 default 命名空间的 netfilter POSTROUTING 和 OUTPUT 链上,而入口流量会线程处理,方式与 L2 模式 相同。使用L3 模式会提供很好的控制，但可能会降低网络流量性能。

![[Pasted image 20251113134204.png]]

```bash
# IPVLAN L3:
# 1.Add ns：
ip netns add net1
ip netns add net2
# 2. Set the ipvlan l3 mode:
ip link add ipvlan1 link ens33 type ipvlan mode l3
ip link add ipvlan2 link ens33 type ipvlan mode l3
# 3.Add the interface to ns:
ip link set ipvlan1 netns net1
ip link set ipvlan2 netns net2
# 4.config the ip address
ip netns exec net1 ifconfig ipvlan1 10.1.1.2/24 up
ip netns exec net2 ifconfig ipvlan2 10.1.2.2/24 up
# 5.Add default route
ip netns exec net1 ip route add default dev ipvlan1
ip netns exec net2 ip route add default dev ipvlan2
```


## macvlan
加载内核驱动支持macvlan
```bash
$ modprobe macvlan
$ lsmod | grep macvlan
  macvlan    19046    0
```
macvlan 允许你在主机的一个网络接口上配置多个虚拟的网络接口，这些网络 interface 有自己独立的 mac 地址，也可以配置上 ip 地址进行通信。macvlan 下的虚拟机或者容器网络和主机在同一个网段中，共享同一个广播域。macvlan 和 bridge 比较相似，但因为它省去了 bridge 的存在，所以配置和调试起来比较简单，而且效率也相对高。除此之外，macvlan 自身也完美支持 VLAN

![[Pasted image 20251114132652.png]]

```bash
# MACVLAN Bridge Mode:
# 0.prepare env:
modprobe macvlan
ifconfig ens33 promisc
# 1. Add ns
ip netns add net1
ip netns add net2
# 2. add macvlan
ip link add link ens33 name macv1 type macvlan mode bridge
ip link add link ens33 name macv2 type macvlan mode bridge
# 3.add interface to ns
ip link set macv1 netns net1
ip link set macv2 netns net2
# config ip address
ip netns exec net1 ifconfig macv1 172.12.2.5/24 up
ip netns exec net2 ifconfig macv2 172.12.2.7/24 up

# ping:
ip netns exec ns1 ping 172.12.2.7
16:21:55.463344 1c:69:7a:45:1e:5a > 01:00:5e:7f:ff:fa, ethertype IPv4 (0x0800), length 179: 192.168.2.11.57357 > 239.255.255.250.ssdp: UDP, length 137
16:21:55.931734 ee:eb:f3:05:0e:21 > a2:4d:6d:0b:27:79, ethertype IPv4 (0x0800), length 98: 172.12.2.5 > 172.12.2.7: ICMP echo request, id 18386, seq 1, length 64
16:21:55.931773 a2:4d:6d:0b:27:79 > ee:eb:f3:05:0e:21, ethertype IPv4 (0x0800), length 98: 172.12.2.7 > 172.12.2.5: ICMP echo reply, id 18386, seq 1, length 64
16:21:56.932077 ee:eb:f3:05:0e:21 > a2:4d:6d:0b:27:79, ethertype IPv4 (0x0800), length 98: 172.12.2.5 > 172.12.2.7: ICMP echo request, id 18386, seq 2, length 64
16:21:56.932119 a2:4d:6d:0b:27:79 > ee:eb:f3:05:0e:21, ethertype IPv4 (0x0800), length 98: 172.12.2.7 > 172.12.2.5: ICMP echo reply, id 18386, seq 2, length 64
```


docker 实现macvlan示例 ： [https://github.com/moby/libnetwork/blob/master/docs/macvlan.md](https://github.com/moby/libnetwork/blob/master/docs/macvlan.md)

### `IPIP`

流量：tunl0设备封装数据，形成隧道，承载流量。

适用网络类型：适用于互相访问的pod不在同一个网段中，跨网段访问的场景。外层封装的ip能够解决跨网段的路由问题。

效率：流量需要tunl0设备封装，效率略低。

![[image-2025-03-04-16-35-09-325.png]]

### `BGP` 网络

流量：使用主机路由表信息导向流量

适用网络类型：适用于互相访问的pod在同一个网段，适用于大型网络。

效率：原生hostGW，效率高。

![[image-2025-03-04-16-36-17-662.png]]




## 网络策略
#### Cluster IP服务

默认服务类型为 ClusterIP 。这允许通过虚拟 IP 地址（称为服务 Cluster IP）在集群内访问服务。服务的 Cluster IP 可通过 Kubernetes DNS 发现。例如，my-svc.my-namespace.svc.cluster-domain.example 。DNS 名称和 Cluster IP 地址在服务的整个生命周期内保持不变，即使支持该服务的 pod 可能会被创建或销毁，并且支持该服务的 pod 数量可能会随时间而变化。

在典型的 Kubernetes 部署中，kube-proxy 在每个节点上运行，负责拦截到 Cluster IP 地址的连接，并在支持每个服务的 Pod 组之间进行负载平衡。作为此过程的一部分，DNAT 用于将目标 IP 地址从 Cluster IP 映射到所选的支持 Pod。连接上的响应数据包随后在返回发起连接的 Pod 的途中进行 NAT 反向转换

![[image-2025-01-23-19-29-59-234.png]]



![[image-2025-01-23-20-07-26-827.png]]


![[image-2025-01-23-20-09-30-283.png]]


#### NodePort 节点端口服务

从集群外部访问服务的最基本方法是使用 NodePort 类型的服务。节点端口是集群中每个节点上保留的端口，可通过该端口访问服务。在典型的 Kubernetes 部署中，kube-proxy 负责拦截与节点端口的连接并在支持每个服务的 pod 之间对其进行负载平衡

![[image-2025-01-23-19-36-07-020.png]]

![[image-2025-01-23-20-11-50-660.png]]

![[image-2025-01-23-20-16-41-799.png]]


请注意，由于连接源 IP 地址已通过 SNAT 转换为节点 IP 地址，因此服务支持 pod 的入口网络策略看不到原始客户端 IP 地址。通常，这意味着任何此类策略仅限于限制目标协议和端口，而不能基于客户端/源 IP 进行限制。

#### 负载均衡器服务

![[image-2025-01-23-19-39-20-407.png]]

大多数网络负载均衡器都会保留客户端源 IP 地址，但由于服务随后会通过一个内部节点(kube-proxy)，因此支持 Pod 本身看不到客户端 IP。

![[image-2025-01-23-20-31-03-560.png]]

#### Advertising service IPs

使用节点端口或网络负载平衡器的一种替代方法是通过 BGP 通告服务 IP 地址。这要求集群在支持 BGP 的底层网络上运行

Calico supports advertising service Cluster IPs, or External IPs for services configured with one.

https://github.com/metallb/metallb?tab=readme-ov-file[metallb和calico一样根据路由提供负载均衡]

![[image-2025-01-23-19-46-52-810.png]]

![[image-2025-01-23-20-23-12-971.png]]
![[image-2025-01-23-20-24-46-501.png]]


#### externalTrafficPolicy:local

默认情况下，无论是使用服务类型NodePort还是LoadBalancer，还是通过BGP公布服务IP地址，从集群外部访问服务都会在支持该服务的所有 Pod 之间均匀负载平衡，与 Pod 位于哪个节点无关。可以通过使用externalTrafficPolicy:local 配置服务来更改此行为，该配置指定连接应仅负载平衡到本地节点上支持该服务的Pod。

![[image-2025-01-23-19-51-38-831.png]]

![[image-2025-01-23-20-32-35-229.png]]


![[image-2025-01-23-20-26-12-008.png]]


#### Calico eBPF本机服务处理

Calico作为kube-proxy的替代方案，支持eBPF本机服务处理，通过eBPF实现服务路由，这可以保留源IP简化网络策略，提供DSR(直接服务返回)以减少流量的网络跳数。

![[image-2025-01-23-19-57-38-107.png]]


![[image-2025-01-23-20-29-34-564.png]]


#### Calico网络模型示例

均衡按照节点进行均衡

![[image-2025-01-23-20-27-47-118.png]]




![[image-2025-01-24-10-17-18-714.png]]

![[image-2025-01-24-10-17-35-695.png]]

In-cluster ingress solution exposed as service type LoadBalancer with externalTrafficPolicy:local

![[image-2025-01-24-10-40-18-480.png]]

External ingress solution via node ports

![[image-2025-01-24-10-41-22-363.png]]

External ingress solution direct to pods

![[image-2025-01-24-10-42-26-185.png]]





#### Calico eBPF数据平面简介

## calico 常见问题

[https://docs.tigera.io/calico/latest/reference/faq](https://docs.tigera.io/calico/latest/reference/faq)
此时对象为：cni1 ping cni2 对应的pod：10.244.231.200 ping 10.244.231.201
```bash
[root@k8s-1 ~]# kubectl get pods -o wide
NAME        READY   STATUS    RESTARTS   AGE    IP               NODE    NOMINATED NODE   READINESS GATES
cni-j7klb   1/1     Running   1          123d   10.244.231.200   k8s-1   <none>           <none>          # cni1 测试pod
cnitest     1/1     Running   0          26s    10.244.231.201   k8s-1   <none>           <none>          # cni2 测试pod
```
1. 进入cni-j7klb pod：
```bash
[root@k8s-1 ~]# kubectl exec -it cni-j7klb bash 
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.
bash-5.1# ifconfig 
eth0      Link encap:Ethernet  HWaddr F2:70:A8:61:D6:FC                         # MAC地址：F2:70:A8:61:D6:FC
          inet addr:10.244.231.200  Bcast:10.244.231.200  Mask:255.255.255.255  # 从这里看，为32位掩码的一个主机地址，这点对于理解此Case非常重要
          UP BROADCAST RUNNING MULTICAST  MTU:1480  Metric:1
          RX packets:5 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:446 (446.0 B)  TX bytes:0 (0.0 B)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

bash-5.1# 
rbash-5.1# route -n 
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         169.254.1.1     0.0.0.0         UG    0      0        0 eth0  # 此时我们知道所有的数据报文从该Pod中出去，那么需要发送到169.254.1.1对应的下一跳
169.254.1.1     0.0.0.0         255.255.255.255 UH    0      0        0 eth0
```
因为从路由表中我们可以看到：我们需要构造一个完整的数据报文，需要一些必要的元素：
```bash
S_IP ：10.244.231.200       D_IP： $(cni2)
S_MAC：F2:70:A8:61:D6:FC    D_AMC：$(169.254.1.1)
```
在这里我们看到169.254.1.1，但是我们却在整个集群中找不到此地址，那我们如何才能解析到其对应的MAC地址呢？
那我们又如何获取到获取相应的MAC地址呢？
### 1. Why does my container have a route to 169.254.1.1?
In a Calico network, each host acts as a gateway router for the workloads that it hosts. In container deployments, Calico uses 169.254.1.1 as the address for the Calico router. By using a link-local address, Calico saves precious IP addresses and avoids burdening the user with configuring a suitable address.
While the routing table may look a little odd to someone who is used to configuring LAN networking, using explicit routes rather than subnet-local gateways is fairly common in WAN networking.

解释：在calico启动的时候，会设置169.254.1.1作为一个默认的gateway给容器。所以我们在容器中show路右边可以查看到：
```bash
[root@k8s-1 ~]# kubectl exec -it cnitest bash 
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.
# calico 中都是这个ip地址
bash-5.1# route -n 
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         169.254.1.1     0.0.0.0         UG    0      0        0 eth0
169.254.1.1     0.0.0.0         255.255.255.255 UH    0      0        0 eth0
```

### 2. Why can’t I see the 169.254.1.1 address mentioned above on my host?
Calico tries hard to avoid interfering with any other configuration on the host. Rather than adding the gateway address to the host side of each workload interface, Calico sets the proxy_arp flag on the interface. This makes the host behave like a gateway, responding to ARPs for 169.254.1.1 without having to actually allocate the IP address to the interface.

解释：Calico避免设置一些ip地址在HOST主机上，而是为每一个workload设置一个网关地址，但是这个地址并不配置在具体的主机上，而是回复相应的ARP消息。此时涉及到Linux中的一个Proxy_ARP相关的概念，通过Proxy_ARP的配置，此时我们主机就可以扮演成一个网关，来回复169.254.1.1对应的MAC地址。
可通过查询：

```bash
# 一旦设置 proxy_arp 
[root@k8s-1 ~]# cat /proc/sys/net/ipv4/conf/calid477199c0e4/proxy_arp   # 注意此配置是接口关联型
1
```
##########################################################################################################################################################
### 3. I’ve heard Calico uses proxy ARP, doesn’t proxy ARP cause a lot of problems?
It can, but not in the way that Calico uses it.

In container deployments, Calico only uses proxy ARP for resolving the 169.254.1.1 address. The routing table inside the container ensures that all traffic goes via the 169.254.1.1 gateway so that is the only IP that will be ARPed by the container.
解释：calico 仅仅使用proxy_arp来解决mac地址解析问题。可保证所有的流量均需要走三层的路由来做解析。

### 4. Why do all cali* interfaces have the MAC address ee:ee:ee:ee:ee:ee?
In some setups the kernel is unable to generate a persistent MAC address and so Calico assigns a MAC address itself. Since Calico uses point-to-point routed interfaces, traffic does not reach the data link layer so the MAC Address is never used and can therefore be the same for all the cali* interfaces.

解释：由于Linux内核无法提供一个稳定MAC地址，而Calico网络中使用ponint-to-point 去路由数据包，数据包并不涉及链路层，所以自然也是用不到相应的MAC地址，该MAC地址仅仅为了完成标准的TCP/IP协议栈封装数据报文。

 所以这里涉及到一个Linux Proxy_ARP：我们需要一探究竟.


## calico同节点通信方式
calico里面同节点通信方式，除了eBPF剩下的都一样

查看calico网络模式
```bash
$ kubectl get ippool -o yaml
apiVersion: v1
items:
  ...
  kind: IPPool
  spec:
    allowedUses:
    - Workload
    - Tunnel
    cidr: 100.64.0.0/10
    ipipMode: Always
    natOutgoing: true
    nodeSelector: all()
    vxlanMode: Never
  ...
```







## 文章
- 容器网络解决方案的性能对比
[Battlefield: Calico, Flannel, Weave and Docker Overlay Network](http://chunqi.li/2015/11/15/Battlefield-Calico-Flannel-Weave-and-Docker-Overlay-Network/)
[Comparison of Networking Solutions for Kubernetes](https://machinezone.github.io/research/networking-solutions-for-kubernetes/)




