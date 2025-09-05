

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

#### 虚拟机
虚拟机通过tun/tap或者其他类似的虚拟网络设备， 将虚拟机内的网卡同br0连接起来， 这样就达到和真实交换机一样的效果， 虚拟机发出去的数据包先到达br0， 然后由br0交给eth0发送出去， 数据包都不需要经过host机器的协议栈， 效率高。
![[Pasted image 20250904091302.png]]

#### 容器
容器运行在自己单独的network namespace里， 因此都有自己单独的协议栈。Linux bridge在容器场景的组网和上面的虚拟机场景差不多， 但也存在一些区别。 例如， 容器使用的是veth pair设备， 而虚拟机使用的是tun/tap设备。 在虚拟机场景下， 我们给主机物理网卡eth0分配了IP地址； 而在容器场景下， 我们一般不会对宿主机eth0进行配置。 在虚拟机场景下， 虚拟器一般会和主机在同一个网段； 而在容器场景下， 容器和物理网络不在同一个网段内。

![[Pasted image 20250904091940.png]]
在容器中配置其网关地址为br0， 在我们的例子中即1.2.3.101（容器网络网段是1.2.3.0/24） 。 因此， 从容器发出去的数据包先到达br0， 然后交给host机器的协议栈。 由于目的IP是外网IP， 且host机器开启了IP forward功能， 数据包会通过eth0发送出去。 因为容器所分配的网段一般都不在物理网络网段内（在我们的例子中， 物理网络网段是10.20.30.0/24） ， 所以一般发出去之前会先做NAT转换（NAT转换需要自己配置， 可以使用iptables）

#### 网络接口的混杂模式
混杂模式（Promiscuous mode） ， 简称Promisc mode， 俗称“监听模式”。 混杂模式通常被网络管理员用来诊断网络问题， 但也会被无认证的、 想偷听网络通信的人利用。 根据维基百科的定义， 混杂模式是指一个网卡会把它接收的所有网络流量都交给CPU， 而不是只把它想转交的部分交给CPU。 在IEEE 802定的网络规范中， 每个网络帧都有一个目的MAC地址。 在非混杂模式下， 网卡只会接收目的MAC地址是它自己的单播帧， 以及多播及广播帧； 在混杂模式下， 网卡会接收经过它的所有帧

使用 `ifconfig` 可以查看一个网卡是否开启了混杂模式
```bash
# 如果flag里面有PROMISC说明该网卡启用了混杂模式
ens18: flags=4419<UP,BROADCAST,RUNNING,PROMISC,MULTICAST>  mtu 1500
        inet 10.168.8.110  netmask 255.255.255.0  broadcast 10.168.8.255
        ether bc:24:11:7c:d2:b2  txqueuelen 1000  (Ethernet)
        RX packets 200285018  bytes 22899034355 (22.8 GB)
        RX errors 0  dropped 585807  overruns 0  frame 0
        TX packets 4348818  bytes 2176086419 (2.1 GB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```
可以通过ifconfig可以配置一个网卡的混杂模式
```bash
# 启用一个网卡的混杂模式
ifconfig ens18 promisc
# 关闭一个网卡的混杂模式
ifconfig ens18 -promisc
```
将网络设备加入到linux bridge之后，会自动进入混杂模式
```bash
brctl addif br0 veth0
dmesg |grep promiscuous
```
如上所示， veth设备加入Linux bridge后， 可以通过查看内核日志看到veth0自动进入混杂模式， 而且无法退出， 直到将veth0从Linux bridge中移除
即使手动将网卡设置为非混杂模式， 实际上还是没有退出混杂模式， 一边操作 `ifconfig veth0 -promisc`， 一边观察内核日志（内核并不会真正处理） 便可看出。

#### tun/tap设备
tun/tap设备到底是什么？ 从Linux文件系统的角度看， 它是用户可以用文件句柄操作的字符设备； 从网络虚拟化角度看， 它是虚拟网卡， 一端连着网络协议栈， 另一端连着用户态程序。

如果把veth pair称为设备孪生， 那么tun/tap就像是一对表兄弟。 虽然很多情况下我们都是连带提到它们， 但它们还是有些区别的。 tun表示虚拟的是点对点设备， tap表示虚拟的是以太网设备， 这两种设备针对网络包实施不同的封装。

