
## Pod与Services

Pod 的 IP 地址是不可靠的。在某个 Pod 失效之后，它会被一个拥有新的 IP 的 Pod 代替。

Service 使用标签（ label） 与一个标签选择器（ label selector） 来决定应当将流量负载均衡到哪一个 Pod 集合。 Service 中维护了一个标签选择器（ label selector），其中包含了一个Pod 所需要处理的全部请求对应的标签。

![[image-2025-02-26-16-34-16-493.png]]

![[image-2025-02-26-16-39-00-423.png]]

![[image-2025-02-26-16-53-42-621.png]]

关于 Service 还有最后一件事情。 Service 只会将流量路由到健康的 Pod，这意味着如果 Pod 的健康检查失败， 那么 Pod 就不会接收到任何流量。


ClusterIP Service 拥有固定的 IP 地址和端口号，并且仅能够从集群内部访问得到。这一点被内部网络所实现，并且能够确保在 Service 的整个生命周期中是固定不变的。




