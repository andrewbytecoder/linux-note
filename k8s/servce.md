


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