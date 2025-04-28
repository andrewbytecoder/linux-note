
Controller Manager是Kubernetes中各种操作系统的管理者， 是集群内部的管理控制中心， 也是Kubernetes自动化功能的核心。

Controller Manager内部包含Replication Controller、 Node Controller、 ResourceQuota Controller、 Namespace Controller、ServiceAccount Controller、 Token Controller、 Service Controller、Endpoint Controller、 Deployment Controller、 Router Controller、 Volume Controller等各种资源对象的控制器， 每种Controller都负责一种特定资源的控制流程， 而Controller Manager正是这些Controller的核心管理者

为了区分Controller Manager中的Replication Controller（副本控制器） 和资源对象Replication Controller， 我们将资源对象Replication Controller简写为RC， 而本节中的Replication Controller是指副本控制器。

## Replication Controller及Deployment Controller。

Replication Controller的核心作用是确保集群中某个RC关联的Pod副本数量在任何时候都保持预设值。 如果发现Pod的副本数量超过预设值， 则Replication Controller会销毁一些Pod副本； 反之， ReplicationController会自动创建新的Pod副本， 直到符合条件的Pod副本数量达到预设值。 需要注意： 只有当Pod的重启策略是Always时（RestartPolicy=Always） ， Replication Controller才会管理该Pod的操作（例如创建、 销毁、 重启等）。

RC中的Pod模板就像一个模具， 模具制作出来的东西一旦离开模具， 它们之间就再也没关系了。 同样， 一旦Pod被创建完毕， 无论模板如何变化， 甚至换成一个新的模板， 也不会影响到已经创建的Pod了。
此外， Pod可以通过修改它的标签来脱离RC的管控， 该方法可以用于将Pod从集群中迁移、 数据修复等的调试。 对于被迁移的Pod副本， RC会自动创建一个新的副本替换被迁移的副本。

Deployment可被视为RC的替代者， RC及对应的Replication Controller已不再升级、 维护， Deployment及对应的Deployment Controller则不断更新、 升级新特性。 Deployment Controller在工作过程中实际上是在控制两类相关的资源对象： Deployment及ReplicaSet。 在我们创建Deployment资源对象之后， Deployment Controller也默默创建了对应的ReplicaSet， Deployment的滚动升级也是Deployment Controller通过自动创建新的ReplicaSet来支持的。

- 确保在当前集群中有且仅有N个Pod实例， N是在RC中定义的Pod副本数量。
- 通过调整spec.replicas属性的值来实现系统扩容或者缩容。
- 通过改变Pod模板（主要是镜像版本） 来实现系统的滚动升级

## Node Controller

kubelet进程在启动时通过API Server注册自身节点信息， 并定时向API Server汇报状态信息， API Server在接收到这些信息后， 会将这些信息更新到etcd中。 在etcd中存储的节点信息包括节点健康状况、 节点资源、 节点名称、 节点地址信息、 操作系统版本、 Docker版本、 kubelet版本等。 节点健康状况包含就绪（True） 、 未就绪（False） 、 未知（Unknown） 三种。


## ResourceQuota Controller

Kubernetes提供了ResourceQuota Controller（资源配额管理） 这一高级功能， 资源配额管
理确保指定的资源对象在任何时候都不会超量占用系统物理资源， 避免由于某些业务进程在设计或实现上的缺陷导致整个系统运行紊乱甚至意外宕机， 对整个集群的平稳运行和稳定性都有非常重要的作用。

- 容器级别，可以对CPU和Memory进行限制
- Pod级别，可以对一个Pod内所有容器的可用资源进行限制。
- Namespace级别，可以对一个Namespace内的所有资源进行限制。包括Pod数量、Replication Controller数量、Service数量、Secret数量、以及可持有的PV数量。

Kubernetes的配额管理是通过Admission Control（准入控制） 来控制的， Admission Control当前提供了两种方式的配额约束， 分别是LimitRanger与ResourceQuota， 其中LimitRanger作用于Pod和Container；ResourceQuota则作用于Namespace， 限定一个Namespace里各类资源的使用总额。

## Namespace Controller

