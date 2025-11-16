
Cilium作为一款Kubernetes CNI插件，从一开始就是为大规模和高度动态的容器环境而设计，并且带来了API级别感知的网络安全管理功能，通过使用基于Linux内核特性的新技术——BPF，提供了基于service/pod/container作为标识，而非传统的IP地址，来定义和加强容器和Pod之间网络层、应用层的安全策略。因此，Cilium不仅将安全控制与寻址解耦来简化在高度动态环境中应用安全性策略，而且提供传统网络第3层、4层隔离功能，以及基于http层上隔离控制，来提供更强的安全性隔离。

## 架构
• Cilium Agent, Cilium CLI Client, CNI Plugin will be running on every node
• Cilium agent compiles BPF programs and make 
the kernel runs these programs at key points in the network stack to have visibility and control over all network traffic in/out of all containers
• Cilium interacts with the Linux kernel to install BPF program which will then perform networking tasks and implement security rules

![[Pasted image 20251114233920.png]]

![[Pasted image 20251115231602.png]]


![[Pasted image 20251116001654.png]]


![[Pasted image 20251108164407.png]]



## eBPF
eBPF 是一项革命性技术，它能在内核中运行沙箱程序（sandbox programs）， 而无需修改内核源码或者加载内核模块。
eBPF的一个重要特性是能够使用高级语言(如C)来实现程序。LLVM有一个eBPF后端，用于编辑包含eBPF指令的ELF文件，前端(如clang)可以用于生成程序。
在一个后端转换为字节码后，使用bpf()系统调用加载bpf程序，并校验安全性。JIT会将字节码编译进CPU架构中，并将该程序附加到内核对象上，当这些对象发生事件时会触发程序的执行(例如，当从一个网络接口发送报文时)。



### eBP map
eBPF使用的主要的数据结构是eBPF map，这是一个通用的数据结构，用于在内核或内核和用户空间传递数据。其名称"map"也意味着数据的存储和检索需要用到key。
我们可以在CIlium中查看这些Map信息：

- 为什么需要BPF Map
通过消息传递来触发程序中的行为是软件工程中广泛使用的技术。一个程序可以通过发送消息来修改另一个程序的行为，这也允许这些程序之间通过这个方式来传递信息。

关于BPF最吸引人的一个方面，就是运行在内核上的程序可以在运行时使用消息传递相互通信，我称之为「communication on air」。

而BPF Map就是用户空间和内核空间之间的数据交换、信息传递的桥梁。

- BPF Map是什么
BPF Map本质上是以「键/值」方式存储在内核中的数据结构，它们可以被任何知道它们的BPF程序访问。在内核空间的程序创建BPF Map并返回对应的文件描述符，在用户空间运行的程序就可以通过这个文件描述符来访问并操作BPF Map，这就是为什么BPF Map在BPF世界中是桥梁的存在了。

- BPF Map类型
根据申请内存方式的不同，BPF Map有很多种类型，常用的类型是BPF_MAP_TYPE_HASH和BPF_MAP_TYPE_ARRAY，它们背后的内存管理方式跟我们熟悉的哈希表和数组基本一致，此外还有包括BPF_MAP_TYPE_PROG_ARRAY、BPF_MAP_TYPE_PERF_EVENT_ARRAY等10余种Map类型，具体可以查看之前的博文。随着多CPU架构的成熟发展，BPF Map也引入了per-cpu类型，如BPF_MAP_TYPE_PERCPU_HASH、BPF_MAP_TYPE_PERCPU_ARRAY等，当你使用这种类型的BPF Map时，每个CPU都会存储并看到它自己的Map数据，从属于不同CPU之间的数据是互相隔离的，这样做的好处是，在进行查找和聚合操作时更加高效，性能更好，尤其是你的BPF程序主要是在做收集时间序列型数据，如流量数据或指标等。

### 网络数据收发原理
配置以太网驱动或者网络设备需要使用 ethtool 命令
配置路由使用 ip 命令
配置过滤使用 seccom 命令
配置 IP 防火墙使用 iptables 命令，但如果你使用的是 raw sockets，那有很多地方都 会 bypass，因此这并不是一个完整的防火墙
配置流量整形使用 tc 命令
抓包使用 tcpdump 命令，但同样的，它并没有展示出全部信息，因为它只关注了一层
如果有虚拟交换机，那使用 brctl 或 ovsctl
所以我们看到，每个子系统都有自己的 API，这意味着如果要自动化这些东西，必须单独的 使用这些工具。有一些工具这样做了，但这种方式意味着我们需要了解其中的每一层。


![[Pasted image 20251116000825.png]]
-  接收流程：
1.数据包达到物理网卡（RX FIFO），通过DMA到内存中。内存指的是网卡的接收的Ring Buffer。
2.并且拷贝成一个一个的sk_buffer.
3.触发硬中断，通知CPU，已经有数据来了，CPU根据注册的中断函数，中断函数调用驱动程序，驱动先禁用网卡的中断，目的下次再来数据就直接处理就可以，就不再通知CPU的硬中断。
4.弥补硬中断处理时间问题，需要启用一个软中断。（主要是弥补硬中断处理时间不及的问题）
5.数据单元的sk_buffer然后再交给我们的协议栈处理。实际上就是交给网络层和传输层来处理。[被ip层协议和传输层协议处理]
6.去处掉网络层和传输层的头以后，CPU就把数据Copy到用户空间的应用程序。

