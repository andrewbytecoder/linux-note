



## k8s service详解

一个最简单的Kubernetes Service的定义如下
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
  labels:
    app: nginx
spec:
  clusterIP: 100.101.28.148
  selector:
    app: nginx
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: ClusterIP  # 可根据需要更改为 NodePort 或 LoadBalancer
  sessionAffinity: ClientIP
```
其中， spec.ClusterIP就是Service的（其中一个） 访问IP， 俗称虚IP（Virtual IP， 即VIP） 。 如果用户不指定的话， 那么Kubernetes Master会自动从一个配置范围内随机分配

该Service的selector是app:nginx， 即匹配那些被打上app=nginx标签的Pod。

spec.ports［］ .port是Service的访问端口， 而与之对应的spec.ports［］ .targetPort是后端Pod的端口， Kubernetes会自动做一次映射（80->8080） 

如果觉得通过yaml方式创建Service太麻烦， 则kubectl还提供了expose子命令直接将deployment暴露成服务。`kubectl expose deployment/whoami` 等价于使用 `kubectl create -f ` 命令创建service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
        resources:
          limits:
            memory: "128Mi"
            cpu: "200m"
          requests:
            memory: "64Mi"
            cpu: "100m"
```


测试发现， 访问whoami服务会随机转发给后端Pod，在默认情况下， 服务会随机转发到可用的后端。 如果希望保持会话（同一个client永远都转发到相同的Pod） ， 可以把service.spec.sessionAffinity设置为ClientIP， 即基于客户端源IP的会话保持， 而且默认会话保持时间是10800秒。这会起到什么样的效果呢？ 即在3小时内， 同一个客户端访问同一服务的请求都会被转发给第一个Pod。

### port、targetPort和NodePort

Service的几个port的概念很容易混淆， 它们分别是port、 targetPort和NodePort。

port表示Service暴露的服务端口， 也是客户端访问用的端口， 例如Cluster IP:port是提供给集群内部客户访问Service的入口。 需要注意的是， port不仅是Cluster IP上暴露的端口， 还可以是external IP和Load Balancer IP。 Service的port并不监听在节点IP上， 即无法通过节点IP:port的方式访问Service
NodePort是Kubernetes提供给集群外部访问Service入口的一种方式（另一种方式是Load Balancer） ， 所以可以通过Node IP:nodePort的方式提供集群外访问Service的入口。
targetPort很好理解， 它是应用程序实际监听Pod内流量的端口， 从port和NodePort上到来的数据， 最终经过Kube-proxy流入后端Pod的targetPort进入容器。
在配置服务时， 可以选择定义port和targetPort的值重新映射其监听端口， 这也被称为Service的端口重映射。 Kube-proxy通过在节点上iptables规则管理此端口的重新映射过程。

### service类型选型
#### Cluster IP
Kubernetes Service有几种类型： Cluster IP、 Load Balancer和NodePort。 其中， Cluster IP是默认类型， 自动分配集群内部可以访问的虚IP——Cluster IP。 我们随便创建一个Service， 只要不做特别指定， 都是Cluster IP类型。 Cluster IP的主要作用是方便集群内Pod到Pod之间的调用。
Cluster IP主要在每个node节点使用iptables， 将发向Cluster IP对应端口的数据转发到后端Pod中。

#### Load Balancer
我们已经了解了Kubernetes如何使用Service为Pod内运行的应用提供稳定的IP地址。 在默认情况下， Pod不会公开一个外部IP地址， 而是由每个节点上的Kube-proxy管理所有流量。 集群内的Pod之间可以自由通信， 但集群外的连接无法访问服务。 例如， 集群外部的客户端无法通过Cluster IP访问Service。
Load Balancer（简称LB） 类型的Service需要Cloud Provider的支持。 Kubernetes原生支持的Cloud Provider有GCE和AWS， 因此和不同云平台的网络方案耦合较大， 而且只能在特定的云平台上使用， 局限性也较大。 除了“外用”， Load Balancer还可以“内服”， 即如果要在集群内访问Load Balancer类型的Service， 则Kube-proxy用iptables或ipvs实现云服务提供商Load Balancer（一般都是L7的） 的部分功能： L4转发、 安全组规则等
说到安全组规则， 在默认情况下， 来自任何外部IP地址的流量都可以访问Load Balancer类型的服务。 创建Service时， 通过配置serviceSpec.loadBalancerSourceRanges字段， 可以限制哪些IP地址范围可以访问集群内的服务。 loadBalancerSourceRanges可以指定多个范围， 并且支持随时更新。 Kube-proxy会配置该节点的iptables规则， 以拒绝与指定loadBalancerSourceRanges不匹配的所有流量。 这样就不需要额外配置VPC的防火墙规则了。