tun/tap设备有什么作用呢？ tun/tap设备可以将TCP/IP协议栈处理好的网络包发送给任何一个使用tun/tap驱动的进程， 由进程重新处理后发到物理链路中。 tun/tap设备就像是埋在用户程序空间的一个钩子， 我们可以很方便地将对网络包的处理程序挂在这个钩子上， OpenVPN、Vtun、 flannel都是基于它实现隧道包封装的。

从网络协议栈的角度看， tun/tap设备这类虚拟网卡与物理网卡并无区别。 只是对tun/tap设备而言， 它与物理网卡的不同表现在它的数据源不是物理链路， 而是来自用户态！ 这也是tun/tap设备的最大价值所在。提前“剧透”： flannel的UDP模式的技术要点就是tun/tap设备。

tun/tap设备其实就是利用Linux的设备文件实现内核态和用户态的数据交互， 而访问设备文件则会调用设备驱动相应的例程， 要知道设备驱动也是内核态和用户态的一个接口。
![[Pasted image 20250904095548.png]]
普通的物理网卡通过网线收发数据包， 而tun设备通过一个设备文件（/dev/tunX） 收发数据包。 所有对这个文件的写操作会通过tun设备转换成一个数据包传送给内核网络协议栈。 当内核发送一个包给tun设备时， 用户态的进程通过读取这个文件可以拿到包的内容。 当然， 用户态的程序也可以通过写这个文件向tun设备发送数据。

tap设备与tun设备的工作原理完全相同， 区别在于：
- tun设备的/dev/tunX文件收发的是IP包， 因此只能工作在L3， 无法与物理网卡做桥接， 但可以通过三层交换（例如ip_forward） 与物理网卡连通；
- tap设备的/dev/tapX文件收发的是链路层数据包， 可以与物理网卡做桥接。

#### 利用tun设备部署一个VPN
tun设备的tun是英文隧道（tunnel） 的缩写， 言下之意， tun设备似乎与隧道网络存在一丝联系。 tun/tap设备的用处是将协议栈中的部分数据包转发给用户空间的应用程序， 给用户空间的程序一个处理数据包的机会。 常见的tun/tap设备使用场景有数据压缩、 加密等， 最常见的是VPN， 包括tunnel及应用层的IPSec等。 我们将使用tun设备搭建一个基于UDP的VPN， 网络拓扑如图

![[Pasted image 20250904104840.png]]
- App1是一个普通的程序， 通过Socket API发送了一个数据包， 假设这个数据包的目的IP地址是192.168.1.3（和tun0在同一个网段） 
- 程序A的数据包到达网络协议栈后， 协议栈根据数据包的目的IP地址匹配到这个数据包应该由tun0网口出去， 于是将数据包发送给tun0网卡。
- tun0网卡收到数据包之后， 发现网卡的另一端被App2打开了（这也是tun/tap设备的特点， 一端连着协议栈， 另一端连着用户态程序） ， 于是将数据包发送给App2。
- App2收到数据包之后， 通过报文封装（将原来的数据包封装在新的数据报文中， 假设新报文的原地址是eth0的地址， 目的地址是和eth0在同一个网段的VPN对端IP地址， 例如100.89.104.22） 构造出一个新的数据包。 App2通过同样的Socket API将数据包发送给协议栈。
- 协议栈根据本地路由， 发现这个数据包应该通过eth0发送出去， 于是将数据包交给eth0， 最后eth0通过物理网络将数据包发送给VPN的对端

综上所述， 发到192.168.1.0/24网络的数据首先通过监听在tun0设备上的App2进行封包， 利用eth0这块物理网卡发到远端网络的物理网卡上， 从而实现VPN。

不难看出， VPN网络的报文真正从物理网卡出去要经过网络协议栈两次， 因此会有一定的性能损耗。 另外， 经过用户态程序的处理， 数据包可能已经加密， 包头进行了封装， 所以第二次通过网络栈内核看到的是截然不同的网络包。 这个过程和我们后面要讨论的flannel容器组网方案有异曲同工之处， flannel网络的本质就是一个隧道网络， 后面我们会做更深入的介绍。

### Docker的网络实现

标准的Docker支持以下4类网络模式:

- host模式：使用 `--net=host` 指定。
- bridge模式：使用 `--net=bridge` 指定，为默认设置。
- none模式：使用 `--net=none` 指定，不创建任何网络。
- container模式：使用 `--net=container:<name|id>` 指定，将容器的网络设置与指定容器的网络设置相同，和被指定的容器共享相同的网络命名空间。

