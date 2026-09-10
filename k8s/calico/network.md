## Calico Ingress Gateway
Calico Ingress Gateway 是开源 Envoy Gateway 项目的加固版本。Tigera 通过使用加固的基础镜像来重新构建 Envoy Gateway 代码，从而确保强大的安全性和稳定性。
Gateway API 定义了相关规范，而 Envoy Gateway 则是该规范的主要实现框架。

Envoy Gateway 充当控制层的功能，它将 Gateway 的 API 资源转化为可执行的配置，这些配置随后会被传输到数据层。数据层则使用 Envoy Proxy 作为代理服务器，这是一种高性能的代理服务器，在云原生生态系统中被广泛使用，适用于边缘计算和服务网格功能。通过利用 Envoy，Calico Ingress Gateway 能够提供可靠的性能、高吞吐量以及精细的可观测性。

## Config BGP peering
在Calico节点之间配置BGP(边界网关协议)，或者与网络基础设置进行互联，以分发路由信息。

### 价值
Calico 节点可以通过 BGP 交换路由信息，从而实现联网工作负载的可达性（如 Kubernetes 容器或 OpenStack 虚拟机）。在本地部署中，这使得你的工作负载能够在整个网络中享受到与其它资源相同的待遇。在公共云环境中，这种方式则是一种高效的路由信息分发方式，有助于在集群内实现高效的路由管理。

### BGP
BGP 是一种用于在网络中的路由器之间交换路由信息的标准协议。每个运行 BGP 的路由器都至少有一个 BGP 对等体——即那些通过 BGP 进行通信的其他路由器。你可以把 Calico 网络看作是在每个节点上都存在一个虚拟路由器。你可以配置 Calico 节点以进行对等连接，也可以使用路由反射器，或者与机架级路由器进行连接。

### Common BGP topologies

*Full-mesh*
当启用 BGP 功能后，Calico 的默认行为是创建全网状结构的内部 BGP（iBGP）连接，其中每个节点都与其他节点进行对等连接。这样，Calico 就可以在任何 L2 网络上运行，无论是公共云还是私有云环境。
在小型和中型部署环境中，比如只有 100 个节点或更少的情况下，全 mesh 架构表现得非常出色。但在更大的规模下，全 mesh 架构的效率会显著降低，因此我们建议采用路由反射器架构

*Route reflectors*
为了构建大型的内部 BGP 集群，可以使用 BGP 路由反射器来减少每个节点上所需的 BGP 对等连接数量。在这种模式下，一些节点充当路由反射器的角色，并配置为在它们之间建立完整的网络拓扑结构。而其他节点则只与部分这些路由反射器进行对等连接（通常出于冗余考虑，会选择与 2 个路由反射器进行连接），这样就能比完全网状结构减少总的 BGP 对等连接数量。

*Top of Rack (ToR)*

在本地部署环境中，你可以配置 Calico 直接与物理网络基础设施进行对等连接。通常，这需要禁用 Calico 默认的全网状配置方式，而是将 Calico 与 L3 或 RIRouter 进行对等连接。构建本地 BGP 网络有多种方法，如何配置 BGP 取决于你的需求——Calico 既支持 iBGP 配置，也支持 eBGP 配置，因此你可以像对待网络中的任何其他路由器一样来使用 Calico。
![[Pasted image 20260910103422.png]]


##  Advertise Kubernetes service IP addresses
启用 Calico 功能，使其能够对外展示 Kubernetes 服务的集群 IP 地址。Calico 支持对外展示服务的集群 IP 地址和外部 IP 地址。

### 价值
通常，Kubernetes 服务集群的 IP 地址只能在集群内部访问，因此要实现对服务的外部访问，需要使用专门的负载均衡器或入口控制器。如果服务的集群 IP 不可路由访问，那么就可以使用该服务的外部 IP 地址来访问它。
既然 Calico 支持通过 BGP 来路由广告目标 IP 地址，那么它也支持通过 BGP 来路由 Kubernetes 服务 IP 地址到集群外。这样就无需使用专门的负载均衡器了。该功能还支持在集群中的节点之间进行平等成本的多路径负载均衡，以及在需要更多控制的情况下，保持本地服务的源 IP 地址不变。



## 为某个容器使用特定的MAC地址
选择某个Pod的MAC地址，而不是让操作系统自动分配一个。

### 价值
一些应用程序会将软件许可证与网络接口的MAC地址绑定到一起

## Configure QoS Controls 
配置QoS(服务质量)控制规则，以限制Calico工作负载的出站或入站贷款、数据包传输速率以及连接数量。这样能够防止这些工作负载过度使用网络资源。此外还可以对Calico工作负载和宿主机的出站流量进行差异服务DiffServ处理。

### 价值
通过 QoS 控制功能，Calico 可以限制 Kubernetes 容器所使用的网络资源（如带宽、数据包传输速率等），从而确保资源分配的公平性，同时避免其他工作负载的性能下降。此外，Calico 还可以对出站流量应用 DiffServ 机制，使得上游设备能够根据优先级进行数据包的转发。

