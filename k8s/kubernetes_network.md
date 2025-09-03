

Kubernetes网络模型设计的一个基础原则是： 每个Pod都拥有一个独立的IP地址， 并假定所有Pod都在一个可以直接连通的、 扁平的网络空间中。 所以不管它们是否运行在同一个Node（宿主机） 中， 都要求它们可以直接通过对方的IP进行访问。

在Kubernetes世界里， IP是以Pod为单位进行分配的。 一个Pod内部的所有容器共享一个网络堆栈（相当于一个网络命名空间， 它们的IP地址、 网络设备、 配置等都是共享的） 。 按照这个网络原则抽象出来的为每个Pod都设置一个IP地址的模型也被称作IP-per-Pod模型。

为每个Pod都设置一个IP地址的模型还有另外一层含义， 那就是同一个Pod内的不同容器会共享同一个网络命名空间， 也就是同一个Linux网络协议栈。 这就意味着同一个Pod内的容器可以通过localhost连接对方的端口。 这种关系和同一个VM内的进程之间的关系是一样的， 看起来Pod内容器之间的隔离性减小了， 而且Pod内不同容器之间的端口是共享的， 就没有所谓的私有端口的概念了。 如果你的应用必须使用一些特定的端口范围， 那么你也可以为这些应用单独创建一些Pod。 反之， 对那些没有特殊需要的应用， 由于Pod内的容器是共享部分资源的， 所以可以通过共享资源相互通信， 这显然更加容易和高效。

Kubernetes集群至少应该包含三个网络，如图网络环境所示。一个是各主机（Master、Node和etcd等）自身所属的网
络，其地址配置于主机的网络接口，用于各主机之间的通信，例如，Master与各Node之间的通信。此地址配置于Kubernetes集群构建之前，它并不能由Kubernetes管理，管理员需要于集群构建之前自行确定其地址配置及管理方式。第二个是Kubernetes集群上专用于Pod资源对象的网络，它是一个虚拟网络，用于为各Pod对象设定IP地址等网络参数，其
地址配置于Pod中容器的网络接口之上。Pod网络需要借助kubenet插件或CNI插件实现，该插件可独立部署于Kubernetes集群之外，亦可托管于Kubernetes之上，它需要在构建Kubernetes集群时由管理员进行定义，而后在创建Pod对象时由其自动完成各网络参数的动态配置。第三个是专用于Service资源对象的网络，它也是一个虚拟网络，用于为Kubernetes集群之中的Service配置IP地址，但此地址并不配置于任何主机或容器的网络接口之上，而是通过Node之上的kube-proxy配置为iptables或ipvs规则，从而将发往此地址的所有流量调度至其后端的各Pod对象之上。Service网络在Kubernetes集群创建时予以指定，而各Service的地址则在用户创建Service时予以动态配置。

![[image-2025-01-27-01-07-54-828.png]]

## 云网络基础

Docker技术依赖于近年来Linux内核虚拟化技术的发展， 所以Docker对Linux内核有很强的依赖。 Docker使用到的技术有网络命名空间（ Network Namespace） 、 Veth设备对、 网桥、 ipatables和路由。



### 网络命名空间

为了支持网络协议栈的多个实例， Linux在网络栈中引入了网络命名空间， 这些独立的协议栈被隔离到不同的命名空间中。 处于不同命名空间中的网络栈是完全隔离的， 彼此之间无法通信。 通过对网络资源的隔离， 就能在一个宿主机上虚拟多个不同的网络环境。 Docker正是利用了网络的命名空间特性， 实现了不同容器之间的网络隔离。

由于网络命名空间代表的是一个独立的协议栈， 所以它们之间是相互隔离的， 彼此无法通信， 在协议栈内部都看不到对方。 那么有没有办法打破这种限制， 让处于不同命名空间中的网络相互通信，甚至与外部的网络进行通信呢？ 答案是“有， 应用Veth设备对即可”。Veth设备对的一个重要作用就是打通了相互看不到的协议栈之间的壁垒， 它就像一条管子， 一端连着这个网络命名空间的协议栈， 一端连着另一个网络命名空间的协议栈。 所以如果想在两个命名空间之间通信，就必须有一个Veth设备对。 后面会介绍如何操作Veth设备对来打通不同命名空间之间的网络。

