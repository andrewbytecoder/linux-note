## calico
calico是一个比较有趣的虚拟网络解决方案，完全利用路由规则实现动态组网，通过BGP协议通告路由。
calico的好处是endpoints组成的网络是单纯的三层网络，报文的流向完全通过路由规则控制，没有overlay等额外开销。
calico的endpoint可以漂移，并且实现了acl。
calico的缺点是路由的数目与容器数目相同，非常容易超过路由器、三层交换、甚至node的处理能力，从而限制了整个网络的扩张。
calico的每个node上会设置大量（海量)的iptables规则、路由，运维、排障难度大。
calico的原理决定了它不可能支持VPC，容器只能从calico设置的网段中获取ip。
calico目前的实现没有流量控制的功能，会出现少数容器抢占node多数带宽的情况。
calico的网络规模受到BGP网络规模的限制。

### calico 组件

Calico组件主要架构由Felix、Confd、BIRD组成

- Felix 运行在每一台 Host 的 agent 进程，Felix负责刷新主机路由和ACL规则等，以便为该主机上的 Endpoint 正常运行提供所需的网络连接和管理。进出容器、虚拟机和物理主机的所有流量都会遍历Calico，利用Linux内核原生的路由和iptables生成的规则。是负责Calico Node运行并作为每个节点Endpoint端点的守护程序，它负责管理当前主机中的Pod信息，与集群etcd服务交换集群Pod信息，并组合路由信息和ACL策略。
- Confd是负责存储集群etcd生成的Calico配置信息，提供给BIRD层运行时使用。
- BIRD（BIRD Internet Routing Daemon）是核心组件，Calico中的BIRD特指BIRD Client和BIRD Route Reflector，负责主动读取Felix在本机上设置的路由信息，并通过BGP广播协议在数据中心中进行分发路由
- 
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





### 网络模型

#### `IPIP`

流量：tunl0设备封装数据，形成隧道，承载流量。

适用网络类型：适用于互相访问的pod不在同一个网段中，跨网段访问的场景。外层封装的ip能够解决跨网段的路由问题。

效率：流量需要tunl0设备封装，效率略低。

![[image-2025-03-04-16-35-09-325.png]]

#### `BGP` 网络

流量：使用主机路由表信息导向流量

适用网络类型：适用于互相访问的pod在同一个网段，适用于大型网络。

效率：原生hostGW，效率高。

![[image-2025-03-04-16-36-17-662.png]]




### 网络策略
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



## 文章
- 容器网络解决方案的性能对比
[Battlefield: Calico, Flannel, Weave and Docker Overlay Network](http://chunqi.li/2015/11/15/Battlefield-Calico-Flannel-Weave-and-Docker-Overlay-Network/)
[Comparison of Networking Solutions for Kubernetes](https://machinezone.github.io/research/networking-solutions-for-kubernetes/)