用户通过API Server可以创建新的Namespace并将其保存在etcd中，Namespace Controller定时通过API Server读取这些Namespace的信息。 如果Namespace被API标识为优雅删除（通过设置删除期限实现， 即设置DeletionTimestamp属性） ， 则将该NameSpace的状态设置成Terminating并保存在etcd中。 同时， Namespace Controller删除该Namespace下的ServiceAccount、 RC、 Pod、 Secret、 PersistentVolume、 ListRange、ResourceQuota和Event等资源对象

在Namespace的状态被设置成Terminating后， 由AdmissionController的NamespaceLifecycle插件来阻止为该Namespace创建新的资源。 同时， 在Namespace Controller删除该Namespace中的所有资源对象后， Namespace Controller会对该Namespace执行finalize操作， 删除Namespace的spec.finalizers域中的信息。

如果Namespace Controller观察到Namespace设置了删除期限， 同时Namespace的spec.finalizers域值是空的， 那么Namespace Controller将通过API Server删除该Namespace资源。


## Service Controller与Endpoints Controller

Endpoints表示一个Service对应的所有Pod副本的访问地址， Endpoints Controller就是负责生成和维护所有Endpoints对象的控制器。

Endpoints Controller负责监听Service和对应的Pod副本的变化， 如果监测到Service被删除， 则删除和该Service同名的Endpoints对象。 如果监测到新的Service被创建或者修改， 则根据该Service信息获得相关的Pod列表， 然后创建或者更新Service对应的Endpoints对象。 如果监测到Pod的事件， 则更新它所对应的Service的Endpoints对象（增加、 删除或者修改对应的Endpoint条目） 。

Endpoints对象被每个Node上的kube-proxy进程使用，kube-proxy进程获取每个Service的Endpoints， 实现了Service的负载均衡功能。

![[Pasted image 20250207111351.png]]

接下来说说Service Controller的作用， 它其实是Kubernetes集群与外部的云平台之间的一个接口控制器。 Service Controller监听Service的变化， 如果该Service是一个LoadBalancer类型的
Service（externalLoadBalancers=true） ， 则Service Controller确保该Service对应的LoadBalancer实例在外部的云平台上被相应地创建、 删除及更新路由转发表（根据Endpoints的条目） 。


## Scheduler原理解析

Kubernetes Scheduler是负责Pod调度的进程（组件）。Kubernetes集群里的Pod有无状态服务类、 有状态集群类及批处理
类三大类。

## Scheduler的调度流程

Kubernetes Scheduler在整个系统中承担了“承上启下”的重要功能， “承上”是指它负责接收Controller Manager创建的新Pod， 为其安排一个落脚的“家”—目标Node； “启下”是指安置工作完成后， 目标Node上的kubelet服务进程接管后续工作， 负责Pod生命周期中的“下半生”。

具体来说， Kubernetes Scheduler的作用是将待调度的Pod（API新创建的Pod、 Controller Manager为补足副本而创建的Pod等） 按照特定的调度算法和调度策略绑定（Binding） 到集群中某个合适的Node上， 并将绑定信息写入etcd中。 在整个调度过程中涉及三个对象， 分别是待调度Pod列表、 可用Node列表及调度算法和策略。 简单地说， 就是通过调度算法为待调度Pod列表中的每个Pod都从Node列表中选择一个最适合的Node。

随后， 目标节点上的kubelet通过API Server监听到Kubernetes Scheduler产生的Pod绑定事件， 然后获取对应的Pod清单， 下载Image镜像并启动容器。

- 过滤阶段： 遍历所有目标Node， 筛选出符合要求的候选节点。
- 打分阶段： 在过滤阶段的基础上， 采用优选策略（xxxPriorities） 计算出每个候选节点的积分， 积分最高者胜出， 因为积分最高者表示最佳人选。

过滤阶段中提到的Predicates是一系列过滤器， 每种过滤器都实现一种节点特征的检测， 比如磁盘（NoDiskConflict） 、 主机（ PodFitsHost） 、 节点上的可用端口（ PodFitsPorts） 、 节点标签（ CheckNodeLabelPresence） 、 CPU和内存资源（ PodFitsResources） 、服务亲和性（ CheckServiceAffinity） 等

