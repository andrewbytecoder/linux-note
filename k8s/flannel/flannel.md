
## 网络模式

### TAP And TUN

![[Pasted image 20251110172226.png]]

tap产用作虚拟网卡，比如Flannel中Veth Pair出来的网络设备通过Tap虚拟出来一个网卡，插入到linux的虚拟虚拟交换机上

tap/tun 提供了一台主机内用户空间的数据传输机制。它虚拟了一套网络接口，这套接口和物理的接口无任何区别，可以配置 IP，可以路由流量，不同的是，它的流量只在主机内流通。
作为网络设备，tap/tun 也需要配套相应的驱动程序才能工作。tap/tun 驱动程序包括两个部分，一个是字符设备驱动，一个是网卡驱动。这两部分驱动程序分工不太一样，字符驱动负责数据包在内核空间和用户空间的传送，网卡驱动负责数据包在 TCP/IP 网络协议栈上的传输和处理。

tap/tun 有些许的不同，tun 只操作三层的 IP 包，而 tap 操作二层的以太网帧。
tap设备通常用来连接其它网络设备(它更像网卡)，tun设备通常用来结合用户空间程序实现再次封装。换句话说，tap设备通常接入到虚拟交换机(bridge)上作为局域网的一个节点，tun设备通常用来实现三层的ip隧道。但tun/tap的用法是灵活的，只不过上面两种使用场景更为广泛。例如，除了可以使用tun设备来实现ip层隧道，使用tap设备实现二层隧道的场景也颇为常见。tun、tap作为虚拟网卡，除了不具备物理网卡的硬件功能外，它们和物理网卡的功能是一样的，此外tun、tap负责在内核网络协议栈和用户空间之间传输数据。

| 对比项  | TAP                     | TUN               |
| ---- | ----------------------- | ----------------- |
| 工作层级 | Layer 2（以太网帧）           | Layer 3（IP 包）     |
| 数据格式 | Ethernet frame（含 MAC 头） | IP packet（不含 MAC） |
| 典型用途 | 虚拟机网卡、桥接                | VPN、隧道（如 OpenVPN） |
1.举例：其中在veth pair的实验中，每一个vetp设备可以看做成一个tap设备，此时处理的时候，其主要是在处理2层的MAC地址层的数据包。
2.举例：其中在Flannel的UDP Mode中的flannel0就是一个TUN设备：
       2.1：其中通过ip -d link show flannel0 查看可以得出：
            [root@k8s-1 ~]# ip -d link show flannel0
            4: flannel0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1472 qdisc pfifo_fast state UNKNOWN mode DEFAULT group default qlen 500
               link/none  promiscuity 0 
            tun addrgenmode random numtxqueues 1 numrxqueues 1 gso_max_size 65536 gso_max_segs 65535 
       2.2：也可通过抓包可以看出，此时处理的是一个RAW格式数据包，但无2层MAC信息。只有3层的IP信息。
            [root@k8s-1 ~]# tcpdump  -i flannel0 -w flannel.cap
						tcpdump: listening on flannel0, link-type `#RAW` (Raw IP)#, capture size 262144 bytes

总结：tun和tap都是虚拟网卡设备：
1. tun是三层设备，其封装的外层是IP头。
2. tap是二层设备，其封装的外层是以太网帧(frame)头。
3. tun是PPP点对点设备，没有MAC地址。
4. tap是以太网设备，有MAC地址tap比tun更接近于物理网卡，可以认为，tap设备等价于去掉了硬件功能的物理网卡。
这意味着，如果提供了用户空间的程序去收发tun/tap虚拟网卡的数据，所收发的内容是不同的。
>> 收发tun设备的用户程序，只能间接提供封装和解封数据包的IP头的功能
>> 收发tap设备的用户程序，只能间接提供封装和解封数据包的帧头的功能 
注意，此处用词是【收发数据】而非【处理数据】，是【间接提供】而非【直接提供】，因为在不绕过内核网络协议栈的情况下，读写虚拟网卡的用户程序是不能封装和解封数据的，只有内核的网络协议栈才能封装和解封数据。

### flannel tun

![[Pasted image 20251110184106.png]]

UDP模式下flanneld进程在启动时会通过打开/dev/net/tun的方式生成一个TUN设备（flannel0），TUN设备可以简单理解为Linux当中提供的一种内核网络与用户空间（应用程序）通信的一种机制， TUN设备的特殊性在于它可把数据包转给创建它的用户空间进程，从而实现内核到用户空间的拷贝。即可通过直接读写tun设备的方式收发RAW IP包

