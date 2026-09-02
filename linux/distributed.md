## What is a deadlock
![[Pasted image 20260902111851.png]]


## 分布式开发常用英文

### 📚 一、核心概念（Core Concepts）

| 英文                           | 中文解释          |
| ---------------------------- | ------------- |
| Distributed System           | 分布式系统         |
| Node / Server / Instance     | 节点 / 服务器 / 实例 |
| Cluster                      | 集群            |
| Peer-to-Peer (P2P)           | 点对点网络         |
| Centralized vs Decentralized | 中心化 vs 去中心化   |
| Scalability                  | 可扩展性          |
| Fault Tolerance              | 容错性           |
| High Availability (HA)       | 高可用性          |
| Low Latency                  | 低延迟           |
| Throughput                   | 吞吐量           |
| Consistency                  | 一致性           |
| Availability                 | 可用性           |
| Partition Tolerance          | 分区容忍性         |
| CAP Theorem                  | CAP 定理        |
| Eventual Consistency         | 最终一致性         |
| Strong Consistency           | 强一致性          |
| Linearizability              | 线性一致性         |
| Idempotency                  | 幂等性           |
| Immutable                    | 不可变           |

---

### 🔗 二、通信与协议（Communication & Protocols）

| 英文                              | 中文解释               |
| ------------------------------- | ------------------ |
| RPC (Remote Procedure Call)     | 远程过程调用             |
| HTTP/HTTPS                      | 超文本传输协议            |
| gRPC                            | Google 的高性能 RPC 框架 |
| Message Queue / Messaging       | 消息队列               |
| Pub/Sub (Publish-Subscribe)     | 发布/订阅模型            |
| Load Balancer                   | 负载均衡器              |
| Service Discovery               | 服务发现               |
| Heartbeat                       | 心跳机制               |
| Lease                           | 租约机制               |
| Two-Phase Commit (2PC)          | 两阶段提交              |
| Three-Phase Commit (3PC)        | 三阶段提交              |
| Paxos                           | 一种共识算法             |
| Raft                            | 易于理解的共识算法          |
| Byzantine Fault Tolerance (BFT) | 拜占庭容错              |

---

### 🧩 三、架构与模式（Architecture & Patterns）

| 英文                         | 中文解释        |
| -------------------------- | ----------- |
| Microservices Architecture | 微服务架构       |
| Monolith                   | 单体应用        |
| Service Mesh               | 服务网格        |
| API Gateway                | API 网关      |
| Sidecar Pattern            | 边车模式        |
| Circuit Breaker            | 熔断器模式       |
| Retry Mechanism            | 重试机制        |
| Timeout                    | 超时机制        |
| Backoff Strategy           | 退避策略（如指数退避） |
| Sharding                   | 分片          |
| Replication                | 复制（主从、多主）   |
| Leader-Follower            | 主从架构        |
| Multi-Master               | 多主架构        |
| Data Partitioning          | 数据分区        |
| Horizontal Scaling         | 水平扩展        |
| Vertical Scaling           | 垂直扩展        |

---

### 🗄️ 四、数据与存储（Data & Storage）

| 英文                    | 中文解释      |
| --------------------- | --------- |
| Distributed Database  | 分布式数据库    |
| NoSQL                 | 非关系型数据库   |
| Key-Value Store       | 键值存储      |
| Distributed Cache     | 分布式缓存     |
| Consistent Hashing    | 一致性哈希     |
| Quorum                | 法定人数（多数派） |
| Write-Ahead Log (WAL) | 预写式日志     |
| Snapshot              | 快照        |
| Log Replication       | 日志复制      |
| Data Replication      | 数据复制      |
| Data Synchronization  | 数据同步      |
| Conflict Resolution   | 冲突解决      |

---

### 🛠️ 五、常见技术与工具（Technologies & Tools）

| 英文                      | 中文解释             |
| ----------------------- | ---------------- |
| Kubernetes (K8s)        | 容器编排系统           |
| Docker                  | 容器技术             |
| Apache Kafka            | 分布式消息系统          |
| Redis Cluster           | 分布式缓存集群          |
| etcd                    | 分布式键值存储（常用于服务发现） |
| ZooKeeper               | 分布式协调服务          |
| Elasticsearch           | 分布式搜索引擎          |
| Cassandra               | 分布式 NoSQL 数据库    |
| MongoDB Sharded Cluster | MongoDB 分片集群     |
| Nginx / Envoy           | 反向代理 / API 网关    |
| Istio / Linkerd         | 服务网格             |
| Prometheus / Grafana    | 监控与可视化           |

---

### ⚠️ 六、常见问题与挑战（Challenges）

| 英文                                        | 中文解释               |
| ----------------------------------------- | ------------------ |
| Network Partition                         | 网络分区（脑裂）           |
| Clock Skew                                | 时钟偏移               |
| Global Ordering                           | 全局顺序               |
| Distributed Tracing                       | 分布式追踪              |
| Deadlock / Starvation                     | 死锁 / 饥饿            |
| Split-Brain                               | 脑裂问题               |
| Single Point of Failure (SPOF)            | 单点故障               |
| Leader Election                           | 领导者选举              |
| Garbage Collection in Distributed Systems | 分布式垃圾回收            |
| Clock Synchronization                     | 时钟同步（如使用 NTP）      |
| Vector Clocks / Lamport Timestamps        | 向量时钟 / Lamport 时间戳 |

---

### 📝 七、常用表达句式（Useful Phrases）

- "The system is designed to be **fault-tolerant** and **highly available**."
- "We use **eventual consistency** to ensure availability during network partitions."
- "Data is **sharded** by user ID to improve scalability."
- "The service discovery mechanism helps nodes **locate each other dynamically**."
- "We implemented a **circuit breaker** to prevent cascading failures."
- "The Raft algorithm ensures **strong consistency** in the cluster."
- "This design follows the **microservices architecture** pattern."
- "To reduce latency, we use a **distributed cache** like Redis."



## 锁





### 互斥锁能保证原子性
同步互斥是影响并发系统性能的关键因素之一，一旦处理不当，甚至可能会引起死锁或者系统崩溃的危险。

![[Pasted image 20250928112638.png]]

在 Lock 加锁后进入临界区前、退出临界区后并执行 Unlock 之前，这两处都增加了内存屏障指令（不同 CPU 架构与 OS 上的实现存在一些差异，但其基本原理是类似的）。这样，编译期间通过这两个内存屏障，就实现了以下功能：

1. 限制了临界区与非临界区之间的指令重排序；
2. 保证在释放锁之前，临界区中的共享数据已经写入到了内存中，以此确保多线程间的缓存一致性。

线程长时间休眠会导致业务阻塞，从而就会影响到软件系统的性能。所以，在并发程序中使用互斥锁时，一个重要的性能优化手段就是减少临界区的大小，以此减少线程可能的阻塞时间。


### 自旋锁的原理和性能

![[Pasted image 20250928113037.png]]

自旋锁与互斥锁的逻辑差异主要体现在：当加锁失败时，当前线程并不会进入休眠态。所以如果你使用自旋锁这种实现方式，如果临界区执行开销比较小，就可以赚取等待时间开销小于线程休眠切换开销的额外收益了
在自旋锁中，临界区的实现机制与互斥锁基本是一致的，因此它也能解决前面提到的并发系统中的三个根源问题。


















































































































