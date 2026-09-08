## k8s network

### kubernetes network implementations
k8s内置的网络功能模块kubenet仅仅能提供一些基本的网络连接功能，不过最常见的是通过使用第三方网络解决方案，这些解决方案可以通过CNI(容器网络接口)API与k8s进行集成。
常见的CNI插件有两种
- 网络插件，负责将Pod连接到网络中
- IPAM(IP地址管理)插件，负责分配pod的ip地址


### k8s services
k8s服务提供了一种将一组pod的访问进行抽象化的方式，使其表现为一种网络服务。在集群内部，这种网络服务通常表现为一个虚拟IP地址，而kube-proxy则负责将连接分配到支持该服务的哪些Pod上。
该虚拟IP可以通过k8s的DNS进行查询和获取。无论支持该服务的Pod是否会被创建或销毁，以及支持该服务的Pod数量是否会随着时间变化，DNS名称和虚拟IP地址都保持不变。
这种对短暂存在的容器进行稳定管理的服务抽象机制，正是给予k8s构建的容器服务平台的基石。

Kubernetes 服务还可以定义如何从集群外部访问该服务，可以使用以下其中一种方式：
- 一个节点端口，可以通过每个节点上的特定端口来访问服务
- 负载均衡器是一种网络组件，它提供一个虚拟的IP地址，使得服务可以从集群外部进行访问。
- 除了节点端口和负载均衡器之外，k8s ingress还提供了HTTP和HTTPS路由规则，使得服务可以对外暴露，从而让集群外的客户端能够访问这些服务。

> 在本地部署环境中使用calico，还可以生命服务的ip地址，这样就能够方便地访问服务，而无需通过节点端口或者负载均衡器进行转发。

### NAT outgoing 
k8s网络模型规定，容器之间必须能够直接使用容器自身的ip地址进行通信，不过并没有要求容器的IP地址能够跨越集群边界进行路由。许多k8s网络实现方式采用的时overlay网络。在这种模式下，当容器尝试与集群外的ip地址建立连接时，承载该容器的节点会使用SNAT技术，将数据包的源地址从容器的IP转化为节点IP。这样连接就可以被路由到目的地(因为节点IP是可以被路由的)。而返回的数据包则会被节点自动重新映射，将节点IP替换为容器IP，然后再将其转发会容器。 