```bash
# 创建一个网络命名空间
ip netns add <name>
# 删除一个网络命名空间
ip netns del <name>
# 在一个网络命名空间中添加一个网卡
ip link add <name> type veth peer name <name>
# 将网卡添加到网络命名空间中
ip link set <name> netns <name>
# 在网络命名空间中删除网卡
ip link del <name>
# 在网络命名空间中查看网卡
ip netns exec <name> ip link
# 在网络命名空间中查看路由
ip netns exec <name> ip route
# 在网络命名空间中运行命令
ip netns exec <name> <command>
# 如果需要执行多个命令，可以先试用bash进入到内部的shell界面，然后再执行命令
ip netns exec <name> bash
# 退出到外部网络命名空间
exit
```


### Veth设备对

引入Veth设备对是为了在不同的网络命名空间之间通信， 利用它可以直接将两个网络命名空间连接起来。 由于要连接两个网络命名空间，所以Veth设备都是成对出现的， 很像一对以太网卡， 并且中间有一根直连的网线。 既然是一对网卡， 那么我们将其中一端称为另一端的peer。在Veth设备的一端发送数据时， 它会将数据直接发送到另一端， 并触发
另一端的接收操作。

```bash
# 创建一个Veth设备对
ip link add <name> type veth peer name <name>
# 使用ip link show 查看所有网络接口
ip link show
# 删除一个Veth设备对
ip link del <name>
# 将其中一个网卡添加到网络命名空间中
ip link set <veth1> netns <netns1>
# 查看网络设备是否转移成功
ip netns exec <netns1> ip link show
# 为veth设备对添加IP地址，这样才能进行通讯
ip netns exec netns1 ip addr add 10.1.1.1/24 dev veth1
ip netns exec netns2 ip addr add 10.1.1.2/24 dev veth2
ip addr add 10.1.1.3/24 dev veth3
# 拉起网卡
ip netns exec netns1 ip link set dev veth1 up
ip netns exec netns2 ip link set dev veth2 up
ip link set dev veth3 up
# 启动网卡
ip link set <veth1> up
```

### 网络命名空间实践
创建一个名为netns1的 network namespace
```bash
ip netns add netns1
```
这个时候查看网络命名空间，只有一个lo网卡，而且是down状态
```bash
sudo ip netns exec netns1 ip addr
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```
通过 `ip netns list` 查看 netns1也已经创建成功，但是这个时候lo网卡并不能使用，需要先将lo网卡拉起才能使用
```bash
ip netns exec netns1 ip link set dev lo up
# 执行 ping 命令 lo网卡通了
sudo ip netns exec netns1 ping 127.0.0.1       
PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.
64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.030 ms
64 bytes from 127.0.0.1: icmp_seq=2 ttl=64 time=0.028 ms
```

但是只有一个本地的回环网卡设备是无法和外界进行通讯的，如果我们想与外界进行通讯，就需要在namespace里创建一对虚拟的以太网卡，即所谓的veth pair，顾名思义， veth pair总是成对出现且相互连接， 它就像Linux的双向管道（pipe） ， 报文从veth pair一端进去就会由另一端收到。
下面的命令将创建一对虚拟以太网卡， 然后把veth pair的一端放到netns1 network namespace。
```bash
ip link add veth0 type veth peer name veth1
# 将其中一块虚拟网卡veth1通过ip link set命令移动到netns1 network namespace
ip link set veth1 netns netns1
```
这两块网卡刚创建出来还都是DOWN状态， 需要手动把状态设置成UP。 这个步骤的操作和上文对lo网卡的操作类似， 只是多了一步绑定IP地址，
```bash
ip netns exec netns1 ifconfig veth1 10.1.1.1/24 up
ifconfig veth0 10.1.1.2/24 up
```
网卡拉起来之后两边就能进行相互通信了，比如在主机上可以 `ping 10.1.1.1` 或者进入到netns1里面 `ping 10.1.1.2` 

用户可以随意将虚拟网络设备分配到自定义的network namespace里， 而连接真实硬件的物理设备则只能放在系统的根network namesapce中。 并且， 任何一个网络设备最多只能存在于一个network namespace中。