在Kubernetes管理模式下通常只会使用bridge模式

在bridge模式下， Docker Daemon首次启动时会创建一个虚拟网桥，默认的名称是docker0， 然后按照RPC1918的模型在私有网络空间中给这个网桥分配一个子网。 针对由Docker创建的每一个容器， 都会创建一个虚拟以太网设备（Veth设备对） ， 其中一端关联到网桥上， 另一端使用Linux的网络命名空间技术映射到容器内的eth0设备， 然后在网桥的地址段内给eth0接口分配一个IP地址。

创建容器时使用--network=container:NAME_or_ID模式， 在创建新的容器时指定容器的网络和一个已经存在的容器共享一个network namespace， 但是并不为Docker容器进行任何网络配置， 这个Docker容器没有网卡、 IP、 路由等信息， 需要手动为Docker容器添加网卡、 配置IP等。
需要注意的是， container模式指定新创建的容器和已经存在的任意一个容器共享一个network namespace， 但不能和宿主机共享。 新创建的容器不会创建自己的网卡， 配置自己的IP， 而是和一个指定的容器共享IP、 端口范围等。 同样， 两个容器除了网络方面， 其他的如文件系统、进程列表等还是隔离的。 两个容器的进程可以通过lo网卡设备通信。

> Kubernetes的Pod网络采用的就是Docker的container模式网络







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

### calico采用的路由方案
Calico： 源自Tigera， 基于BGP的路由方案， 支持很细致的ACL控制， 对混合云亲和度比较高；路由方案的另一个优点是出了问题也很容易排查。 路由方案往往需要用户了解底层网络基础结构， 因此使用和运维门槛较高。

在容器里怎么实现基于路由的网络呢？ 以Calico为例， Calico是一个纯三层网络方案。 不同主机上的每个容器内部都配一个路由， 指向自己所在的IP地址； **每台服务器变成路由器**， 配置自己的路由规则， 通过网卡直接到达目标容器， 整个过程没有封包

Calico的设计灵感源自通过将整个互联网的可扩展IP网络原则压缩到数据中心级别。 Calico在每一个计算节点， 利用Linux Kernel实现高效的vRouter来负责数据转发， 而每个vRouter通过BGP把自己节点上的工作负载的路由信息向整个Calico网络传播。 小规模部署可以直接互联，大规模下可通过指定的BGP Route Reflector完成。

![[Pasted image 20250904160404.png]]

### 容器的网络组网类型

#### overlay 网络
overlay网络是在传统网络上虚拟出一个虚拟网络， 承载的底层网络不再需要做任何适配。 在容器的世界里， 物理网络只承载主机网络通信， 虚拟网络只承载容器网络通信。 overlay网络的任何协议都要求在发送方对报文进行包头封装， 接收方剥离包头。

- L2 overlay
传统的二层网络的范围有限， L2 overlay网络是构建在底层物理网络上的L2网络， 相较于传统的L2网络， L2 overlay网络是个“大二层”的概念， 其中“大”的含义是可以跨越多个数据中心（即容器可以跨L3 underlay进行L2通信） ， 而“二层”指的是通信双方在同一个逻辑的网段内， 例如172.17.1.2/16和172.17.2.3/16。
VXLAN就是L2 overlay网络的典型实现， 其通过在UDP包中封装原始L2报文， 实现了容器的跨主机通信。
L2 overlay网络容器可在任意宿主机间迁移而不改变其IP地址的特性， 使得构建在大二层overlay网络上的容器在动态迁移时具有很高的灵活性。

- L3 overlay
L3 overlay组网类似L2 overlay， 但会在节点上增加一个网关。 每个节点上的容器都在同一个子网内， 可以直接进行二层通信。 跨节点的容器间通信只能走L3， 都会经过网关转发， 性能相比于L2 overlay较弱。牺牲的性能获得了更高的灵活性， 跨节点通信的容器可以存在于不同的网段中， 例如192.168.1.0/24和172.17.16.0/24。flannel的UDP模式采用的就是L3 overlay模型。
L3 overlay网络容器在主机间迁移时可能需要改变其IP地址。