### 内核单元层级关系

![[Pasted image 20251116000904.png]]
![[Pasted image 20251116000936.png]]`
```bash
# 这里主要是需要弄清楚netfilter所处的位置。
BPF XDP ---> sk_buffer ---> TC[network stack Dividing Line] ---> IPv4 And IPv6 ---> Netfilter ---> TCP UDP RAW
# 该链路对应我们一下的逻辑分析。所以非常重要。分析XDP 和 TC的过程很重要。
```

### XDP&TC

![[Pasted image 20251116001038.png]]
Here are some of the operations an XDP program can perform with the packets it receives, once it is connected to a network interface:

- XDP_DROP：在驱动层丢弃报文，通常用于实现DDos或防火墙
- XDP_PASS：允许报文上送到内核网络栈，同时处理该报文的CPU会分配并填充一个skb，将其传递到GRO引擎。之后的处理与没有XDP程序的过程相同。
- XDP_TX：BPF程序通过该选项可以将网络报文从接收到该报文的NIC上发送出去。例如当集群中的部分机器实现了防火墙和负载均衡时，这些机器就可以作为hairpinned模式的负载均衡，在接收到报文，经过XDP BPF修改后将该报文原路发送出去。
- XDP_REDIRECT：与XDP_TX类似，但是通过另一个网卡将包发出去。另外， XDP_REDIRECT 还可以将包重定向到一个 BPF cpumap，即，当前执行 XDP 程序的 CPU 可以将这个包交给某个远端 CPU，由后者将这个包送到更上层的内核栈，当前 CPU 则继续在这个网卡执行接收和处理包的任务。这和 XDP_PASS 类似，但当前 CPU 不用去做将包送到内核协议栈的准备工作（分配 skb，初始化等等），这部分开销还是很大的。
- XDP_ABORTED：表示程序产生了异常，其行为和 XDP_DROP相同，但 XDP_ABORTED 会经过 trace_xdp_exception tracepoint，因此可以通过 tracing 工具来监控这种非正常行为。


DPDK 完全ByPass掉原本处在内核中的协议栈，但是数据包封装又不得不使用协议栈，所以DPDK把这部分全部在用户空间中实现。这样就不再涉及到内核空间和用户空间之间切换等问题。从而能大大的提高了数据转发的效率。且DPDK使用PMD技术，也对性能提升帮助非常之大。
具体性能测试对比： https://github.com/OSH-2019/x-xdp-on-android/blob/master/docs/research.md

## 网络模式





## 通信方式

![[Pasted image 20251116001654.png]]

![[Pasted image 20251116001735.png]]

图片来源： [https://cilium.io/blog/2021/05/11/cni-benchmark/](https://cilium.io/blog/2021/05/11/cni-benchmark/)
eBPF host-routing allows to bypass all of the iptables and upper stack overhead in the host namespace as well as some of the context-switching overhead when traversing through the Virtual Ethernet pairs. 

 Ingress: Network packets are picked up as early as possible from the network device facing the network and delivered directly into the network namespace of the Kubernetes Pod.

Egress: On the egress side, the packet still traverses the veth pair, is picked up by eBPF and delivered directly to the external facing network interface. The routing table is consulted directly from eBPF so this optimization is entirely transparent and compatible with any other services running on the system providing route distribution. For information on how to enable this feature, see eBPF Host-Routing in the tuning guide.


### 同节点pod之间的通信
在 5.10 内核以后，Cilium 新增了 eBPF Host-Routing 功能，该功能更加速了 eBPF 数据面性能，新增了 bpf_redirect_peer 和 bpf_redirect_neigh 两个 redirect 方式，bpf_redirect_peer 可以理解成 bpf_redirect 的升级版，其将数据包直接送到 veth pair Pod 里面接口 eth0 上，而不经过宿主机的 lxc 接口，这样实现的好处是少进入一次 cpu backlog queue 队列，该特性引入后，路由模式下，Pod -> Pod 性能接近 Node -> Node 性能，同时 Cilium 数据面路径发生了较大的变化

1. 除了 host->Pod 外，所有路径都是经过接口跳着走的，最大变化是不再经过 Kernel 转发处理，也意味着来回流量路径不再经过 kernel 的 Netfilter 框架，kernel tc 等模块，大大提升了转发性能；

2. redirect_peer 特性专用于 veth pair 类型接口，因为流量被直接重定向到 Pod 里面的接口，所以在宿主机 lxc 口上无法抓到进入 Pod 的流量，因 tcpdump 抓包点在 tc ingress hook 之前，所以可以抓到出 Pod 未经过 eBPF 处理的流量。

解释一下这句话所要表达的内容：什么叫做：只能抓到出去的包，而不能抓不到进来的包：tcpdump hook 要比 TC的hook更加靠前一些。
![[Pasted image 20251116003039.png]]