> 如果你使用 eBPF 数据平面，那么你的 Linux 节点必须运行内核版本为 6.6 或更高版本，才能配置带宽 QoS 控制功能
> 在使用 eBPF 数据平面的安装环境中，无法为已建立的连接配置限制。

### Quality of Service Controls
在计算机网络领域，服务质量（QoS）指的是对流量的优先级排序以及资源分配控制机制。它可能包括确保网络资源的最低使用量，或者限制网络资源的最大使用量，以防止少数用户过度消耗资源，同时保证其他用户也能获得公平的资源分配。实际上，Calico 实现 QoS 控制的方式就是限制网络资源的最大使用量。

Calico 实现了三种类型的 QoS 控制机制，这些控制可以通过在 Kubernetes 容器上添加注释来进行配置，分别针对进入容器时的流量、离开容器时的流量，或者两者都有的情况进行设置。
1. 带宽：限制流入/离开节点的数据流的比特率
2. 数据包速率：限制每个Pod每秒可以发送或接收的数据包数量
3. 已建立的连接数量：限制了该pod可以发起或接受的连接总数
4. 区分服务(DiffServ)：在离开集群或发送至主机的数据包上设置区分服务代码点（DSCP）

### 实现方式
在k8s平台上，Calico通过为容器添加注释来实现QoS控制的配置。
QoS 控制注释的值可能包含后缀，例如 `k` 、 `M` 、 `G` 、 `T` 、 `P` 或 `E` ，这些后缀用于表示较大的数字。也支持二进制后缀，例如 `1Ki` 表示“1024”。

例如，若要将出站带宽限制为100Mbps，同时允许最大突发流量传输量为200Mb，那么就可以进行如下配置：
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  labels:
    app: my-app
spec:
  replicas: 3
  template:
    metadata:
      annotations:
        qos.projectcalico.org/egressBandwidth: "100M"
        qos.projectcalico.org/egressBurst: "200M"
    spec:
        (...)
```
[详细配置规则](https://docs.tigera.io/calico/latest/networking/configuring/qos-controls)

## IPAM
get started with IP address management

### IPAM in Kubernetes
Kubernetes 通过 IPAM 插件来分配和管理分配给 Pod 的 IP 地址。不同的 IPAM 插件提供不同的功能。Calico 提供了自己的 IPAM 插件，名为 calico-ipam，该插件旨在与 Calico 协同工作，并包含多种功能。

### Calico IPAM
Calico-ipam 插件利用 Calico 的 IP 池资源来决定如何将 IP 地址分配给集群中的各个容器。这是大多数 Calico 部署中使用的默认插件。
默认情况下，Calico 会为整个 Kubernetes 容器 CIDR 区域使用一个 IP 池。但是，你可以将容器 CIDR 区域划分为多个 IP 池。你可以将不同的 IP 池分配给特定的节点，或者根据命名空间将 IP 池分配给集群中的不同团队、用户或应用程序。

你可以控制Calico为每个节点分配哪些池资源

### Calico IPAM blocks
在 Calico IPAM 中，IP 池被划分为多个块——这些较小的块与集群中的特定节点相关联。集群中的每个节点可以有一个或多个与之关联的块。随着集群中节点和 Pod 数量的增加或减少，Calico 会自动根据需求创建或销毁这些块。

这些块使得 Calico 能够高效地汇总同一节点上所有 Pod 所分配的地址，从而减少了路由表的大小。默认情况下，Calico 会尝试从与当前节点相关联的块内分配 IP 地址；如果必要的话，还会创建新的块来进行分配。此外，Calico 还可以将地址分配给那些不属于该节点所关联块的节点上的 Pod。这样，IP 地址的分配就可以独立于部署 Pod 的节点了。

默认情况下，Calico 创建的块包含 64 个地址的空间（即/26 子网）。不过，你可以针对每个 IP 池来定制块的大小。

### Host-local IPAM
主机本地插件是一种简单的 IP 地址管理插件。它使用预先确定的 CIDR 范围，这些 CIDR 范围会静态地分配给每个节点，从而确定 Pod 的地址。一旦设置好，某个节点的 CIDR 范围就无法被修改。Pod 的地址只能从分配给该节点的 CIDR 范围内选择
Calico 可以使用主机本地 IPAM 插件，通过 Kubernetes API 中的 Node.Spec.PodCIDR 字段来确定每个节点所使用的 CIDR 范围。不过，使用这种主机本地插件时，无法为每个节点、每个 Pod 以及每个命名空间进行 IP 分配。

主机本地 IPAM 插件主要用于通过其他路由方式将流量从一台主机传输到另一台主机。例如，在使用 flannel 网络来实施策略管理时，或者在 Google Kubernetes Engine 中利用 Calico 时，都会用到这种插件。


### 使用特定的IP地址管理Pod

#### 价值
一些应用程序需要使用稳定的 IP 地址。此外，你可能还需要在外部 DNS 服务器中创建指向 Pod 的条目，这也需要静态 IP 地址。