### veth pair
veth是虚拟以太网卡（Virtual Ethernet） 的缩写。 veth设备总是成对的， 因此我们称之为veth pair。 veth pair一端发送的数据会在另外一端接收， 非常像Linux的双向管道。 根据这一特性， veth pair常被用于跨network namespace之间的通信， 即分别将veth pair的两端放在不同的namespace里
![[Pasted image 20250903152200.png]]
前文已经提到， 仅有veth pair设备， 容器是无法访问外部网络的。为什么呢？ 因为从容器发出的数据包， 实际上是直接进了veth pair设备的协议栈。 如果容器需要访问网络， 则需要使用网桥等技术将veth pair设备接收的数据包通过某种方式转发出去。
可以使用 `ip link list` 查看创建的veth pair

veth pair设备的原理较简单， **就是向veth pair设备的一端输入数据，数据通过内核协议栈后从veth pair的另一端出来**。
![[Pasted image 20250903153424.png]]
veth网卡内核实现代码，任意一端网卡收到信息，都会无串改的发送到另一端
```c
static netdev_tx_t veth_xmit(struct sk_buff *skb, struct net_device *dev)
{
	struct veth_priv *rcv_priv, *priv = netdev_priv(dev);
	struct veth_rq *rq = NULL;
	struct netdev_queue *txq;
	struct net_device *rcv;
	int length = skb->len;
	bool use_napi = false;
	int ret, rxq;

	rcu_read_lock();
	rcv = rcu_dereference(priv->peer);
	if (unlikely(!rcv) || !pskb_may_pull(skb, ETH_HLEN)) {
		kfree_skb(skb);
		goto drop;
	}

	rcv_priv = netdev_priv(rcv);
	rxq = skb_get_queue_mapping(skb);
	if (rxq < rcv->real_num_rx_queues) {
		rq = &rcv_priv->rq[rxq];

		/* The napi pointer is available when an XDP program is
		 * attached or when GRO is enabled
		 * Don't bother with napi/GRO if the skb can't be aggregated
		 */
		use_napi = rcu_access_pointer(rq->napi) &&
			   veth_skb_is_eligible_for_gro(dev, rcv, skb);
	}

	skb_tx_timestamp(skb);

	ret = veth_forward_skb(rcv, skb, rq, use_napi);
	switch (ret) {
	case NET_RX_SUCCESS: /* same as NETDEV_TX_OK */
		if (!use_napi)
			dev_sw_netstats_tx_add(dev, 1, length);
		else
			__veth_xdp_flush(rq);
		break;
	case NETDEV_TX_BUSY:
		/* If a qdisc is attached to our virtual device, returning
		 * NETDEV_TX_BUSY is allowed.
		 */
		txq = netdev_get_tx_queue(dev, rxq);

		if (qdisc_txq_has_no_queue(txq)) {
			dev_kfree_skb_any(skb);
			goto drop;
		}
		/* Restore Eth hdr pulled by dev_forward_skb/eth_type_trans */
		__skb_push(skb, ETH_HLEN);
		/* Depend on prior success packets started NAPI consumer via
		 * __veth_xdp_flush(). Cancel TXQ stop if consumer stopped,
		 * paired with empty check in veth_poll().
		 */
		netif_tx_stop_queue(txq);
		smp_mb__after_atomic();
		if (unlikely(__ptr_ring_empty(&rq->xdp_ring)))
			netif_tx_wake_queue(txq);
		break;
	case NET_RX_DROP: /* same as NET_XMIT_DROP */
drop:
		atomic64_inc(&priv->dropped);
		ret = NET_XMIT_DROP;
		break;
	default:
		net_crit_ratelimited("%s(%s): Invalid return code(%d)",
				     __func__, dev->name, ret);
	}
	rcu_read_unlock();

	return ret;
}
```


#### 容器与host veth pair的关系
容器中的eth0实际上和外面host上的某个veth是成对的（pair） 关系， 那么，有没有办法知道host上的vethxxx和哪个container eth0是成对的关系呢？

- 如果没有ip命令可以通过 `iflink` 关系查看
首先在容器中查看
```bash
~ $ cat /sys/class/net/eth0/iflink 
38
```
然后再主机上遍历 `/sys/class/net` 下面的全部子目录中的ifindex的值和容器中查出来的iflink值一样的veth名，这个veth就是和容器里面成对的veth