1. 容器A当中发出ICMP请求报文，通过IP封装后形式为：10.244.1.96 -> 10.244.2.194，此时通过容器A内的路由表匹配到应该将IP包发送到网关10.244.1.1（cni0网桥）。
2. 此时到达cni0的IP包目的地IP 10.244.2.194匹配到节点A上第一条路由规则（10.244.0.0），内核将RAW IP包发送给flannel0接口。
3. flannel0为tun设备，发送给flannel0接口的RAW IP包（无MAC信息）将被flanneld进程接收到，flanneld进程接收 到 RAW IP 包 后 在 原 有 的 基 础 上 进 行 UDP 封 包 ， UDP 封 包 的 形 式 为 ： 172.16.130.140:src port ->172.16.130.164:8285。
4. flanneld在启动时会将该节点的网络信息通过api-server保存到etcd当中，故在发送报文时可以通过查询etcd得到10.244.2.194这个容器的IP属于host B，且host B的IP为172.16.130.164。
5. flanneld将封装好的UDP报文经eth1发出，从这里可以看出网络包在通过eth1发出前先是加上了UDP头（8个字节），再然后加上了IP头（20个字节）进行封装，这也是为什么flannel0的MTU要比eth1的MTU小28个字节的原因（防止封装后的以太网帧超过eth1的MTU而在经过eth1时被丢弃）。
6. 网络包经节点A和节点B之间的网络连接到达host B。
7. host B收到UDP报文后经Linux内核通过UDP端口号8285将包交给正在监听的应用flanneld。8. 运行在host B当中的flanneld将UDP包解包后得到RAW IP包：10.244.1.96 -> 10.244.2.194。
8. 解封后的RAW IP包匹配到host B上的路由规则（10.244.2.0），内核将RAW IP包发送到cni0。



### VxLAN 模式
RFC定义了VLAN扩展方案VXLAN（Virtual eXtensible Local Area Network，虚拟扩展局域网）。VxLAN采用MACin UDP（User Datagram Protocol）封装方式，是NVO3（Network Virtualization over Layer 3）中的一种网络虚拟化技术。

服务器虚拟化技术的广泛部署，极大地增加了数据中心的计算密度；同时，为了实现业务的灵活变更，虚拟机VM需要能够在网络中不受限迁移，这给传统的“二层+三层”数据中心网络带来了新的挑战。

**虚拟机规模受网络设备表项规格的限制**
在传统二层网络环境下，数据报文是通过查询MAC地址表进行二层转发。服务器虚拟化后，VM的数量比原有的物理机发生了数量级的增长，伴随而来的便
是VM网卡MAC地址数量的空前增加。而接入侧二层设备的MAC地址表规格较小，无法满足快速增长的VM数量。(VLAN VNI bit位少)

**网络隔离能力有限**
VLAN作为当前主流的网络隔离技术，在标准定义中只有12比特，因此可用的VLAN数量仅4096个。对于公有云或其它大型虚拟化云计算服务这种动辄上万甚至更多租户的场景而言，VLAN的隔离能力无法满足。

**虚拟机迁移范围受限**
由于服务器资源等问题（如CPU过高，内存不够等），虚拟机迁移已经成为了一个常态性业务。
虚拟机迁移是指将虚拟机从一个物理机迁移到另一个物理机。为了保证虚拟机迁移过程中业务不中断，则需要保证虚拟机的IP地址、MAC地址等参数保持不变，这就要求虚拟机迁移必须发生在一个二层网络中。而传统的二层网络，将虚拟机迁移限制在了一个较小的局部范围内。

---
为了应对传统数据中心网络对服务器虚拟化技术的限制，VXLAN技术应运而生，其能够很好的解决上述问题。

**针对虚拟机规模受设备表项规格限制**
VXLAN将管理员规划的同一区域内的VM发出的原始报文封装成新的UDP报文，并使用物理网络的IP和MAC地址作为外层头，这样报文对网络中的其他设备只表现为封装后的参数。因此，极大降低了大二层网络对MAC地址规格的需求。

**针对网络隔离能力限制**
VXLAN引入了类似VLAN ID的用户标识，称为VXLAN网络标识VNI（VXLAN Network Identifier），由24比特组成，支持多达16M的VXLAN段，有效得解决了云计算中海量租户隔离的问题。

**针对虚拟机迁移范围受限**
VXLAN将VM发出的原始报文进行封装后通过VXLAN隧道进行传输，隧道两端的VM不需感知传输网络的物理架构。这样，对于具有同一网段IP地址的VM而言，即使其物理位置不在同一个二层网络中，但从逻辑上看，相当于处于同一个二层域。即VXLAN技术在三层网络之上，构建出了一个虚拟的大二层网络，只要虚拟机路由可达，就可以将其规划到同一个大二层网络中。这就解决了虚拟机迁移范围受限问题。