#### NodePort
NodePort类似Service， 被称为乞丐版的Load Balancer类型Service，这也暗示了Node-Port Service可以用于集群外部访问Service， 而且成本低廉（无须一个外部Load Balancer） 。
NodePort为Service在Kubernetes集群的每个节点上分配一个真实的端口， 即NodePort。 集群内/外部可基于集群内任何一个节点的IP:NodePort的形式访问Service。 NodePort支持TCP、 UDP、 SCTP， 默认端口范围是30000-32767， Kubernetes在创建NodePort类型Service对象时会随机选取一个。 用户也可以在Service的spec.ports.nodePort中自己指定一个NodePort端口， 就像指定Cluster IP那样。 如果觉得默认端口范围不够用或者太大， 可以修改API Server的--service-node-port-range的参数，修改默认NodePort的范围， 例如--service-node-port-range=8000-9000。

NodePort的实现机制是Kube-proxy会创建一个iptables规则， 所有访问本地NodePort的网络包都会被直接转发至后端Port。 NodePort会在主机上打开（但不监听） 一个实际的端口， 当NodePort类型服务创建并且被Kube-proxy感知后， 可以通过以下命令验证某个端口（例如9000） 是否打开：
```bash
lsof -i :9000
```

> 在一般情况下， 不建议用户自己指定NodePort， 而是应该让Kubernetes选择， 否则维护的成本会很高。

### service发现
#### 特殊的无头Service
所谓的无头（headless） Service即没有selector的Service。 Servcie抽象了该如何访问Kubernetes Pod， 也能够抽象其他类型的backend， 例如
- 希望在生产环境中使用外部的数据库集群， 但在测试环境使用自己的数据库
- 希望服务指向另一个namespace中或其他集群中的服务；
- 正在将工作负载转移到Kubernetes集群， 以及运行在Kubernetes集群之外的backend。

使用service将数据导出到外部，这个Service没有selector， 就不会创建相关的Endpoints对象。 可以手动将Service映射到指定的Endpoints
使用场景：内部service需要在外部进行调试

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dp-proxy
  namespace: base-services
spec:
  ports:
    - protocol: TCP
      port: 11090  # 服务暴露的端口，可以与 Endpoints 端口相同或不同
      targetPort: 11090  # 这里指向 Endpoints 中的端口
  type: ClusterIP  # 默认类型，适用于内部访问


---
apiVersion: v1
kind: Endpoints
metadata:
  name: dp-proxy
  namespace: base-services
subsets:
  - addresses:
      - ip: 192.168.38.31   # 外部服务的IP
    ports:
      - port: 11090         # 外部服务的端口
```

ExternalName Service是Service的特例， 它没有selector， 也没有定义任何的端口和Endpoint。 相反， 对于运行在集群外部的服务， 它通过返回该外部服务的别名这种方式提供服务。
```yaml
apiVersion: v1
kind: Service
metadata:
  name: dp-proxy
  namespace: base-services
spec:
  type: ExternalName
  externalName: my.database.example.com
```

### 怎么访问本地服务
当访问NodePort或Load Balancer类型Service的流量到底节点时， 流量可能会被转发到其他节点上的Pod。 这可能需要额外一跳的网络。 如果要避免额外的跃点， 则用户可以指定流量必须转到最初接收流量的节点上的Pod。

要指定流量必须转到同一节点上的Pod， 可以将serviceSpec.externalTraffic Policy设置为Local（默认是Cluster） ：
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-lb-service
spec:
  type: LoadBalancer
  # 保证将流量转发到本节点
  externalTrafficPolicy: Local
  selector:
    app: demo
    component: users
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
```