- 如果能使用ip命令，可以通过ip命令查看
先查看容器内部eth0的网卡信息
```bash
/prometheus $ ip link show eth0
4: eth0@if38: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue 
    link/ether 4a:50:c6:a2:74:94 brd ff:ff:ff:ff:ff:ff
```
这里的4是eth0接口的index，38就是和他成对的veth的index

然后去主机上，查找index为38的网卡
```bash
[root@andrew ~]# ip link show |grep ^38
38: caliee699845661@if4: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default
```

- 如果容器有 `ethtool`工具
先查看容器网卡eth0的peer网卡index
```bash
# ethtool -S eth0
NIC statistics:
     peer_ifindex: 38
```
然后在主机上查看index为38的网卡
```bash
ip addr
```

### linux bridge - 连接你我他
两个network namespace可以通过veth pair连接， 但要做到两个以上network namespace相互连接， veth pair就显得捉襟见肘了。

我们在计算机网络课本上学的网桥正如其字面含义所描述的，有“牵线搭桥”之意， 用于连接两个不同的局域网， 是网线的延伸。 网桥是二层网络设备， 两个端口分别有一条独立的交换信道， 不共享一条背板总线， 可隔离冲突域。 网桥比集线器（hub） 性能更好， 集线器上各端口都是共享同一条背板总线的。 后来， 网桥被具有更多端口、 可隔离冲突域的交换机（switch） 所取代。

顾名思义， Linux bridge就是Linux系统中的网桥， 但是Linux bridge的行为更像是一台虚拟的网络交换机， 任意的真实物理设备（例如eth0） 和虚拟设备（例如， 前面讲到的veth pair和后面即将介绍的tap设备） 都可以连接到Linux bridge上。 需要注意的是， Linux bridge不能跨机连接网络设备。

Linux bridge与Linux上其他网络设备的区别在于， 普通的网络设备只有两端， 从一端进来的数据会从另一端出去。 例如， 物理网卡从外面网络中收到的数据会转发给内核协议栈， 而从协议栈过来的数据会转发到外面的物理网络中。 Linux bridge则有多个端口， 数据可以从任何端口进来， 进来之后从哪个口出去取决于目的MAC地址， 原理和物理交换机差不多。

#### linux bridge实践
使用 iproute2如那件包里面的ip命令创建一个bridge
```bash
ip link add name br0 type bridge
ip link set br0 up
```
除了使用ip命令，我们还可以使用bridge-utils软件包里面的brctl工具管理网桥，例如创建网桥
```bash
brctl addbr br0
```

刚创建一个bridge时， 它是一个独立的网络设备， 只有一个端口连着协议栈， 其他端口什么都没连接， 这样的bridge其实没有任何实际功能
![[Pasted image 20250903162541.png]]
将eth0连接到 br0
```bash
ip link set dev veth0 master br0
```
同样也能使用 brctl 命令添加到一个设备到网桥上
```bash
brctl addif br0 veth0
```
设置成功之后就可以通过 bridge命令查看网桥上都有哪些设备
```bash
bridge link
```
也可以使用brctl命令显示当前存在的网桥及其连接的网络端口
```bash
brctl show
```
经过上述设置可以看到上述网络拓扑变为了
![[Pasted image 20250903164021.png]]
br0和veth0相连之后发生了如下变化：
- br0和veth0之间连接起来了， 并且是双向的通道
- 协议栈和veth0之间变成了单通道， 协议栈能发数据给veth0， 但veth0从外面收到的数据不会转发给协议栈；
- br0的MAC地址变成了veth0的MAC地址。

#### 把ip让给linux bridge
通过上面的分析可以看出， 给veth0配置IP没有意义， 因为就算协议栈传数据包给veth0， 回程报文也回不来。 这里我们就把veth0的IP地址“让给”Linux bridge：
```bash
ip addr del 1.2.3.101 dev eth0
ip addr add 1.2.3.101 dev br0
```
![[Pasted image 20250903164708.png]]
#### 将物理网卡添加到Linux bridge
将物理网卡eth0添加到bridge
```bash
ip link set dev eth0 master br0

bridge link 
2: ens18: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 master br0 state forwarding priority 32 cost 100 
```
Linux bridge不会区分接入进来的到底是物理设备还是虚拟设备， 对它来说没有区别。因此， eth0加入br0后， 落得和上面veth0一样的“下场”， 从外面网络收到的数据包将无条件地转发给br0， 自己变成了一根网线。