为了解决数据中心网络服务器虚拟化以及虚拟机不受限迁移问题，VXLAN特性应运而生。由于VXLAN特性在本质上属于一种VPN技术，因此，其同样能够应用在园区网络中，以实现分散物理站点之间的二层互联以及站点间的三层互联。

在当前的园区网中，租户站点与站点之间为了实现二、三层互联，需要部署相关设备以及多种二、三层网络技术。而基于Overlay的VXLAN技术，不感知当前的物理网络，能够在任意路由可达的网络上叠加二层虚拟网络，实现站点与站点之间的二层互联。同时，基于VXLAN三层网关，也能够实现站点与站点之间的三层互联。因此，通过VXLAN技术实现租户不同站点之间的互联更加快速、灵活。

Kubernetes CNI Flannel - VxLAN Packet Format
![[Pasted image 20251110185005.png]]

1. Flags(8 bits)其中I必须被设置为1，才是有效的，R需设为0。
2. VxLAN Segment ID/VxLAN Network Identifier(VNI)-为24bit，是虚拟网络的标识。
3. Reserved fields(24 bits and 8 bits) - 必须设置为0
4. VxLAN 外层隧道的目的端口号为4789，专为VxLAN分配的端口号
5. UDP Body实现基于流的负载分担，[SIP + DIP + SPORT + DPORT + TCP/ UDP]

Flannel VxLAN 跨节点通信原理
![[Pasted image 20251110185712.png]]![[Pasted image 20251110195139.png]]


### HOST-GW
![[Pasted image 20251110203301.png]]

![[Pasted image 20251110203209.png]]



### UDP 模式

![[Pasted image 20251111102212.png]]

UDP是与Docker网桥模式最相似的实现模式。不同的是，UDP模式在虚拟网桥基础上引入了TUN设备（flannel0）。TUN设备的特殊性在于它可以把数据包转给创建它的用户空间进程，从而实现内核到用户空间的拷贝。在Flannel中，flannel0由flanneld进程创建，因此会把容器的数据包转到flanneld，然后由flanneld封包转给宿主机发向外部网络。

UDP转发的过程为：Node1的Pod-1发起的IP包（目的地址为Node2的Pod-2）通过容器网关发到cni0，宿主机根据本地路由表将该包转到flannel0，接着发给flanneld。Flanneld根据目的容器容器子网与宿主机地址的关系（由etcd维护）获得目的宿主机地址，然后进行UDP封包，转给宿主机网卡通过物理网络传送到目标节点。在UDP数据包到达目标节点后，根据对称过程进行解包，将数据传递给目标Pod。

![[Pasted image 20251110172226.png]]

UDP模式使用了Flannel自定义的一种包头协议，实现三层网络Overlay网络处理跨主通信的问题。但是由于数据在内核和用户态经过了多次拷贝：容器是用户态，cni0和flannel0是内核态，flanneld是用户态，最终又要通过内核将数据发到外部网络，因此性能损耗较大，对于有数据传输有要求的在线业务并不适用。


### IPIP 模式
```bash
"IP forwarding" is a synonym for "routing." It is called "kernel IP forwarding" because it is a feature of the Linux kernel.

A router has multiple network interfaces. If traffic comes in on one interface that matches a subnet of another network interface, a router then forwards that traffic to the other network interface.

# 重点看这里：
So, let's say you have two NICs, one (NIC 1) is at address 192.168.2.1/24, and the other (NIC 2) is 192.168.3.1/24. If forwarding is enabled, and a packet comes in on NIC 1 with a "destination address" of 192.168.3.8, the router will resend that packet out of the NIC 2.

It's common for routers functioning as gateways to the Internet to have a default route whereby any traffic that doesn't match any NICs will go through the default route's NIC. So in the above example, if you have an internet connection on NIC 2, you'd set NIC 2 as your default route and then any traffic coming in from NIC 1 that isn't destined for something on 192.168.2.0/24 will go through NIC 2. Hopefully there's other routers past NIC 2 that can further route it (in the case of the Internet, the next hop would be your ISP's router, and then their providers upstream router, etc.)

Enabling ip_forward tells your Linux system to do this. For it to be meaningful, you need two network interfaces (any 2 or more of wired NIC cards, Wifi cards or chipsets, PPP links over a 56k modem or serial, etc.).

When doing routing, security is important and that's where Linux's packet filter, iptables, gets involved. So you will need an iptables configuration consistent with your needs.

Note that enabling forwarding with iptables disabled and/or without taking firewalling and security into account could leave you open to vulnerabilites if one of the NICs is facing the Internet or a subnet you don't have control over.
```


![[Pasted image 20251111111848.png]]




