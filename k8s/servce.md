


## service types
![[Pasted image 20260901193028.png]]

在 Kubernetes 中，Service 是一种**将集群内的网络应用对外（或对内）暴露出来的抽象机制**。我们借助 Service，让一组 Pod 在网络上可被访问，从而允许外部用户或其他集群内组件与之通信。

Kubernetes 共有 4 种 Service 类型：**ClusterIP、NodePort、LoadBalancer、ExternalName**。Service 配置中的 `type` 字段，决定了该服务以何种方式暴露到网络中。

---

### ClusterIP（默认类型）

ClusterIP 是默认、也是最常用的 Service 类型。Kubernetes 会为该 Service 分配一个**仅集群内部可达的 IP 地址**。也就是说，这个服务只能在集群内部被访问，外部网络无法直接触达。

> 补充：ClusterIP 既可以是自动分配的，也可以手动指定（`spec.clusterIP`）；它背后依赖 kube-proxy 的 iptables/IPVS 规则做转发。

### NodePort

NodePort 在 ClusterIP 的基础上，**在集群每个节点上开放一个统一的端口**（默认范围 `30000–32767），从而把服务暴露到集群外部。外部请求通过`NodeIP:NodePort` 即可访问该服务。

> 补充：访问任意一个节点 IP 的该端口，都会被转发到后端 Pod。但它没有高可用负载均衡能力——生产环境通常不会单独用 NodePort 直接对外，而是配合 LoadBalancer 或外部 LB 做前置。

### LoadBalancer

LoadBalancer 借助**云厂商提供的负载均衡器**（如 AWS ELB/ALB、GCP LB、阿里云 SLB/CLB）将 Service 暴露到公网/外网。云控制器（cloud-controller-manager）会自动创建 LB，并回填 `status.loadBalancer.ingress` 的 IP 或主机名。

> 补充：LoadBalancer 的实现强依赖底层云环境；裸金属集群里需要 MetalLB 之类的方案才能“模拟”出这个类型。它本质上是 **NodePort 的超集**——云 LB 背后还是指向各节点的 NodePort。

### ExternalName

ExternalName 将 Service **映射到一个外部域名**（通过 DNS CNAME）。它不创建任何 ClusterIP，也不代理流量，只是在集群内部造了一个“假 Service 名”，让集群内应用用 `http://external-db.default.svc.cluster.local` 这种集群内寻址方式，去访问集群外的真实服务（比如云上 RDS、其他机房的数据库）。

> 补充：它只做 DNS 层转发（CNAME），不做端口转换、不做健康检查。适合“把外部依赖包装成集群内服务”的场景。

---

### 延伸对照（帮你一眼分清）

| 类型           | 暴露范围       | 是否分配 ClusterIP | 是否需云厂商 | 典型用途             |
| ------------ | ---------- | -------------- | ------ | ---------------- |
| ClusterIP    | 仅集群内       | ✅ 是            | ❌      | 微服务之间内部调用        |
| NodePort     | 集群节点所在网络   | ✅ 是            | ❌      | 开发测试、作为 LB 后端    |
| LoadBalancer | 公网/外网（云上）  | ✅ 是            | ✅ 是    | 生产环境对外入口         |
| ExternalName | 集群内 DNS 别名 | ❌ 否            | ❌      | 外部数据库/第三方 API 抽象 |




## k8s service 
Kubernetes 服务提供了一种将一组 Pod 的访问权限抽象为网络服务的方式。每个服务所依赖的 Pod 组通常是通过标签选择器来定义的。
当客户端连接到k8s服务时，连接会被负载均衡到支持该服务的某个Pod上，如图所示：
![[PixPin_2026-09-09_20-21-04.png]]

k8s service 主要有三种类型：
- Cluster IP - 这是从集群内部访问服务的常用方式
- NodePort - 这是从集群外部访问服务的最基本方式
- LocaBalancer - 这是一种高级的访问方式，通过external load balancer从集群外部访问服务

### Cluter IP Services
默认的服务类型就是 `ClusterIP` 。通过这种方式，可以在集群内通过虚拟 IP 地址访问某个服务，这个虚拟 IP 地址也被称为服务的集群 IP。可以通过 Kubernetes DNS 来获取服务的集群 IP，例如 `my-svc.my-namespace.svc.cluster-domain.example` 。尽管支持该服务的容器可能会被创建或销毁，而且支持该服务的容器数量也可能随时间而变化，但服务的 DNS 名称和集群 IP 地址在服务的生命周期内都是保持不变的。

