## top caching strategies
![[Pasted image 20260901194323.png]]
![[Pasted image 20260901193933.png]]



## cache eviction strategies
![[Pasted image 20260901194111.png]]

### LRU（最近最少使用）

LRU 淘汰策略优先移除**最近最少被访问**的数据。它的核心假设是：**刚被访问过的数据，在不久的将来更有可能再次被访问**（时间局部性原理）。

### MRU（最近最常使用 / 最近优先淘汰）

与 LRU 相反，MRU 优先淘汰**最近刚被使用过**的数据。这种策略适用于这类场景：**最新加载进来的数据反而不太会马上再被读到**（例如扫描式全表遍历、批量数据一次性处理、循环读取大文件等——新数据一进来就把老热点挤掉了，留新的反而没用）。

### SLRU（分段 LRU）

SLRU 将缓存划分为两个区段：**试探段（probationary）**​ 和 **保护段（protected）**。新写入的数据先进入试探段；若在试探段内被再次访问，则晋升到保护段。保护段里的数据只有在整体空间不足、且试探段也已排空时，才会被优先淘汰。

> 这是生产级缓存（如 Caffeine、Hazelcast）的常见实现，比朴素 LRU 更能抵抗“一次性扫描风暴”打穿缓存。

### LFU（最不经常使用）

LFU 优先淘汰**历史访问频次最低**的数据。它看重“访问密度”而非“访问时间”。

> 缺点：老热点会长期霸占缓存（缓存污染），且新上线的热门数据可能因初始频次低而被过早淘汰；实际中常做成 **LFU + 时间衰减（TinyLFU / W-TinyLFU）**​ 来弥补。

### FIFO（先进先出）

FIFO 是最简单的缓存策略：缓存像队列一样工作，**不管有没有被访问过、也不管访问多频繁，先放进去的先被淘汰**。

> 实现极简（一个队列），但命中率通常最低，基本只用于教学或对命中率无要求的极轻量场景。

### TTL（存活时间）

严格来说 TTL 不算“淘汰算法”，而是一种**过期策略**：给每个缓存项设定一个固定的生命周期，到期即视为失效（后续读取触发删除或后台异步清理）。

> 常与上述算法组合使用，例如“LRU + TTL 双保险”——既防空间爆满，也防脏数据长期驻留。

### 两级缓存（Two-Tiered Caching）

两级缓存策略中，**第一层用进程内内存缓存（Local Cache，如 Caffeine/Ehcache）**，**第二层用分布式缓存（如 Redis）**。

- 读请求：先查 L1，未命中再查 L2，最后回源 DB，并逐层回填
- 收益：扛住超高 QPS、避免 Redis 网络抖动放大成 DB 雪崩
- 代价：存在**数据一致性窗口**（各节点 L1 过期时间不同步），需配合 TTL 抖动、主动失效（pub/sub 广播清除）等方案

### RR / Random Replacement（随机替换）

随机替换算法**随机挑一个缓存项直接淘汰**，给新数据腾位置。实现同样极简，且**完全不需要统计访问时间或频次**（无锁、无额外内存开销）。

> 在缓存条目大小相近、访问模式近似均匀的场景下，命中率居然能逼近 LRU，因此某些高并发无锁缓存（如部分 slab 分配器、小型本地缓存）会用它换性能。

---

### 一页速览对比

| 策略     | 淘汰依据        | 实现成本 | 抗扫描风暴   | 典型落地                                  |
| ------ | ----------- | ---- | ------- | ------------------------------------- |
| LRU    | 最近是否用过      | 低    | ❌ 弱     | Redis `allkeys-lru`、Nginx proxy_cache |
| MRU    | 刚用过 → 先删    | 低    | ✅（特定场景） | 批量导入、全表扫描缓存                           |
| SLRU   | 分段 + 二次命中晋升 | 中    | ✅ 强     | Caffeine、Go 的 `ristretto`             |
| LFU    | 总访问次数最少     | 中高   | ✅       | Redis `allkeys-lfu`、热点key识别           |
| FIFO   | 入队先后        | 极低   | ❌       | 嵌入式/极简缓存                              |
| TTL    | 存活时长        | 极低   | —（配合用）  | 会话、短信验证码、配置缓存                         |
| 两级缓存   | 架构层组合       | 高    | ✅✅      | 本地 Caffeine + 远端 Redis                |
| Random | 随机抽         | 极低   | ⚠️ 看运气  | 无锁高并发本地池                              |


## Which Latency Numbers Should You Know?
![[Pasted image 20260902101003.png]]

- **L1 and L2 caches: 1 ns, 10 ns  
    L1 和 L2 缓存：1 纳秒，10 纳秒**
    
    E.g.: They are usually built onto the microprocessor chip. Unless you work with hardware directly, you probably don’t need to worry about them.  
    例如：它们通常被集成在微处理器芯片上。除非你直接处理硬件相关的工作，否则你不需要担心这些问题。
    
- **RAM access: 100 ns  RAM 访问时间：100 纳秒**
    
    E.g.: It takes around 100 ns to read data from memory. Redis is an in-memory data store, so it takes about 100 ns to read data from Redis.  
    例如：从内存中读取数据大约需要 100 纳秒。而 Redis 是一种内存数据库，因此从 Redis 中读取数据同样也需要大约 100 纳秒。
    
- **Send 1K bytes over 1 Gbps network: 10 us  
    通过 1 Gbps 的网络传输 1K 字节数据：10 美元**
    
    E.g.: It takes around 10 us to send 1KB of data from Memcached through the network.  
    例如：通过网络从 Memcached 中发送 1KB 的数据大约需要 10 个用户时间。
    
- **Read from SSD: 100 us  
    从固态硬盘读取：100 美元**
    
    E.g.: RocksDB is a disk-based K/V store, so the read latency is around 100 us on SSD.  
    例如：RocksDB 是一种基于磁盘的 K/V 型存储系统，因此在 SSD 设备上，读取操作的延迟约为 100 微秒。
    
- **Database insert operation: 1 ms  
    数据库插入操作：耗时 1 毫秒**
    
    E.g.: Postgresql commit might take 1ms. The database needs to store the data, create the index, and flush logs. All these actions take time.  
    例如：PostgreSQL 的提交操作可能需要 1 毫秒。数据库需要存储数据、创建索引，并刷新日志。所有这些操作都需要时间来完成。
    
- **Send packet CA->Netherlands->CA: 100 ms  
    发送数据包从加拿大到荷兰的传输时间为 100 毫秒。**
    
    E.g.: If we have a long-distance Zoom call, the latency might be around 100 ms.  
    例如：如果我们进行远程视频通话，延迟可能会达到约 100 毫秒。
    
- **Retry/refresh internal: 1-10s  
    重试/刷新间隔：1-10 秒**
    
    E.g: In a monitoring system, the refresh interval is usually set to 5~10 seconds (default value on Grafana).  
    例如，在监控系统中，刷新间隔通常设置为 5 到 10 秒（Grafana 的默认值）。
    

### Notes  备注

1 ns = 10^-9 seconds 1 us = 10^-6 seconds = 1,000 ns 1 ms = 10^-3 seconds = 1,000 us = 1,000,000 ns  
1 纳秒 = 10^-9 秒 1 微秒 = 10^-6 秒 = 1,000 纳秒 1 毫秒 = 10^-3 秒 = 1,000 微秒 = 1,000,000 纳秒




