在打分阶段提到的Priorities则用来对满足条件的Node节点进行打分， 常见的Priorities包含LeastRequestedPriority（ 选出资源消耗最小的节点） 、BalancedResourceAllocation（ 选出各项资源使用率最均衡的节点） 及
CalculateNodeLabelPriority（ 优先选择含有指定Label的节点） 等。Predicates与Priorities合在一起被称为Kubernetes Scheduling Policies， 需要特别注意。

## 多调度器特性

Kubernetes自带一个默认调度器， 从1.2版本开始引入自定义调度器的特性， 支持使用用户实现的自定义调度器， 多个自定义调度器可以与默认的调度器同时运行， 由Pod选择是用默认的调度器调度还是用某个自定义调度器调度。

## kubelet运行机制解析

在Kubernetes集群中， 在每个Node（又称Minion） 上都会启动一个kubelet服务进程。 该进程用于处理Master下发到本节点的任务， 管理Pod及Pod中的容器。 每个kubelet进程都会在API Server上注册节点自身的信息， 定期向Master汇报节点资源的使用情况， 并通过cAdvisor监控容器和节点资源。

## Pod管理

kubelet通过以下方式获取在自身Node上要运行的Pod清单。

- 静态Pod配置文件： kubelet通过启动参数--config指定目录下的Pod YAML文件（默认目录为/etc/kubernetes/manifests/） ， kubelet会持续监控指定目录下的文件变化， 以创建或删除Pod。 这种类型的Pod没有通过kube-controller-manager进行管理， 被称为“静态Pod”。 另外， 可以通过启动参数--file-check-frequency设置检查该目录的时间间隔， 默认为20s。
- HTTP端点（URL） ： 通过--manifest-url参数设置， 通过--httpcheck-frequency设置检查该HTTP端点数据的时间间隔， 默认为20s。
- API Server： kubelet通过API Server监听etcd目录， 同步Pod列表，所有以非API Server方式创建的Pod都叫作Static Pod。 kubelet将Static Pod的状态汇报给API Server， API Server为该Static Pod创建一个Mirror Pod与其匹配。 Mirror Pod的状态将真实反映Static Pod的状态。 当Static Pod被删除时， 与之相对应的Mirror Pod也会被删除。

kubelet读取监听到的信息， 如果是创建和修改Pod任务， 则做如下处理。

1. 为该Pod创建一个数据目录。
2. 从API Server中读取该Pod清单。
3. 为该Pod挂载外部卷（External Volume） 。
4. 下载Pod用到的Secret。
5. 检查已经运行在节点上的Pod， 如果该Pod没有容器或Pause容器（kubernetes/pause镜像创建的容器） 没有启动， 则先停止Pod里所有容器的进程。 如果在Pod中有需要删除的容器， 则删除这些容器。
6. 用kubernetes/pause镜像为每个Pod都创建一个容器。 该Pause容器用于接管Pod中所有其他容器的网络。 每创建一个新的Pod， kubelet都会先创建一个Pause容器， 然后创建其他容器。 kubernetes/pause镜像大概有200KB， 是个非常小的容器镜像。
7. 为Pod中的每个容器都做如下处理。
    - 为容器计算一个哈希值， 然后用容器的名称去查询对应Docker容器的哈希值。 若查找到容器， 且二者的哈希值不同， 则停止Docker中容器的进程， 并停止与之关联的Pause容器的进程； 若二者相同， 则不做任何处理。
    - 如果容器被终止， 且容器没有指定的restartPolicy（重启策略） ， 则不做任何处理。
    - 调用Docker Client下载容器镜像， 调用Docker Client运行容器。

## 容器健康检查

Pod通过两类探针来检查容器的健康状态。 一类是LivenessProbe探针， 用于判断容器是否健康并反馈给kubelet， 如果LivenessProbe探针探测到容器不健康， 则kubelet将删除该容器， 并根据容器的重启策略做相应的处理； 如果一个容器不包含LivenessProbe探针， 则kubelet会认为该容器的LivenessProbe探针返回的值永远是Success。 另一类是ReadinessProbe探针， 用于判断容器是否启动完成， 且准备接收请求。如果ReadinessProbe探针检测到容器启动失败， 则Pod的状态将被修改，
Endpoint Controller将从Service的Endpoint中删除包含该容器所在Pod的IP地址的Endpoint条目。

