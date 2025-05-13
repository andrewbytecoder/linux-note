

## CAP理论

在数据库理论中， CAP 定理 （也以计算机科学家 Eric Brewer 的名字命名为 Brewer 定理） 指出，任何分布式数据存储只能提供以下三个保证中的两个

- Consistency  一致性

 每次读取要么获得最近写入的数据，要么获得一个错误。

- Availability  可用性

 每次请求都能获得一个（非错误）响应，但不保证返回的是最新写入的数据。

- Partition tolerance  分区容错

 尽管任意数量的消息被节点间的网络丢失（或延迟），系统仍继续运行。

当发生网络分区故障时，必须决定是否执行以下操作之一：

取消操作，从而降低可用性，但确保一致性(etcd)
继续操作，从而提供可用性，但存在不一致的风险。请注意，这并不一定意味着系统对用户来说是高可用的 。

因此，如果存在网络分区，则必须在一致性和可用性之间做出选择。

也就是说，CAP 定理表明，在存在网络分区的情况下，一致性和可用性必须二选一。而在没有发生网络故障时，即分布式系统正常运行时，一致性和可用性是可以同时被满足的。这里需要注意的是，CAP 定理中的一致性与 ACID 数据库事务中的一致性截然不同。

掌握 CAP 定理，尤其是能够正确理解 C、A、P 的含义，对于系统架构来说非常重要。因为对于分布式系统来说，网络故障在所难免，如何在出现网络故障的时候，维持系统按照正常的行为逻辑运行就显得尤为重要。你可以结合实际的业务场景和具体需求，来进行权衡。

对于大多数互联网应用来说（如门户网站），因为机器数量庞大，部署节点分散，网络故障是常态，可用性是必须要保证的，所以只有舍弃一致性来保证服务的 AP。而对于银行等，需要确保一致性的场景，通常会权衡 CA 和 CP 模型，CA 模型网络故障时完全不可用，CP 模型具备部分可用性。

CA (consistency + availability)，这样的系统关注一致性和可用性，它需要非常严格的全体一致的协议，比如“两阶段提交”（2PC）。CA 系统不能容忍网络错误或节点错误，一旦出现这样的问题，整个系统就会拒绝写请求，因为它并不知道对面的那个结点是否挂掉了，还是只是网络问题。唯一安全的做法就是把自己变成只读的。

CP (consistency + partition tolerance)，这样的系统关注一致性和分区容忍性。它关注的是系统里大多数人的一致性协议，比如：Paxos 算法（Quorum 类的算法）。这样的系统只需要保证大多数结点数据一致，而少数的结点会在没有同步到最新版本的数据时变成不可用的状态。这样能够提供一部分的可用性。

AP (availability + partition tolerance)，这样的系统关心可用性和分区容忍性。因此，这样的系统不能达成一致性，需要给出数据冲突，给出数据冲突就需要维护数据版本。Dynamo 就是这样的系统。

https://www.youtube.com/watch?v=srOgpXECblk[谷歌的Transaction Across DataCenter 视频]

https://en.wikipedia.org/wiki/CAP_theorem[CAP_theorem wiki]

https://www.the-paper-trail.org/post/2014-08-09-distributed-systems-theory-for-the-distributed-systems-engineer/[distributed]

https://book.mixu.net/distsys/[distribute system]

https://www.somethingsimilar.com/2013/01/14/notes-on-distributed-systems-for-young-bloods/[distribute system study]




## 算法

### Paxos

- zookeeper
ZooKeeper 有和 Paxos 非常相似的一些特征，比如领导选举、提案号等，但是它本质上不是 Paxos 协议，而是自己发明的 Zab 协议，具体实现可以参考论文：[Zab: High-performance broadcast for primary-backup systems](https://www.semanticscholar.org/paper/Zab%3A-High-performance-broadcast-for-primary-backup-Junqueira-Reed/b02c6b00bd5dbdbd951fddb00b906c82fa80f0b3?p2df)


- paxos 动画演示paxos算法实现
[neat-algorithms-paxos](https://harry.me/blog/2014/12/27/neat-algorithms-paxos/)


### raft算法



[raft算法实现论文](chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/https://raft.github.io/raft.pdf)
[thesecretlivesofdata动画演示](https://thesecretlivesofdata.com/raft/)
[raft.github各种实现搜集](https://raft.github.io/)
[kanaka.github数据同步演示](https://kanaka.github.io/raft.js/)


### Gossip 协议
Gossip 算法也是 Cassandra 使用的数据复制协议。这个协议就像八卦和谣言传播一样，可以 “一传十、十传百”传播开来。但是这个协议看似简单，细节上却非常麻烦。

[Efficient Reconciliation and Flow Control for Anti-Entropy Protocols](chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/https://www.cs.cornell.edu/home/rvr/papers/flowgossip.pdf)




数据库和应用程序服务器在应对互联网上数以亿计的访问量的时候，需
要能进行横向扩展，这样才能提供足够高的性能。为了做到这一点，要学习分布式技术架
构，包括负载均衡、DNS 解析、多子域名、无状态应用层、缓存层、数据库分片、容错
和恢复机制、Paxos、Map/Reduce 操作、分布式 SQL 数据库一致性（以 Google
Cloud Spanner 为代表）等知识点




在关于集群的可用性（ availability） 这一点上， etcd 认为一致性比可用性更加重要。这意味着 etcd 在出现脑裂的情况时，会停止为集群提供更新能力，来保证存储数据的一致性。








## 附录

[allthingsdistributed搜集和分布式系统相关的事件和论文](https://www.allthingsdistributed.com/)
[Spanner: Google’s Globally-Distributed Database](chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/https://static.googleusercontent.com/media/research.google.com/zh-CN//archive/spanner-osdi2012.pdf)
目前，基于 Spanner 论文的开源实现有两个，一个是 Google 公司自己的人出来做的CockroachDB，另一个是国人做的TiDB

[Distributed Systems for fun and profit](https://book.mixu.net/distsys/single-page.html)
[设计数据密集型应用](https://book.douban.com/subject/27154352/)
[Distributed Systems: Principles and Paradigms](http://barbie.uta.edu/~jli/Resources/MapReduce&Hadoop/Distributed%20Systems%20Principles%20and%20Paradigms.pdf)
[Scalable Web Architecture and Distributed Systems](https://aosabook.org/en/v2/distsys.html)
[可扩展的 Web 架构和分布式系统](https://nettee.github.io/posts/2016/Scalable-Web-Architecture-and-Distributed-Systems/)



[日志：每个软件工程师都应该知道的有关实时数据的统一抽象](https://github.com/oldratlee/translations/blob/master/log-what-every-software-engineer-should-know-about-real-time-datas-unifying/README.md)