### linux bridge 在虚拟化中的应用







### Docker的网络实现

标准的Docker支持以下4类网络模式:

- host模式：使用 `--net=host` 指定。
- bridge模式：使用 `--net=bridge` 指定，为默认设置。
- none模式：使用 `--net=none` 指定，不创建任何网络。
- container模式：使用 `--net=container:<name|id>` 指定，将容器的网络设置与指定容器的网络设置相同。

在Kubernetes管理模式下通常只会使用bridge模式

在bridge模式下， Docker Daemon首次启动时会创建一个虚拟网桥，默认的名称是docker0， 然后按照RPC1918的模型在私有网络空间中给这个网桥分配一个子网。 针对由Docker创建的每一个容器， 都会创建一个虚拟以太网设备（Veth设备对） ， 其中一端关联到网桥上， 另一端使用Linux的网络命名空间技术映射到容器内的eth0设备， 然后在网桥的地址段内给eth0接口分配一个IP地址。

## Kubernetes的网络实现
- 容器到容器之间的直接通信。
- 抽象的Pod到Pod之间的通信。
- Pod到Service之间的通信。
- 集群内部与外部组件之间的通信

### 网络模型
#### 宿主机网络
pod可以使用宿主节点的网络接口，而不是拥有自己独立的网络。这意味着这个pod没有自己的IP地址；如果这个pod中的某一进程绑定了某个端口，那么该进程将被绑定到宿主节点的端口上。一个配置了hostNetwork:true的pod使用宿主节点的网络接口，而不是它自己的
![[Image00649.jpg]]
查看宿主机网络网卡信息
```bash
kubectl exec <pod-name> ifconfig
```

#### hostPort与nodePort
通过配置pod的spec.containers.ports字段中某个容器某一端口的hostPort属性来实现。
不要混淆使用hostPort的pod和通过NodePort服务暴露的pod。

在图中首先注意到的是，对于一个使用hostPort的pod，到达宿主节点的端口的连接会被直接转发到pod的对应端口上；然而在NodePort服务中，到达宿主节点的端口的连接将被转发到随机选取的pod上（这个pod可能在其他节点上）。另外一个区别是，对于使用hostPort的pod，仅有运行了这类pod的节点会绑定对应的端口；而NodePort类型的服务会在所有的节点上绑定端口，即使这个节点上没有运行对应的pod
![[Image00653.jpg]]


### 容器到容器的通信

同一个Pod内的容器（Pod内的容器是不会跨宿主机的） 共享同一个网络命名空间， 共享同一个Linux协议栈。 所以对于网络的各类操作，就和它们在同一台机器上一样， 它们甚至可以用localhost地址访问彼此的端口。

这么做的结果是简单、 安全和高效， 也能减少将已存在的程序从物理机或者虚拟机中移植到容器下运行的难度。

### Pod之间的通信

每一个Pod都有一个真实的全局IP地址， 同一个Node内的不同Pod之间可以直接采用对方Pod的IP地址通信， 而且不需要采用其他发现机制， 例如DNS、 Consul或者etcd。

Pod容器既有可能在同一个Node上运行， 也有可能在不同的Node上运行， 所以通信也分为两类： 同一个Node上Pod之间的通信和不同Node上Pod之间的通信。

## CNI网络模型

- 容器运行时必须在调用任意插件前为容器创建一个新的网络命名空间
- 容器运行时必须确定此容器所归属的网络（一个或多个） ， 以及每个网络必须执行哪个插件。
- 容器运行时必须按照先后顺序为每个网络运行插件将容器添加到每个网络中
- 容器生命周期结束后， 容器运行时必须以反向顺序（相对于添加容器执行顺序） 执行插件， 以使容器与网络断开连接。
- 容器运行时一定不能为同一个容器的调用执行并行（parallel）操作， 但可以为多个不同容器的调用执行并行操作
- 容器运行时必须对容器的ADD和DEL操作设置顺序， 以使得ADD操作最终跟随相应的DEL操作。 DEL操作后面可能会有其他DEL操作， 但插件应自由处理多个DEL操作（即多个DEL操作应该是幂等的）。
- 容器必须由ContainerID进行唯一标识。 存储状态的插件应使用联合主键（ network name、 CNI_CONTAINERID、 CNI_IFNAME） 进行存储

