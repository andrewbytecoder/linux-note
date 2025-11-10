
## 网络模式

### TAP And TUN

![[Pasted image 20251110172226.png]]

tap产用作虚拟网卡，比如Flannel中Veth Pair出来的网络设备通过Tap虚拟出来一个网卡，插入到linux的虚拟虚拟交换机上




tap/tun 有些许的不同，tun 只操作三层的 IP 包，而 tap 操作二层的以太网帧。
tap设备通常用来连接其它网络设备(它更像网卡)，tun设备通常用来结合用户空间程序实现再次封装。换句话说，tap设备通常接入到虚拟交换机(bridge)上作为局域网的一个节点，tun设备通常用来实现三层的ip隧道。但tun/tap的用法是灵活的，只不过上面两种使用场景更为广泛。例如，除了可以使用tun设备来实现ip层隧道，使用tap设备实现二层隧道的场景也颇为常见。tun、tap作为虚拟网卡，除了不具备物理网卡的硬件功能外，它们和物理网卡的功能是一样的，此外tun、tap负责在内核网络协议栈和用户空间之间传输数据。



| 对比项  | TAP                     | TUN               |
| ---- | ----------------------- | ----------------- |
| 工作层级 | Layer 2（以太网帧）           | Layer 3（IP 包）     |
| 数据格式 | Ethernet frame（含 MAC 头） | IP packet（不含 MAC） |
| 典型用途 | 虚拟机网卡、桥接                | VPN、隧道（如 OpenVPN） |


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
RFC定义了VLAN扩展方案VXLAN（Virtual eXtensible Local Area Network，虚拟扩展局域网）。VXLAN采用MACin UDP（User Datagram Protocol）封装方式，是NVO3（Network Virtualization over Layer 3）中的一种网络虚拟化技术。

Kubernetes CNI Flannel - VxLAN Packet Format
![[Pasted image 20251110185005.png]]

1. Flags(8 bits)其中I必须被设置为1，才是有效的，R需设为0。
2. VxLAN Segment ID/VxLAN Network Identifier(VNI)-为24bit，是虚拟网络的标识。
3. Reserved fields(24 bits and 8 bits) - 必须设置为0
4. VxLAN 外层隧道的目的端口号为4789，专为VxLAN分配的端口号
5. UDP Body实现基于流的负载分担，[SIP + DIP + SPORT + DPORT + TCP/ UDP]

![[Pasted image 20251110185712.png]]![[Pasted image 20251110195139.png]]


### HOST-GW
![[Pasted image 20251110203301.png]]

![[Pasted image 20251110203209.png]]
