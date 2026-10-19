## 概述
我们实际使用场景中，可以使用kubernetes节点标签，有选择性的选择部分节点作为BGP对等体接入。这种方法对于大型集群来说非常重要，因为如果使用ToR交换机来连接所有节点，将会产生过多的BGP会话。
在大型kubernetes集群中，每个节点都和ToR建立BGP连接会存在如下挑战：

|Challenge|Impact|
|---|---|
|**BGP Session Overhead**|Each node requires a dedicated BGP session, consuming ToR resources|
|**Control Plane Load**|More BGP peers = more route updates = higher CPU/memory usage on network devices|
|**Scalability Limits**|ToR switches have finite BGP peer capacity (often 64-128 peers)|
|**Operational Complexity**|More sessions to monitor, troubleshoot, and maintain|
>指定一部分节点作为BGP speakers，这些节点会与网络基础设施进行通信，并代表集群来广播路由信息。

## Traffic Flow 说明
- 外部客户端想 LoadBalancer的IP地址 `172.16.0.241` 发送流量