将externalTrafficPolicy设置为Local时， 负载平衡器仅将流量发送到具有属于服务的正常Pod所在的节点。 每个节点上的Kube-proxy都健康运行， 检查服务器对外提供该节点上的Endpoint信息， 以便系统确定哪些节点具有适当的Pod。

那么问题来了， 为什么externalTrafficPolicy只支持NodePort和Load Balancer的Service， 不支持Cluster IP呢？ 原因在于externalTrafficPolicy的设定是当流量到达确定的节点后， 再由Kube-proxy在该节点上找Service的Endpoint。 有些节点上存在Service Endpoint， 有些则没有， 再配合Kube-proxy的健康检查就能确定哪些节点上有符合要求的后端Pod。 访问NodePort和Load Balancer都能指定节点， 但Cluster IP无法指定节点，因此Service流量就永远出不了发起访问的客户端的那个节点， 这也不是externalTrafficPolicy这个特性的设计初衷。


## k8s service实现细节
Kube-proxy的Load Balancer模块实现有userspace、 iptables和IPVS三种， 当前主流的实现方式是iptables和IPVS。 随着iptables在大规模环境下暴露出了扩展性和性能问题， 越来越多的厂商开始使用IPVS模式。

Kube-proxy的转发模式可以通过启动参数--proxy-mode进行配置，有userspace、 iptables、 ipvs等可

### userspace 模式
Kube-proxy的userspace模式是通过Kube-proxy用户态程序实现Load Balancer的代理服务。 userspace模式是Kube-proxy 1.0之前版本的默认模式。 由于转发发生在用户态， 效率自然不太高， 而且容易丢包。

因为iptables和IPVS模式都依赖Linux内核的能力， 尤其是IPVS， 而且iptables和IPVS都要求较高版本的内核和iptables版本。 那些使用低版本内核的操作系统（例如SUSE 11） 用不了iptables和IPVS模式， 但又希望拥有基本的服务转发能力， 这时userspace模式就派上用场了。
![[Pasted image 20250905170646.png]]不难看出在userspace模式下， 访问服务的请求到达节点后首先会进入内核iptables， 然后回到用户空间， 由Kube-proxy完成后端Pod的选择， 并建立一条到后端Pod的连接， 完成代理转发工作。 这样流量从用户空间进出内核将带来不小的性能损耗。

至于为什么userspace模式要建立iptables规则， 原因是Kube-proxy进程只监听一个端口， 而且这个端口并不是服务的访问端口也不是服务的NodePort， 因此需要一层iptables把访问服务的连接重定向给Kube-proxy进程的一个临时端口。 Kube-proxy在代理客户端请求时会开放一个临时端口， 以便后端Pod的响应返回给Kube-proxy， 然后Kube-proxy再返回给客户端

### iptables模式
![[Pasted image 20250905171131.png]]
iptables模式与userspace模式最大的区别在于， Kube-proxy利用iptables的DNAT模块， 实现了Service入口地址到Pod实际地址的转换，免去了一次内核态到用户态的切换。
iptables模式与userspace模式相比虽然在稳定性和性能上均有不小的提升， 但因为iptable使用NAT完成转发， 也存在不可忽视的性能损耗。另外， 当集群中存在上万服务时， Node上的iptables rules会非常庞大，对管理是个不小的负担， 性能还会大打折扣。

![[Pasted image 20250905171712.png]]

### IPVS模式

IPVS是LVS的负载均衡模块， 亦基于netfilter， 但比iptables性能更高， 具备更好的可扩展性。 Kube-proxy的IPVS模式在Kubernetes 1.11版本达到稳定。

既然Kube-proxy已经有了iptables模式， 为什么Kubernetes还选择IPVS呢？ 随着Kubernetes集群规模的增长， 其资源的可扩展性变得越来越重要， 特别是对那些运行大型工作负载的企业， 其服务的可扩展性尤其重要。 要知道， iptables难以扩展到支持成千上万的服务， 它纯粹是为防火墙而设计的， 并且底层路由表的实现是链表， 对路由规则的增删改查操作都涉及遍历一次链表。