#### underlay网络
underlay网络一般理解为底层网络， 传统的网络组网就是underlay类型， 区别于上文提到的overlay网络。
- L2 underlay
L2 underlay网络就是链路层（L2） 互通的底层网络。 IPvlan L2模式和Macvlan属于L2 underlay类型的网络。
- L3 underlay
在L3 underlay组网中， 可以选择IPvlan的L3模式， 该模式下IPvlan有点像路由器的功能， 它在各个虚拟网络和主机网络之间进行不同网络报文的路由转发工作。 只要父接口相同， 即使虚拟机/容器不在同一个网络， 也可以互相ping通对方， 因为IPvlan会在中间做报文的转发工作。
 
IPvlan的L3模式， flannel的host-gw模式和Calico的BGP组网方式都是L3 underlay类型的网络。


### DNS服务基本框架
Kubernetes的DNS应用部署好后， 会对外暴露一个服务， 集群内的容器通过访问该服务的Cluster IP+53端口获得域名解析服务， 而这个Service的Cluster IP一般情况下都是固定的。
一般应用程序是无须感知DNS服务器的IP地址的， 以Linux系统为例， 容器内进程想要获得域名解析服务， 只需把DNS Server写入/etc/resolv.conf文件。 那么刷新/etc/resolv.conf配置这个动作是谁完成的呢？ 答案是Kubelet。
原来， 当Kubernetes的DNS服务Cluster IP分配后， 系统（一般是指安装程序） 会给Kubelet配置 `--cluster-dns=<dns service ip>` 启动参数，
DNS服务的IP地址将在用户容器启动时传递， 并写入每个容器的/etc/resolv.conf文件。 DNS服务IP即上文提到的DNS Service的Cluster IP， 可以配置成--cluster-dns=10.0.0.1。
除此之外， Kubelet的 `--cluster_domain=<default-local-domain>` 参数支持配置集群域名后缀， 默认是`cluster.local`。



## k8s的网络策略

为了实现细粒度的容器间网络访问隔离策略， Kubernetes从1.3版本开始引入了Network Policy机制， 到1.8版本升级为networking.k8s.io/v1稳定版本。 Network Policy的主要功能是对Pod或者Namespace之间的网络通信进行限制和准入控制， 设置方式为将目标对象的Label作为查询条件， 设置允许访问或禁止访问的客户端Pod列表。 目前查询条件可以作用于Pod和Namespace级别。

为了使用Network Policy， Kubernetes引入了一个新的资源对象NetworkPolicy， 供用户设置Pod之间的网络访问策略。 但这个资源对象配置的仅仅是策略规则， 还需要一个策略控制器（Policy Controller） 进行策略规则的具体实现。 策略控制器由第三方网络组件提供， 目前Calico、 Cilium、 Kube-router、 Romana、 Weave Net等开源项目均支持网络策略的实现。


网络策略作为Pod网络隔离的一层抽象， 用白名单实现了一个访问控制列表（ACL） ， 从Label Selector、 namespace selector、 端口、CIDR这4个维度限制Pod的流量进出。

网络策略的设置主要用于对目标Pod的网络访问进行控制， 在默认情况下对所有Pod都是允许访问的， 在设置了指向Pod的NetworkPolicy网络策略后， 到Pod的访问才会被限制。

### 网络策略应用举例

- Deny all ingress and egress
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```
这个策略会阻止所有入站和出站流量到达或离开匹配的 Pod。这意味着没有任何流量可以进入或离开这些 Pod，除非有其他更具体的网络策略允许特定的流量。

- Allow all ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all
spec:
  podSelector: {}
  ingress:
  - {}
```
这个策略允许所有入站流量到达匹配的 Pod。这意味着任何外部流量都可以访问这些 Pod，但不包括出站流量控制。

- Allow all egress
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all
spec:
  podSelector: {}
  egress:
  - {}
```
这个策略允许所有出站流量从匹配的 Pod 发出。这意味着这些 Pod 可以发送任何类型的流量到外部目的地，但不包括入站流量控制

> {} 代表允许所有流量， []代表拒绝所有流量

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  ingress: []
```

限制只能从指定端口进来
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow-5000
spec:
  podSelector: 
    matchLabels:
      app: apiserver
  ingress:
  - ports:
    - port: 5000
    from:
    - podSelector:
      matchLabels:
        role: monitoring