## Calico插件的原理和部署示例

Calico是一个基于BGP的纯三层的网络方案， 与OpenStack、Kubernetes、 AWS、 GCE等云平台都能够良好地集成。 Calico在每个计算节点都利用Linux Kernel实现了一个高效的vRouter来负责数据转发。每个vRouter都通过BGP1协议把在本节点上运行的容器的路由信息向整个Calico网络广播， 并自动设置到达其他节点的路由转发规则。 Calico保证所有容器之间的数据流量都是通过IP路由的方式完成互联互通的。Calico节点组网时可以直接利用数据中心的网络结构（L2或者L3） ， 不需要额外的NAT、 隧道或者Overlay Network， 没有额外的封包解包， 能
够节约CPU运算， 提高网络效率。

### Calico的主要组件如下

- Felix： Calico Agent， 运行在每个Node上， 负责为容器设置网络资源（IP地址、 路由规则、 iptables规则等） ， 保证跨主机容器网络互通
- etcd： Calico使用的后端存储
- BGP Client： 负责把Felix在各Node上设置的路由信息通过BGP广播到Calico网络。
- Route Reflector： 通过一个或者多个BGP Route Reflector完成大规模集群的分级路由分发。
- CalicoCtl： Calico命令行管理工具。

## k8s的网络策略

为了实现细粒度的容器间网络访问隔离策略， Kubernetes从1.3版本开始引入了Network Policy机制， 到1.8版本升级为networking.k8s.io/v1稳定版本。 Network Policy的主要功能是对Pod或者Namespace之间的网络通信进行限制和准入控制， 设置方式为将目标对象的Label作为查询条件， 设置允许访问或禁止访问的客户端Pod列表。 目前查询条件可以作用于Pod和Namespace级别。

为了使用Network Policy， Kubernetes引入了一个新的资源对象NetworkPolicy， 供用户设置Pod之间的网络访问策略。 但这个资源对象配置的仅仅是策略规则， 还需要一个策略控制器（Policy Controller） 进行策略规则的具体实现。 策略控制器由第三方网络组件提供， 目前Calico、 Cilium、 Kube-router、 Romana、 Weave Net等开源项目均支持网络策略的实现。

网络策略的设置主要用于对目标Pod的网络访问进行控制， 在默认情况下对所有Pod都是允许访问的， 在设置了指向Pod的NetworkPolicy网络策略后， 到Pod的访问才会被限制。

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  labels:
    app.kubernetes.io/component: grafana
    app.kubernetes.io/name: grafana
    app.kubernetes.io/part-of: kube-prometheus
    app.kubernetes.io/version: 11.4.0
  name: grafana
  namespace: monitoring
spec:
  egress:
  - {}
  # 定义允许访问目标Pod的入站白名单规则， 满足from
  #条件的客户端才能访问ports定义的目标Pod端口号。
  ingress:
#  对符合条件的客户端Pod进行网络放行， 规则包括基于客
#  户端Pod的Label、 基于客户端Pod所在命名空间的Label或者客户端的IP
#  范围
  - from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: prometheus
    # 允许访问的目标Pod监听的端口号
    ports:
    - port: 3000
      protocol: TCP
  # 定义该网络策略所针对的Pod，这里选择包含以下标签的Pod，也就是这个网络策略作用到那个Pod身上
  podSelector:
    matchLabels:
      app.kubernetes.io/component: grafana
      app.kubernetes.io/name: grafana
      app.kubernetes.io/part-of: kube-prometheus
  # 网络策略类型，包含ingress 和 egress ，用于设置目标Pod的入站和出站的网络限制。 如果未指定policyTypes， 则系统默认会设置Ingress类型若设置了egress策略， 则系统自动设置Egress类型
  policyTypes:
  - Egress
  - Ingress
```

### 为命名空间配置默认的网络策略

在一个命名空间没有设置任何网络策略的情况下， 对其中Pod的ingress和egress网络流量并不会有任何限制。 在命名空间级别可以设置一些默认的全局网络策略， 以便管理员对整个命名空间进行统一的网络策略设置。