尽管Kubernetes在1.6版本中已经支持5000个节点， 但使用iptables模式的Kube-proxy实际上是将集群扩展到5000个节点的最大瓶颈。 一个例子是， 如果我们有1000个服务并且每个服务有10个后端Pod， 将在每个工作节点上至少产生10000×N（N≥4） 个iptable记录， 这可能使内核非常繁忙地处理每次iptables规则的刷新。
另外， 使用IPVS做集群内服务的负载均衡可以解决iptables带来的性能问题。 IPVS专门用于负载均衡， 并使用更高效的数据结构（散列表） ， 允许几乎无限的规模扩张。

#### 1.IPVS的工作原理
IPVS是Linux内核实现的四层负载均衡， 是LVS负载均衡模块的实现。 上文也提到， IPVS基于netfilter的散列表， 相对于同样基于netfilter框架的iptables有更好的性能表现和可扩展性，
IPVS支持TCP、 UDP、 SCTP、 IPv4、 IPv6等协议， 也支持多种负载均衡策略， 例如rr、 wrr、 lc、 wlc、 sh、 dh、 lblc等。 IPVS通过persistent connection调度算法原生支持会话保持功能。
![[Pasted image 20250905172611.png]]

简单说， 当外机的数据包首先经过netfilter的PREROUTING链， 然后经过一次路由决策到达INPUT链， 再做一次DNAT后经过FORWARD链离开本机网路协议栈。 由于IPVS的DNAT发生在netfilter的INPUT链，因此如何让网路报文经过INPUT链在IPVS中就变得非常重要了。 一般有两种解决方法， 一种方法是把服务的虚IP写到本机的本地内核路由表中； 另一种方法是在本机创建一个dummy网卡， 然后把服务的虚IP绑定到该网卡上。 Kubernetes使用的是第二种方法， 详见下文

IPVS支持三种负载均衡模式： Direct Routing（简称DR） 、Tunneling（也称ipip模式） 和NAT（也称Masq模式） 。

##### DR
IPVS的DR模式如图所示。 DR模式是应用最广泛的IPVS模式，它工作在L2， 即通过MAC地址做LB， 而非IP地址。 在DR模式下， 回程报文不会经过IPVS Director而是直接返回给客户端。 因此， DR在带来高性能的同时， 对网络也有一定的限制， 即要求IPVS的Director和客户端在同一个局域网内。 另外， 比较遗憾的是， DR不支持端口映射， 无法支撑Kubernetes Service的所有场景。
![[Pasted image 20250905173100.png]]
##### Tunneling
IPVS的Tunneling模式就是用IP包封装IP包， 因此也称ipip模式， 如图所示。 Tunneling模式下的报文不经过IPVS Director， 而是直接回复给客户端。 Tunneling模式同样不支持端口映射， 因此很难被用在Kubernetes的Service场景中。
![[Pasted image 20250905173147.png]]
##### NAT
IPVS的NAT模式支持端口映射， 回程报文需要经过IPVS Director，因此也称Masq（伪装） 模式， 如图所示。 Kubernetes在用IPVS实现Service时用的正是NAT模式。 当使用NAT模式时， 需要注意对报文进行一次SNAT， 这也是Kubernetes使用IPVS实现Service的微秒（tricky） 之处。
![[Pasted image 20250905173307.png]]


#### 2.Kube-proxy IPVS模式参数
在运行基于IPVS的Kube-proxy时， 需要注意以下参数
- --proxy-mode： 除了现有的userspace和iptables模式， IPVS模式通过--proxy-mode=ipvs进行配置；
- --ipvs-scheduler： 用来指定IPVS负载均衡算法， 如果不配置则默认使用roundrobin（rr） 算法。 支持配置的负载均衡算法有：
	- rr：轮询
	- lc：最小连接
	- dh：目的地址哈希
	- sh：源地址哈希
	- sed：最短时延
