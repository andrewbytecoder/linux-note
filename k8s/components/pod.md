# Pod


## Pod 控制器(见容器编排)

大多数时间，用户通过更上层的控制器来完成 Pod 部署。上层的控制器包括 Deployment、 DaemonSet 以及 StatefulSet。




### Deployment

Pod 没有自愈能力，不能扩缩容，也不支持方便的升级和回滚。而Deployment 可以。

![[image-2025-02-26-16-47-33-139.png]]

### DaemonSet

### StatefulSet

## Pod的特性

### pod的原子操作单位

Pod 的部署是一个原子操作。这意味着，只有当 Pod 中的所有容器都启动成功且处于运行状态时， Pod 提供的服务才会被认为是可用的。对于部分启动的 Pod，绝对不会响应服务请求。整个 Pod 要么全部启动成功，并加入服务；要么被认为启动失败。