- ExecAction： 在容器内部运行一个命令， 如果该命令的退出状态码为0， 则表明容器健康。
- TCPSocketAction： 通过容器的IP地址和端口号执行TCP检查， 如果端口能被访问， 则表明容器健康。
- HTTPGetAction： 通过容器的IP地址和端口号及路径调用HTTP Get方法， 如果响应的状态码大于或等于200且小于或等于400， 则为容器状态健康。

## cAdvisor资源监控

cAdvisor是一个开源的分析容器资源使用率和性能特性的代理工具， 它是因为容器而产生的。 在Kubernetes项目中， cAdvisor被集成到Kubernetes代码中， kubelet则通过cAdvisor获取其所在节点及容器上的数据。cAdvisor自动查找其所在Node上的所有
容器， 自动采集CPU、 内存、 文件系统和网络使用的统计信息。

## kube-proxy运行机制解析

Kubernetes在创建服务时会为服务分配一个虚拟IP地址， 客户端通过访问这个虚拟IP地址来访问服务， 服务则负责将请求转发到后端的Pod上。 这其实就是一个反向代理， 但与普通的反向代理有一些不同：它的IP地址是虚拟， 若想从外面访问， 则还需要一些技巧； 它的部署和启停是由Kubernetes统一自动管理的。

在很多情况下， Service只是一个概念， 而真正将Service的作用落实的是它背后的kube-proxy服务进程。

第一代proxy已经弃用，从1.2版本开始， Kubernetes将iptables作为kube-proxy的默认模式，该模式也被称为第二代proxy。

![[image-2025-02-08-17-47-59-675.png]]

根据Kubernetes的网络模型， 一个Node上的Pod与其他Node上的Pod应该能够直接建立双向的TCP/IP通信通道， 所以如果直接修改iptables规则， 则也可以实现kube-proxy的功能， 只不过后者更加高端， 因为是全自动模式的。 与第一代的userspace模式相比， iptables模式完全工作在内核态， 不用再经过用户态的kube-proxy中转， 因而性能更强。

第二代的iptables模式实现起来虽然简单， 性能也提升很多， 但存在固有缺陷： 在集群中的Service和Pod大量增加以后， 每个Node节点上iptables中的规则会急速膨胀， 导致网络性能显著下降， 在某些极端情况下甚至会出现规则丢失的情况， 并且这种故障难以重现与排查。 于是Kubernetes从1.8版本开始引入第三代的IPVS（ IP Virtual Server） 模式

![[image-2025-02-08-17-49-21-502.png]]

iptables与IPVS虽然都是基于Netfilter实现的， 但因为定位不同， 二者有着本质的差别： iptables是为防火墙设计的； IPVS专门用于高性能负载均衡， 并使用更高效的数据结构（ 哈希表） ， 允许几乎无限的规模扩张， 因此被kube-proxy采纳为第三代模式。

*IPVS优势*

- 为大型集群提供了更好的可扩展性和性能
- 支持比iptables更复杂的复制均衡算法（最小负载、最少连接、加权等）
- 支持服务器健康检查和连接重试等功能
- 可以动态修改ipset的集合， 即使iptables的规则正在使用这个集合

由于IPVS无法提供包过滤、 airpin-masquerade tricks（地址伪装）、SNAT等功能， 因此在某些场景（如NodePort的实现） 下还要与iptables搭配使用。在IPVS模式下， kube-proxy又做了重要的升级， 即使用iptables的扩展ipset， 而不是直接调用iptables来生成规则链。

iptables规则链是一个线性数据结构， ipset则引入了带索引的数据结构， 因此当规则很多时， 也可以高效地查找和匹配。 我们可以将ipset简单理解为一个IP（段） 的集合， 这个集合的内容可以是IP地址、 IP网段、 端口等， iptables可以直接添加规则对这个“可变的集合”进行操作，这样做的好处在于大大减少了iptables规则的数量， 从而减少了性能损耗。 假设要禁止上万个IP访问我们的服务器， 则用iptables的话， 就需要一条一条地添加规则， 会在iptables中生成大量的规则； 但是用ipset的
话， 只需将相关的IP地址（网段） 加入ipset集合中即可， 这样只需设置少量的iptables规则即可实现目标






