```



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
    - namespaceSelector:
      matchLabels:
        project: myproject
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

## 网络故障定位

### IP转发和桥接
Kubernetes网络利用Linux内核Netfilter模块设置低级别的集群IP负载均衡， 除了iptables和IPVS， 还需要用到两个关键的模块： IP转发（IP forward） 和桥接。

#### IP转发
IP转发是一种内核态设置， 允许将一个接口的流量转发到另一个接口， 该配置是Linux内核将流量从容器路由到外部所必需的。 有时， 该项设置可能会被安全团队运行的定期安全扫描重置， 或者没有配置为重启后生效。 在这种情况下， 就会出现网络访问失败的情况， 例如， 访问Pod服务连接超时：
```bash
* connect to 10.100.225.223 port 5000 failed: Connection timed out
* Failed to connect to 10.100.225.223 port 5000: Connection timed out
* Closing connection 0
curl: (7) Failed to connect to 10.100.225.223 port 5000: Connection timed out
```
Tcpdump可以显示发送了大量重复的SYN数据包， 但没有收到ACK。

那么， 该如何诊断呢？ 请看下面的诊断方法：
```bash
# 检查 ipv4 forwarding是否开启
sysctl net.ipv4.ip_forward
# 0 意味着未开启
net.ipv4.ip_forward = 0
```
修复也很简单，只需要开启ip转发功能即可
```bash
sysctl -w net.ipv4.ip_forward=1
# 验证并生效
sysctl -p
```


#### 桥接
Kubernetes通过bridge-netfilter配置使iptables规则应用在Linux网桥上。 该配置对Linux内核进行宿主机和容器之间数据包的地址转换是必需的。 否则， Pod进行外部服务网络请求时会出现目标主机不可达或者连接拒绝等错误（host unreachable或connection refused） 。

那么， 如何诊断呢？ 请看下面的命令：
```bash
# 检查 bridge netfilter是否开启
sysctl net.bridge.bridge-nf-call-iptables
# 0 表示未开启
net.bridge.bridge-nf-call-iptables=0
```

使用如下方式开启桥接
```bash
modprobe br_netfilter
# 开启
sysctl -w net.bridge.bridge-nf-call-iptables=1

echo  net.bridge.bridge-nf-call-iptables=1 >> /etc/sysconf.d/10-bridge-nf-call-iptables.conf
sysctl -p
```


### Pod CIDR冲突
Kubernetes有时会为容器和容器之间的通信建立一层特殊的overlay网络（取决于你使用什么样的网络插件） 。 使用隔离的Pod网络容器可以获得唯一的IP并且可以避免集群上的端口冲突， 而当Pod子网和主机网络出现冲突时就会出现问题。 Pod和Pod之间通信会因为路由问题被中断：
```bash
# curl http://172.28.128.132:5000
curl: (7) Failed to connect to 172.28.128.132 port 5000: No route to host
```

使用 `kubectl get pod -n xxx -o wide` 查看 ip地址是否和主机网络出现冲突

### hairpin
hairpin的含义用一句话表述就是“自己访问自己”。 例如， Pod有时无法通过Service IP访问自己， 这就有可能是hairpin的配置问题了。

Hairpin模式是一种网络配置选项，通常用于虚拟化环境中，特别是当使用Open vSwitch（OVS）或类似的软件定义网络（SDN）解决方案时。启用hairpin模式（即设置为1）允许同一桥接设备上的两个虚拟机之间直接通信，而不需要将数据包发送到外部网络再返回。这可以提高性能和效率，特别是在需要大量内部通信的应用场景中。

通常， 当Kube-proxy以iptables或IPVS模式运行， 并且Pod与桥接网络连接时， 就会发生这种情况。 Kubelet的启动参数提供了一个--hairpin-mode的标志， 支持的值有hairpin-veth和promiscuous-bridge。 检查Kubelet的日志也能看到以下日志行， 例如：
```bash
I0629 00:51:43.648698 3252 kubelet.go:380] hairpin mode set to "promiscuous-bridge"
```
用户需要检查Kubelet的--hairpin-mode是否被设置为一个合法的值
`--hairpin-mode`被Kubelet设置成hairpin-veth并且生效后， 底层其实是在修改宿主机操作系统/sys/devices/virtual/net目录下设备文件hairpin_mode的值， 可以通过以下命令确认是否修改成功：

```bash
# for intf in /sys/devices/virtual/net/cbr0/brif/; do cat $intf/hairpin_mode; done
1
1
1
1
```