在典型的 Kubernetes 部署中，kube-proxy 运行在每一个节点上，负责拦截连接到集群 IP 地址的连接，并对支持各个服务的 Pod 进行负载均衡。在这个过程中，DNAT 被用来将目标 IP 地址从集群 IP 地址映射到选定的支持 Pod 上。因此，连接过程中的响应数据包在返回到发起连接的 Pod 时，会经过 NAT 的逆向转换。 [service](https://docs.tigera.io/calico/latest/about/kubernetes-training/about-kubernetes-services)

![[PixPin_2026-09-09_20-24-21.png]]

重要的是，网络策略是根据各个 Pod 来执行的，而不是基于服务的主机 IP。也就是说，当 DNAT 将连接的目标 IP 地址修改为所选的辅助 Pod 的 IP 地址后，就会生效出口网络的策略。由于只有连接的目标 IP 地址发生了变化，因此辅助 Pod 的入口网络策略仍然会将原来的客户端 Pod 视为连接的源端。


### NodePort services
从集群外部访问服务的最基本方式就是使用类型为 `NodePort` 的服务。节点端口是集群中每个节点上预留的一个端口，可以通过这个端口来访问服务。在典型的 Kubernetes 部署中，kube-proxy 负责拦截对节点端口的访问请求，并将这些请求负载均衡到支持各自服务的容器上。

在这个过程中，NAT 被用来将目标 IP 地址和端口从节点的 IP 和节点端口映射到选定的辅助节点和服务端口。同时，源 IP 地址也从客户端 IP 映射到节点 IP，这样连接上的响应数据包就可以通过原始节点返回，此时 NAT 可以再次被应用。（执行 NAT 的节点拥有追踪连接状态的能力，从而能够重新应用 NAT 功能。）

![[PixPin_2026-09-09_20-27-20.png]]

请注意，由于连接源 IP 地址被转换为节点 IP 地址，因此支持该服务的后台 Pod 的入网策略无法看到原始客户端 IP 地址。通常这意味着此类策略只能限制目标协议和端口，而无法根据客户端/源 IP 进行限制。不过，在某些情况下，可以通过使用 externalTrafficPolicy 或 Calico 提供的 eBPF 数据平面原生服务处理机制来规避这一限制，因为后者能够保留源 IP 地址。

### Load balancer services
`LoadBalancer` 类型的服务是通过外部网络负载均衡器来暴露的。具体使用的网络负载均衡器类型取决于您所使用的公有云提供商，或者，在本地部署的情况下，则取决于您的集群与哪种硬件负载均衡器的集成方式。

该服务可以通过网络负载均衡器上的特定 IP 地址从集群外部访问。默认情况下，该 IP 地址会利用服务节点端口对节点进行均衡负载分配。
![[PixPin_2026-09-09_20-31-11.png]]

大多数网络负载均衡器都会保留客户的源 IP 地址。但由于数据会通过节点端口进行传输，因此负责处理请求的后台 Pod 无法看到客户的 IP 地址。这对网络策略也会产生相应的影响。与节点端口类似，在某些情况下，可以通过使用 externalTrafficPolicy 或 Calico 的 eBPF 数据平面原生服务来处理此问题（而不是使用 kube-proxy），这样就能保留源 IP 地址。大多数网络负载均衡器都会保留客户的源 IP 地址。但由于数据会通过节点端口进行传输，因此负责处理请求的后台 Pod 无法看到客户的 IP 地址。这对网络策略也会产生相应的影响。与节点端口类似，在某些情况下，可以通过使用 externalTrafficPolicy 或 Calico 的 eBPF 数据平面原生服务来处理此问题（而不是使用 kube-proxy），这样就能保留源 IP 地址。

###  Advertising service IPs

使用节点端口或网络负载均衡器的另一种替代方案是通过 BGP 来发布服务 IP 地址。这要求集群运行在支持 BGP 的网络上，通常意味着需要部署标准的高层路由器来实现这一功能。

Calico 支持将 advertision service Cluster IPs 或外部 IP 配置到相关服务中。如果您不使用 Calico 作为网络插件，那么 MetalLB 提供了类似的功能，可以配合多种不同的网络插件使用。

![[PixPin_2026-09-09_20-33-08.png]]


### externalTrafficPolicy:local
默认情况下，无论是使用服务类型 `NodePort` 还是 `LoadBalancer` ，或者通过 BGP advertising service IP 地址，从集群外部访问服务时，连接都会均匀分配到支持该服务的所有节点上，而不受pod所在位置的影响。不过，可以通过配置服务参数 `externalTrafficPolicy:local` 来更改此行为，该参数指定连接只应在本地节点上支持该服务的节点上进行负载均衡。

当与 `LoadBalancer` 类型的服务结合使用时，或者与 Calico 服务的 IP 地址广播结合使用时，流量只会被导向那些至少托管有一个支持该服务的 Pod 的节点。这样就能减少节点之间的额外网络跳转次数。更重要的是，通过保持源 IP 地址始终指向相应的 Pod，就可以根据需求对特定外部客户端实施网络策略限制。

![[PixPin_2026-09-09_20-37-07.png]]

### Calico eBPF native service handling
作为使用 Kubernetes 标准 kube-proxy 的一种替代方案，Calico 的 eBPF 数据平面支持原生服务处理功能。这种方式能够保留源 IP 地址，从而简化网络策略的制定；同时，通过提供 DSR（直接服务器返回）功能，可以减少返回流量的网络跳数；此外，该机制还能实现与拓扑结构无关的负载均衡，相比 kube-proxy，其性能和延迟表现更为优越。
![[PixPin_2026-09-09_20-38-46.png]]













