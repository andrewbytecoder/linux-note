
## kubernetes ingress
### 什么是kubernetes ingress
Kubernetes Ingress 基于 Kubernetes 服务进行构建，能够在应用层提供负载均衡功能。它可以将 HTTP 和 HTTPS 请求与特定域名或 URL 关联起来，从而将请求分配到相应的 Kubernetes 服务上。此外，Ingress 还可以用于在将请求负载分配到服务之前对 SSL/TLS 进行终止处理。
Ingress 的实现方式取决于所使用的 Ingress 控制器。Ingress 控制器负责监控 Kubernetes 中的 Ingress 资源，并配置一个或多个入口负载均衡器，以实现所需的负载均衡行为。
与在网络层（L3-4）处理的 Kubernetes 服务不同，Ingress 负载均衡器在应用层（L5-7）进行运作。进入的连接会在负载均衡器处被处理，从而使其能够检查每一个 HTTP/HTTPS 请求。这些请求随后会通过独立的连接从负载均衡器传递到选定的服务后端节点。因此，对后端节点的网络策略可以限制访问，仅允许来自负载均衡器的连接，而无法直接限制对特定原始客户的访问。

### 为什么使用kubernetes ingress
由于 Kubernetes 服务已经提供了一种机制，可以用来平衡来自集群外部的访问请求，那么为什么仍然需要使用 Kubernetes Ingress 呢？
主要的使用场景是：当您有多个 HTTP/HTTPS 服务，希望通过同一个外部 IP 地址来访问这些服务时。这些服务的 URL 路径可能各不相同，或者它们属于多个不同的域名。从客户端配置的角度来看，这种方式比使用 Kubernetes 服务来暴露每个服务要简单得多。因为使用 Kubernetes 服务时，每个服务都需要有一个独立的外部 IP 地址。

另一方面，如果你的应用程序架构由单一的“前端”微服务构成，那么 Kubernetes 服务很可能已经能满足你的需求。在这种情况下，你可能无需添加 Ingress 配置，因为从简化架构的角度来看，这样做更为合适；此外，通过这种方式，你还可以更轻松地通过网络策略来限制对特定客户的访问。实际上，你的“前端”微服务已经在某种程度上发挥了 Kubernetes Ingress 的功能，这与下面讨论的集群内入口解决方案非常相似。

### ingress 解决方案
- in-cluster ingress: 集群内入口负载均衡——指的是由集群内的各个节点进行入口负载均衡的操作。
- External ingress: 外部接入——指的是通过设备或云提供商的功能，在集群外部实现接入负载均衡的方式

#### in-cluster ingress solutions
集群内的入口解决方案使用的是运行在集群内部容器中的软件负载均衡器。有许多不同的入口控制器遵循这种模式，例如 NGINX 入口控制器。
这种方法的优点在于，你可以这样做：
- 将您的接入解决方案横向扩展至 Kubernetes 的极限性能水平。
- 请选择最适合您特定需求的入口控制器，例如可以根据特定的负载均衡算法或安全选项来选择相应的控制器
为了将进入集群的流量导向相应的入口节点，这些入口节点通常作为 Kubernetes 服务对外暴露，因此可以从集群外部通过标准方式访问该服务。一种常见的方法是使用外部网络负载均衡器或服务 IP 地址解析功能。这样能够减少网络中的跳转次数，同时保留客户端的源 IP 地址，从而可以根据需要利用网络策略来限制特定客户端对入口节点的访问。

![In-cluster ingress](https://docs.tigera.io/assets/images/ingress-in-cluster-cd15c60b9423ec081e33c35221e091b7.svg)


#### External ingress solutions
外部接入解决方案使用的是集群之外的应用负载均衡器。具体的细节和功能取决于所使用的接入控制器；不过，大多数云提供商都提供了这样的接入控制器，它能够自动化地配置和管理云提供商的应用负载均衡器，从而实现接入功能。

这种类型的入口解决方案的优势在于，您的云提供商会负责处理入口服务的运营复杂性问题。不过，其缺点在于：与集群内丰富的入口解决方案相比，其功能可能较为有限；而且，通过入口暴露的服务数量会受到云提供商具体限制的影响。
![External ingress](https://docs.tigera.io/assets/images/ingres-external-61762bf0d132a8eb2ab1080e1b65bac3.svg)

**In-cluster ingress solution exposed as service type `LoadBalancer` with `externalTrafficPolicy:local`**
![[PixPin_2026-09-09_20-17-38.png]]

**External ingress solution via node ports**

![[PixPin_2026-09-09_20-17-54.png]]

**External ingress solution direct to pods**

![[PixPin_2026-09-09_20-18-06.png]]