想要详细了解可以参考[egress](https://docs.tigera.io/calico/latest/about/kubernetes-training/about-kubernetes-egress)

在使用calico时，根据具体环境，你可以选择是否使用overlay网络，或者使用可以完全进行路由的Pod IP地址。如果需要更高的灵活性，Calico还允许为你指定的IP地址范围配置出站NAT设置。




## kubernetes ingress是什么
kubernetes ingress是一种API对象，用于管理队kubernetes汲取内服务的外部访问，通常是HTTP和HTTPS进行访问。用户可以通过该对象定义和配置应用程序的负载均衡、SSL termination以及基于name-base的虚拟主机服务。通过与现有的网络基础设施继承，kubernetes ingress能够确保用户能够一致且安全的访问应用程序。

与独立管理服务不同，ingress提供了易总统一的解决方案来处理多个服务，从而简化了路由规则的管理工作。ingress充当了入口点，可以从一个集中化的资源点管理和执行路由决策、SSL配置以及流量分配的操作。这样就能避免手动配置多个外部接入点的繁琐工作。

很多团队并不是"自己从零搭建 K8s 集群 + 自己管网络"，而是：

- 通过 **CaaS（Container as a Service）平台**​ 来使用 K8s
- Ingress 和负载均衡由平台**作为托管能力提供**
- 团队只需要关心"我的应用怎么暴露出去"，不需要关心底层怎么实现

### What is a kubernetes Ingress Controller?
kubernetes ingress controller负责执行入口规则，它根据指定的入口配置，将外部的请求路由到kubernetes集群中的服务实例，该控制器是一个守护进程，它负责利用这些规则来决定如何负载均衡、路由处理以及管理流量。
目前有几种可用的入口控制器，每种控制器都具备不同的功能和性能特点。常见的选择包括 NGINX、HAProxy 和 Traefik。这些控制器通常提供诸如自定义指标统计、额外的安全控制等功能，而不仅仅是基本的入口管理功能。

### kubernetes ingress vs kubernetes egress
在管理网络流量方面，kubernetes的入口和出口功能发挥着不同的作用
ingress负责处理进来的连接请求，并将外部请求路由到集群内的相关服务。其核心目标是确保应用程序的访问安全并对其进行管理。
egress负责管理从集群内部到外部的服务的出站连接，从而控制各个Pod队外部系统的访问权限。出口组件对于集群内服务之间及进行通信至关重要。控制出口流量是确保安全的关键，因为只有经过授权的通信才能与外部系统进行交换。

### kubernetes ingress 与 kubernetes API gateway的区别
kuberneetes API gateway 的推出旨在解决kubernetes ingress功能的局限性问题，它通过提供一种标准化的流量管理模型，使得不同入口控制器能够协同工作。与仅专注HTTP流量的ignress不同，API gateway引入了更多用于复杂流量控制和灵活配置的资源对象。
同时支持L4和L7协议，为Kubernetes环境中的网络流量管理提供了更加全面的解决方案，通过诸如GatewayClass、Gateway和HTTPTRoute等新的资源对象，Gateway API能够实现更高级的路由管理和流量管理功能，并提高在不同控制器实现中的可移植性。

**Kubernetes Ingress 与 Gateway API 之间的主要区别：**
- 协议支持：Ingress 仅支持 L7 协议，如 HTTP 和 HTTPS；对于非 L7 协议，则需要使用自定义扩展来实现支持。而 API Gateway 则同时支持 L4 协议（例如 TCP、UDP）和 L7 协议。
- 可移植性：Ingress 定义因供应商而异，具有独特的语法和特性。Gateway API 能够在所有符合标准的控制器之间建立统一的标准，从而减少了对自定义配置的需求，使得迁移变得更加容易。
- 流量管理：Ingress 内置的流量管理功能有限，因此需要通过扩展来实现诸如请求镜像或 A/B 测试等功能。API Gateway 提供了对这些高级功能的支持，并且能够提供细粒度的指标数据。
- 资源对象定义：Ingress 不会引入新的资源对象，而 Gateway API 则会引入多个新的对象，包括 GatewayClass、Gateway 和 HTTPRoute 等。这些新对象使得对流量规则和功能的控制更加精细。
- 路由定制：入口路由仅限于基于路径或主机的路由方式。API Gateway 能够根据各种因素进行路由定制，包括任意头部字段、路径以及主机信息等。
- 可扩展性：在 Ingress 中增强诸如身份验证或速率限制等功能通常需要使用特定的注释。而在 API 网关中，这些功能已经内置在规范中，从而提供了更简单的扩展功能的方式。

### Kubernetes Ingress with Calico 
Calico Ingress Gateway网关利用了Kubernetes Gateway API，相比于传统的Ingress控制器，它有多种优势：
- Advanced traffic Management: 能够执行复杂的路由策略
- Modular and Extensible Architecture: 将实际的网关与路由规则分离开来，使得组织能够适应不断变化的网络需求
- Improved Portability and Consistency: 提升了可移植性和一致性， 确保能够在不同的kubernetes环境中顺畅运行
- Role-Based Management and Multi-Tenancy: 基于角色管理和多租户共享，简化了访问控制机制，使得资源共享更加高效
- Broader Use Cases: 更广泛的应用场景，支持非HTTP协议，能够灵活处理各种类型的流量。
- Future-Proof Design: 面相未来的设计，遵循供应商中立的标准，以避免陷入对特定供应商的依赖。
![[Pasted image 20260908160216.png]]

除了完全支持Kubernetes Gateway API的规范之外，Calico Ingress Gateway还计划为入站流量提供强大的安全性和可观测性功能，例如：
- Workload-Based WAF: 通过细致、针对具体应用的安全措施，来保护进入网络的节点
- Deep Packet Inspection(DPI): 深度包检查，能够检测恶意载荷
- DDoS Protection: 保护k8s集群免受分布式拒绝服务攻击的侵害
- Dynamic Service and Threat Graph: 能够清晰的显示流量模式，并提供更加完善的状态报告



### 在kubernetes中,DNS是如何工作的？
DNS是Kubernetes中的一个组件，它实现了服务发现以及不同Pod之间的通信，当集群中创建一个Pod或服务时,kubernetes胡自动为这些对象生成DNS记录。这样，像`service.namespace.svc.cluster.local` 这样的人类可读的域名就可以被转化为机器能识别的IP地址。

这些记录遵循特定的命名规范，由集群内部运行的DNS服务进行维护，通常使用CoreDNS服务，这个DNS服务确保每个Pod和服务都能够通过唯一且可解析的DNS域名进行访问，从而简化集群内的通信和集成工作。

当一个Pod发起DNS查询时，请求会被发送到集群内的CoreDNS服务器。CoreDNS会检查其数据库中的记录以解析该查询。如果DNS查询涉及内部服务或Pod，CoreDNS会返回相应的IP地址，对于外部的DNS查询，CoreDNS可以将请求转发给外部的DNS服务器进行处理。

#### 在k8s中，哪些对象会获得DNS记录？
*Pods*
在k8s中，每个拥有配置正确的DNS策略的pod都能有自己的DNS记录，Pod的DNS名称通常为 `pod-ip-address.namespace.pod.cluster.local` ，这种结构确保了每个Pod都能通过DNS被唯一标识，并在集群内部被正确访问。Pod的DNS记录有助于实现Pod和服务之间的网络通信，无论这些节点位于同一个节点上，还是分布在集群中的不同节点上。这一点对于保持依赖节点间通信的应用程序的功能至关重要。

*Services*
k8s中服务也会被记录DNS记录，这些记录使得其他服务或容器能够通过易于记忆的域名来定位这些服务，一个典型的DNS记录可能看起来像 `service.namespace.svc.cluster.local`。 这里的`service` 指的是k8s服务的名称，它提供了一个统一的端点，以便访问由该服务管理的容器。
为每个服务配置独立的DNS，可以解决Pod IP会动态变更的问题。这样即使集群中创建、销毁或者移动Pod时，系统也能保证持续的连接和可用性。

#### What is dnsPolicy in k8s
dnsPolicy是Pod配置中的一个规范，他规定了在Pod的容器中如何解析DNS请求。这在k8s集群中的网络通信中起着至关重要的作用，因为它决定了由哪个DNS服务来相应来自Pod的DNS请求。这一配置影响了服务和Pod在k8s集群内部和外部通过DNS进行相互查找的方式。
dnsPolicy设置提供了集中预定义的选项，每个选项都以不同的方式来操控DNS解析过程。

以下是一个ClusterFirst的DNS策略的容器清单示例：
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox
  namespace: default
spec:
  containers:
  - image: busybox:1.28
    command:
      - sleep
      - "3600"
    imagePullPolicy: IfNotPresent
    name: busybox
  restartPolicy: Always
  dnsPolicy: ClusterFirst
```

#### Values in dnsPolicy 
*Default*
默认的 dnsPolicy 策略会使用由运行该容器的节点所继承的 DNS 配置。这种策略非常简单，因为它依赖于宿主机的现有 DNS 设置，因此不需要在 Kubernetes 中进行任何特殊的配置。如果节点的 DNS 配置发生变化，那么容器中的 DNS 配置也会自动更新。
然而，虽然 Default 模式较为简单，不会将 DNS 服务隔离在集群内部，但在节点配置不同或需要将服务从一种集群环境迁移到另一种环境时，这种方式可能会引入复杂性。

*None*
当 dnsPolicy 被设置为 None 时，用户就可以完全控制 DNS 设置。如果使用此策略，用户必须明确指定 DNS 查询的解析方式，这可以通过提供 DNSConfig 来实现。这种设置适用于需要自定义 DNS 配置的场景，比如混合云环境或具有特殊网络架构的情况。None 策略特别适用于微调 DNS 配置，以优化性能或满足特定的安全需求。不过，需要仔细配置以确保 DNS 解析能够在集群中的所有节点和容器上正常运作。

*ClusterFirst*
ClusterFirst dnsPolicy 使得容器可以忽略宿主机的 DNS 设置，而只使用 Kubernetes 集群中指定的 DNS 服务器进行域名和服务的解析。这样就能确保集群内的域名和服务的 DNS 查询始终在集群内部进行解析。这通常是大多数 Kubernetes 部署的默认设置，能够提升内部连通性和安全性。
该政策旨在防止 DNS 查询被用于无法访问的集群内部资源。这样可以避免将集群内部的 DNS 查询泄露到外部 DNS 服务器上，从而保护集群的内部结构。

*ClusterFirstWithHostNet  使用主机网络进行集群划分*
对于启用了 hostNetwork 设置的 Pod 来说，应该使用 ClusterFirstWithHostNet dnsPolicy 策略。这一策略允许 Pod 使用主机的网络资源，同时优先处理内部集群的 DNS 解析，而不是查询外部 DNS 服务器，就像 ClusterFirst 策略一样。
该政策对于需要同时访问集群服务与外部网络的应用程序来说至关重要。它能够实现内部集群隔离与必要外部访问之间的最佳平衡，从而确保主机网络上的容器能够进行高效且安全的通信。

#### 在k8s中实现DNS策略的最佳实践
##### Fine-Tune CoreDNS 优化CoreDNS的功能






