- --cleanup-ipvs： 类似于--cleanup-iptables参数。 如果设置为true， 则清除在IPVS模式下创建的IPVS规则；
- --ipvs-sync-period： 表示Kube-proxy刷新IPVS规则的最大间隔时间， 例如5秒、 1分钟等， 要求大于0
- -ipvs-min-sync-period： 表示Kube-proxy刷新IPVS规则的最小时间间隔， 例如5秒、 1分钟等， 要求大于0
- --ipvs-exclude-cidrs： 用于在清除IPVS规则时告知Kube-proxy不要清理该参数配置的网段的IPVS规则。 因为我们无法区分某条IPVS规则到底是Kube-proxy创建的， 还是其他用户程序的， 配置该参数是为了避免误删用户自己的IPVS规则。

#### 3.IPVS模式实现原理
Kube-proxy IPVS模式的工作原理如图
![[Pasted image 20250905173806.png]]
一旦创建一个Service和Endpoints， IPVS模式的Kube-proxy会做以下三件事情。
1. 确保一块dummy网卡（kube-ipvs0） 存在。 为什么要创建dummy网卡？ 因为IPVS的netfilter钩子挂载INPUT链， 我们需要把Service的访问IP绑定在dummy网卡上让内核“觉得”虚IP就是本机IP， 进而进入INPUT链。
2. 把Service的访问IP绑定在dummy网卡上
3. 通过socket调用， 创建IPVS的virtual server和real server， 分别对应Kubernetes的Service和Endpoints。

#### 4.IPVS模式中的iptables和ipset
IPVS用于流量转发， 它无法处理Kube-proxy中的其他问题， 例如包过滤、 SNAT等。 具体来说， IPVS模式的Kube-proxy将在以下4种情况下依赖iptables：

- Kube-proxy配置启动参数masquerade-all=true， 即集群中所有经过Kube-proxy的包都做一次SNAT；
- Kube-proxy启动参数指定集群IP地址范围
- 支持Load Balancer类型的服务， 用于配置白名单
- 支持NodePort类型的服务， 用于在包跨节点前配置MASQUERADE， 类似于上文提到的iptables模式。

我们不想创建太多的iptables规则， 因此使用ipset减少iptables规则，使得不管集群内有多少服务， IPVS模式下iptables规则的总数在5条以内

### iptables VS.IPVS

| Service 数量 | iptables 规则数量 | 增加 1 条 iptables 规则时延 | 增加 1 条 IPVS 规则时延 |
| ---------- | ------------- | -------------------- | ---------------- |
| 1          | 8             | 50 us                | 30 us            |
| 5000       | 40000         | 11 mins              | 50 us            |
| 20000      | 160000        | 5 hours              | 70 us            |
通过上表我们可以发现， IPVS刷新规则的时延明显要低iptables几个数量级。


### conntrack

在内核中， 所有由netfilter框架实现的连接跟踪模块称作conntrack（connection tracking） 。 在DNAT的过程中， conntrack使用状态机启动并跟踪连接状态。 为什么需要记录连接的状态呢？ 因为iptables/IPVS做了DNAT后需要记住数据包的目的地址被改成了什么，并且在返回数据包时将目的地址改回来。 除此之外， iptables还可以依靠conntrack的状态（cstate） 决定数据包的命运。 其中最主要的4个conntrack状态如下：

- NEW： 匹配连接的第一个包， 这表示conntrack对该数据包的信息一无所知。 通常发生在收到SYN数据包时。
- ESTABLISHED： 匹配连接的响应包及后续的包， conntrack知道该数据包属于一个已建立的连接。 通常发生在TCP握手完成之后。
- RELATED： RELATED状态有点复杂， 当一个连接与另一个ESTABLISHED状态的连接有关时，这意味着， 一个连接要想成为RELATED， 必须先有一条已经是ESTABLISHED状态的连接存在。 这个ESTABLISHED状态连接再产生一个主连接之外的新连接， 这个新连接就是RELATED状态。
- NVALID： 匹配那些无法识别或没有任何状态的数据包， conntrack不知道如何处理它。 该状态在分析Kubernetes故障的过程中起着重要的作用。
![[Pasted image 20250905181241.png]]









