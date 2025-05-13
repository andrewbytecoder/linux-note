## Calico

Calico组件主要架构由Felix、Confd、BIRD组成

- Felix 运行在每一台 Host 的 agent 进程，Felix负责刷新主机路由和ACL规则等，以便为该主机上的 Endpoint 正常运行提供所需的网络连接和管理。进出容器、虚拟机和物理主机的所有流量都会遍历Calico，利用Linux内核原生的路由和iptables生成的规则。是负责Calico Node运行并作为每个节点Endpoint端点的守护程序，它负责管理当前主机中的Pod信息，与集群etcd服务交换集群Pod信息，并组合路由信息和ACL策略。
- Confd是负责存储集群etcd生成的Calico配置信息，提供给BIRD层运行时使用。
- BIRD（BIRD Internet Routing Daemon）是核心组件，Calico中的BIRD特指BIRD Client和BIRD Route Reflector，负责主动读取Felix在本机上设置的路由信息，并通过BGP广播协议在数据中心中进行分发路由

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




