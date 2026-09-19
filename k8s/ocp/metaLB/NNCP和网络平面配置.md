
## 网络topo图

![[Pasted image 20260919104026.png]]

## 一台主机完整的NNCP配置

```bash
apiVersion: nmstate.io/v1
kind: NodeNetworkConfigurationPolicy
metadata:
  name: worker2.z2.ameidc2.com
spec:
  desiredState:
    interfaces:
    # 独立出来3个路由表200 201 202
    - name: m_bgp_vrf
      state: up
      type: vrf
      vrf:
        port:
        - m_bgp
        route-table-id: 200
    - name: nei_bgp_vrf
      state: up
      type: vrf
      vrf:
        port:
        - nei_bgp
        route-table-id: 202
    - name: wai_bgp_vrf
      state: up
      type: vrf
      vrf:
        port:
        - wai_bgp
        route-table-id: 201
# 拆解nad附加网络
    - ipv4:
        enabled: false
        forwarding: false
      ipv6:
        enabled: false
      name: m_nad
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 1221
    - ipv4:
        enabled: false
        forwarding: false
      ipv6:
        enabled: false
      name: nei_nad
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 131
    - ipv4:
        enabled: false
        forwarding: false
      ipv6:
        enabled: false
      name: wai_nad
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 34
# 拆解bgp 子接口
# 3个子接口，分别与路由器建立BGP Peer
# 访问vip流量从这里进来，也从这里出
    - ipv4:
        address:
        - ip: 100.1.31.3
          prefix-length: 24
        enabled: true
        forwarding: true
      ipv6:
        enabled: false
      name: m_bgp
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 1311
    - ipv4:
        address:
        - ip: 100.1.47.3
          prefix-length: 24
        enabled: true
        forwarding: true
      ipv6:
        enabled: false
      name: wai_bgp
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 1471
    - ipv4:
        address:
        - ip: 100.1.46.3
          prefix-length: 24
        enabled: true
        forwarding: true
      ipv6:
        enabled: false
      name: nei_bgp
      type: vlan
      vlan:
        base-iface: ens160
        id: 1461
    - ipv4:
        address:
        - ip: 100.1.48.3
          prefix-length: 24
        enabled: true
        forwarding: true
      ipv6:
        enabled: false
      name: m_out
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 1481
    - ipv4:
        address:
        - ip: 100.1.50.3
          prefix-length: 24
        enabled: true
        forwarding: true
      ipv6:
        enabled: false
      name: wai_out
      state: up
      type: vlan
      vlan:
        base-iface: ens160
        id: 1501
    - ipv4:
        address:
        - ip: 100.1.49.3
          prefix-length: 24
        enabled: true
        forwarding: true
      ipv6:
        enabled: false
      name: nei_out
      type: vlan
      vlan:
        base-iface: ens160
        id: 1491
## 拆解策略路由
## 这些是ocp用到的网络 (service pod Masquerade网络)
# 由于环境是多网口出口场景，为了排除干扰，需要把这些路由通过策略路由把这些网段放到主路由（路由ID 254）
# 伪装（Masquerade）网络解释
#      欺骗网络，官方名称伪装（Masquerade）。当Pod需要访问集群外部网络（比如访问互联网）时，就会用到它
#      工作原理：它的核心是网络地址转换 NAT, 更具体的说是原地址转换（SNAT），当Pod的数据要离开集群时，伪装网络会将数据包的源IP(Pod的私有IP)替换为当前节点的IP地址。
# 为什么需要它？因为Pod的IP是集群内部的私有地址，外部网络不认识也无法直接进行路由，通过伪装，Pod就能借用，节点的身份与外界进行通信，OCP这个功能保留了一个专用的子网，例如169.254.0.0/17
    route-rules:
      config:
      - ip-to: 172.31.0.0/16   # ocp service 网络
        priority: 900
        route-table: 254
      - ip-to: 10.225.0.0/16  # ocp pod网络，每个集群不同
        priority: 900
        route-table: 254
      - ip-to: 169.254.0.0/17  # ocp伪装(masquerade)网络，每个集群都是这个网段，本机生效，每个主机IP可以重复
        priority: 900
        route-table: 254

      - ip-to: 10.161.35.0/24     # 
        priority: 1100
        route-table: 254
      - ip-to: 10.161.44.0/24
        priority: 1100
        route-table: 254
      - ip-to: 10.161.33.0/24
        priority: 1100
        route-table: 254
# 添加的静态路由，放到主路由中，保障主动出去的流量从对应的网络出去
    routes:
      config:
      - destination: 10.161.35.0/24
        next-hop-address: 100.1.48.1
        next-hop-interface: m_out
      - destination: 10.161.44.0/24
        next-hop-address: 100.1.49.1
        next-hop-interface: nei_out
      - destination: 10.161.33.0/24
        next-hop-address: 100.1.50.1
        next-hop-interface: wai_out
# 这些是保障访问vip流量进来后，通过EgressService新增的策略路由（另外一个相关的文档会介绍）导入到对应的路由ID，此处的路由是保障响应的路由ID的路由从对应的网口出去
      - destination: 0.0.0.0/0
        next-hop-address: 100.1.31.1
        next-hop-interface: m_bgp
        table-id: 200
      - destination: 0.0.0.0/0
        next-hop-address: 100.1.46.1
        next-hop-interface: nei_bgp
        table-id: 202
      - destination: 0.0.0.0/0
        next-hop-address: 100.1.47.1
        next-hop-interface: wai_bgp
        table-id: 201
  nodeSelector:
    kubernetes.io/hostname: worker2.z2.ameidc2.com
```



## 验证
```bash
[root@worker2 ~]# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.161.45.6     0.0.0.0         UG    48     0        0 br-ex
10.161.33.0     100.1.50.1      255.255.255.0   UG    0      0        0 wai_out
10.161.35.0     100.1.48.1      255.255.255.0   UG    0      0        0 m_out
10.161.44.0     100.1.49.1      255.255.255.0   UG    0      0        0 nei_out
10.161.45.0     0.0.0.0         255.255.255.0   U     48     0        0 br-ex
10.225.0.0      10.225.40.1     255.255.0.0     UG    0      0        0 ovn-k8s-mp0
10.225.40.0     0.0.0.0         255.255.248.0   U     0      0        0 ovn-k8s-mp0
100.1.48.0      0.0.0.0         255.255.255.0   U     409    0        0 m_out
100.1.49.0      0.0.0.0         255.255.255.0   U     410    0        0 nei_out
100.1.50.0      0.0.0.0         255.255.255.0   U     411    0        0 wai_out
169.254.0.0     0.0.0.0         255.255.128.0   U     0      0        0 br-ex
169.254.0.1     0.0.0.0         255.255.255.255 UH    0      0        0 br-ex
169.254.0.3     10.225.40.1     255.255.255.255 UGH   0      0        0 ovn-k8s-mp0
172.31.0.0      169.254.0.4     255.255.0.0     UG    0      0        0 br-ex
# linux 策略路由，路由表查找
[root@worker2 ~]# ip rule show
0:      from all lookup local
30:     from all fwmark 0x1745ec lookup 7
900:    from all to 172.31.0.0/16 lookup main proto static
900:    from all to 169.254.0.0/17 lookup main proto static
900:    from all to 10.225.0.0/16 lookup main proto static
1000:   from all lookup [l3mdev-table]
5000:   from 172.31.143.103 lookup 200
5000:   from 169.254.0.3 sport 31832 lookup 200
5000:   from 169.254.0.3 sport 31647 lookup 200
5000:   from 172.31.183.228 lookup 202
5000:   from 169.254.0.3 sport 31688 lookup 202
5000:   from 169.254.0.3 sport 30659 lookup 202
5000:   from 172.31.51.10 lookup 201
5000:   from 169.254.0.3 sport 32556 lookup 201
5000:   from 169.254.0.3 sport 32191 lookup 201
5000:   from 10.225.40.71 lookup 201
5000:   from 172.31.84.247 lookup 202
5000:   from 10.225.40.87 lookup 202
5000:   from 172.31.157.27 lookup 202
5000:   from 172.31.107.117 lookup 201
5000:   from 10.225.40.110 lookup 202
5000:   from 10.225.40.110 lookup 201
5999:   from all fwmark 0x3f0 lookup main
32766:  from all lookup main
32767:  from all lookup default
[core@worker2 iproute2]$ cat /usr/share/iproute2/rt_tables 
#
# reserved values
#
255     local
254     main
253     default
0       unspec
#
# local
#
#1      inr.ruhep

[root@worker2 ~]# ip route show table 200 # 管理网络
default via 100.1.31.1 dev m_bgp proto static 
100.1.31.0/24 dev m_bgp proto kernel scope link src 100.1.31.3 metric 406 
local 100.1.31.3 dev m_bgp proto kernel scope host src 100.1.31.3 
broadcast 100.1.31.255 dev m_bgp proto kernel scope link src 100.1.31.3 

[root@worker2 ~]# ip route show table 202 # 对内网络 
default via 100.1.46.1 dev nei_bgp proto static 
100.1.46.0/24 dev nei_bgp proto kernel scope link src 100.1.46.3 metric 407 
local 100.1.46.3 dev nei_bgp proto kernel scope host src 100.1.46.3 
broadcast 100.1.46.255 dev nei_bgp proto kernel scope link src 100.1.46.3 
# via 100.1.47.1 下一跳 = 对端路由器（BGP peer 所在网关）
[root@worker2 ~]# ip route show table 201 # 对外网络 
default via 100.1.47.1 dev wai_bgp proto static 
100.1.47.0/24 dev wai_bgp proto kernel scope link src 100.1.47.3 metric 408 
local 100.1.47.3 dev wai_bgp proto kernel scope host src 100.1.47.3 
broadcast 100.1.47.255 dev wai_bgp proto kernel scope link src 100.1.47.3 
[root@worker2 ~]# ip route show table 1000
Error: ipv4: FIB table does not exist.
Dump terminated

[root@worker2 ~]# ip addr | egrep "ens|nad|bgp|br-|k8s|_out"
2: ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
5: ovn-k8s-mp0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1400 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 10.225.40.2/21 brd 10.225.47.255 scope global ovn-k8s-mp0
7: br-int: <BROADCAST,MULTICAST> mtu 1400 qdisc noop state DOWN group default qlen 1000
8: m_nad@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
9: wai_nad@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
10: nei_nad@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
12: private@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master ovs-system state UP group default qlen 1000
13: br-ex: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 10.161.45.35/24 brd 10.161.45.255 scope global noprefixroute br-ex
    inet 169.254.0.2/17 brd 169.254.127.255 scope global br-ex
90: m_bgp_vrf: <NOARP,MASTER,UP,LOWER_UP> mtu 65575 qdisc noqueue state UP group default qlen 1000
91: m_bgp@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master m_bgp_vrf state UP group default qlen 1000
    inet 100.1.31.3/24 brd 100.1.31.255 scope global noprefixroute m_bgp
92: nei_bgp_vrf: <NOARP,MASTER,UP,LOWER_UP> mtu 65575 qdisc noqueue state UP group default qlen 1000
93: nei_bgp@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master nei_bgp_vrf state UP group default qlen 1000
    inet 100.1.46.3/24 brd 100.1.46.255 scope global noprefixroute nei_bgp
94: wai_bgp_vrf: <NOARP,MASTER,UP,LOWER_UP> mtu 65575 qdisc noqueue state UP group default qlen 1000
95: wai_bgp@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master wai_bgp_vrf state UP group default qlen 1000
    inet 100.1.47.3/24 brd 100.1.47.255 scope global noprefixroute wai_bgp
96: m_out@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    inet 100.1.48.3/24 brd 100.1.48.255 scope global noprefixroute m_out
97: nei_out@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    inet 100.1.49.3/24 brd 100.1.49.255 scope global noprefixroute nei_out
98: wai_out@ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    inet 100.1.50.3/24 brd 100.1.50.255 scope global noprefixroute wai_out
[root@worker2 ~]# route -46 -n |egrep -i "^0.0.0.0|::/0"
0.0.0.0         10.161.45.6     0.0.0.0         UG    48     0        0 br-ex
::/0                           ::                         !n   -1  1      0 lo
::/0                           ::                         !n   -1  1      0 lo
::/0                           ::                         !n   -1  1      0 lo
::/0                           ::                         !n   -1  1      0 lo
::/0                           ::                         !n   -1  1      0 lo
[root@worker2 ~]# #cat /etc/NetworkManager/system-connections/ens34.48.nmconnection 
[root@worker2 ~]# sysctl -a | grep .rp_filter |grep ipv4| egrep -i "nei|ens|br-|vlan|nad|bgp|out" # 查看反向路由策略
net.ipv4.conf.br-ex.arp_filter = 0
net.ipv4.conf.br-ex.rp_filter = 1
net.ipv4.conf.br-int.arp_filter = 0
net.ipv4.conf.br-int.rp_filter = 1
net.ipv4.conf.ens160.arp_filter = 0
net.ipv4.conf.ens160.rp_filter = 1
net.ipv4.conf.m_bgp.arp_filter = 0
net.ipv4.conf.m_bgp.rp_filter = 1
net.ipv4.conf.m_bgp_vrf.arp_filter = 0
net.ipv4.conf.m_bgp_vrf.rp_filter = 1
net.ipv4.conf.m_nad.arp_filter = 0
net.ipv4.conf.m_nad.rp_filter = 1
net.ipv4.conf.m_out.arp_filter = 0
net.ipv4.conf.m_out.rp_filter = 1
net.ipv4.conf.nei_bgp.arp_filter = 0
net.ipv4.conf.nei_bgp.rp_filter = 1
net.ipv4.conf.nei_bgp_vrf.arp_filter = 0
net.ipv4.conf.nei_bgp_vrf.rp_filter = 1
net.ipv4.conf.nei_nad.arp_filter = 0
net.ipv4.conf.nei_nad.rp_filter = 1
net.ipv4.conf.nei_out.arp_filter = 0
net.ipv4.conf.nei_out.rp_filter = 1
net.ipv4.conf.wai_bgp.arp_filter = 0
net.ipv4.conf.wai_bgp.rp_filter = 1
net.ipv4.conf.wai_bgp_vrf.arp_filter = 0
net.ipv4.conf.wai_bgp_vrf.rp_filter = 1
net.ipv4.conf.wai_nad.arp_filter = 0
net.ipv4.conf.wai_nad.rp_filter = 1
net.ipv4.conf.wai_out.arp_filter = 0
net.ipv4.conf.wai_out.rp_filter = 1
[root@worker2 ~]# #ip route flush table 100 # 清空路由表内容
[root@worker2 ~]# #ip rule del priority 29 # 删除制定路由表规则
[root@worker2 ~]# # sudo systemctl restart NetworkManager # 修改网卡可重启
[root@worker2 ~]# 
[root@worker2 ~]# sysctl net.ipv4.conf.m_nad.forwarding
net.ipv4.conf.m_nad.forwarding = 0
[root@worker2 ~]# sysctl net.ipv4.ip_forward
net.ipv4.ip_forward = 0
[root@worker2 ~]# sysctl -a | egrep -i "\.forwarding" |grep ipv4|egrep -i  "nad|vrf|k8s|ens|default|bgp|out"
net.ipv4.conf.default.forwarding = 0
net.ipv4.conf.ens160.forwarding = 0
net.ipv4.conf.m_bgp.forwarding = 1
net.ipv4.conf.m_bgp_vrf.forwarding = 0
net.ipv4.conf.m_nad.forwarding = 0
net.ipv4.conf.m_out.forwarding = 1
net.ipv4.conf.nei_bgp.forwarding = 1
net.ipv4.conf.nei_bgp_vrf.forwarding = 0
net.ipv4.conf.nei_nad.forwarding = 0
net.ipv4.conf.nei_out.forwarding = 1
net.ipv4.conf.ovn-k8s-mp0.forwarding = 1
net.ipv4.conf.wai_bgp.forwarding = 1
net.ipv4.conf.wai_bgp_vrf.forwarding = 0
net.ipv4.conf.wai_nad.forwarding = 0
net.ipv4.conf.wai_out.forwarding = 1
[root@worker2 ~]# 
[root@worker2 ~]#
```

内核收到一个包做路由决策时，不是直接查 `main` 表，而是：

```bash
包进来
 ↓
按优先级（priority）逐条匹配 ip rule
 ↓
命中第一条 → 用那条 rule 指定的路由表 lookup XXX
 ↓
在该路由表里找最长前缀匹配
 ↓
没命中 → 继续下一条 rule
```
优先级数字越小，越先匹配。
```bash
lookup 200    # 查 /etc/iproute2/rt_tables 里 ID=200 的表
lookup main   # 查主路由表（ip route 默认操作的表）
lookup local  # 查本地表（本机 IP、广播、多播）
lookup default # 查 default 表（通常为空）
lookup 201    # 查 ID=201 的表（你这里是 wai_bgp_vrf）
lookup 202    # 查 ID=202 的表（你这里是 nei_bgp_vrf）
lookup 200    # 查 ID=200 的表（你这里是 m_bgp_vrf）
```


>**VRF 不是网卡，是路由表的外壳。**​
>"绑定" = 把真实网卡设为 VRF 的 slave（`master wai_bgp_vrf`）。
>绑了之后，这张卡上的流量和路由就归那张表管，和 main 表彻底隔离。
>VRF 设备自己不收不发包（TX=0），只做"入口分类"和"进程绑定"


## BGP

### ipaddresspools
```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: mgt-addr-pool:
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  addresses:
    - 10.161.35.113-10.161.35.126
  autoAssign: true
  avoidBuggyIPs: false
```
  
```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: internal-addr-pool
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  addresses:
    - 10.161.44.65-10.161.44.90
  autoAssign: true
  avoidBuggyIPs: false
```

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: external-addr-pool
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  addresses:
    - 10.161.33.65-10.161.33.80
  autoAssign: true
  avoidBuggyIPs: false

```

### bgppeers
```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: mgt-bgp-peer
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  disableMP: false
  dualStackAddressFamily: false
  ebgpMultiHop: true
  myASN: 65581
  peerASN: 65520
  peerAddress: 100.1.31.1
  peerPort: 179
  vrf: m_bgp_vrf
```
  
```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: internal-bgp-peer
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  disableMP: false
  dualStackAddressFamily: false
  ebgpMultiHop: true
  myASN: 65581
  peerASN: 65520
  peerAddress: 100.1.46.1
  peerPort: 179
  vrf: nei_bgp_vrf
```
  
```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: external-bgp-peer
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  disableMP: false
  dualStackAddressFamily: false
  ebgpMultiHop: true
  myASN: 65581
  peerASN: 65520
  peerAddress: 100.1.47.1
  peerPort: 179
  vrf: wai_bgp_vrf
```
### BGPAdvertisements
```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: mgt-addr-pool-advertisement
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  aggregationLength: 32
  aggregationLengthV6: 128
  ipAddressPools:
    - mgt-addr-pool
  peers:
    - mgt-bgp-peer
```

```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: internal-addr-pool-advertisement
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  aggregationLength: 32
  aggregationLengthV6: 128
  ipAddressPools:
    - internal-addr-pool
  peers:
    - internal-bgp-peer
```


```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: external-addr-pool-advertisement
  namespace: metallb-system
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  aggregationLength: 32
  aggregationLengthV6: 128
  ipAddressPools:
    - external-addr-pool
  peers:
    - external-bgp-peer
```


## EgressService

### mgt-gateway-nginx
```yaml
apiVersion: k8s.ovn.org/v1
kind: EgressService
metadata:
  name: mgt-gateway-nginx
  namespace: ysp-z2-prod01
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  network: '200'
  nodeSelector:
    matchLabels:
      ysp-product: mcx
  sourceIPBy: Network
status:
  host: ALL
```
### internal-gateway-nginx
```yaml
apiVersion: k8s.ovn.org/v1
kind: EgressService
metadata:
  name: internal-gateway-nginx
  namespace: ysp-z2-prod01
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  network: '202'
  nodeSelector:
    matchLabels:
      ysp-product: mcx
  sourceIPBy: Network
status:
  host: ALL
```
### external-gateway-nginx
```
apiVersion: k8s.ovn.org/v1
kind: EgressService
metadata:
  name: external-gateway-nginx
  namespace: ysp-z2-prod01
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  network: '201'
  nodeSelector:
    matchLabels:
      ysp-product: mcx
  sourceIPBy: Network
status:
  host: ALL
```
### pres-lb-internal
```
apiVersion: k8s.ovn.org/v1
kind: EgressService
metadata:
  name: pres-lb-internal
  namespace: mcs-prod01
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  network: '202'
  nodeSelector:
    matchLabels:
      ysp-product: mcx
  sourceIPBy: Network
status:
  host: ALL
```
### ulpproxy-lb-external
```yaml
apiVersion: k8s.ovn.org/v1
kind: EgressService
metadata:
  name: ulpproxy-lb-external
  namespace: mcs-prod01
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  network: '201'
  nodeSelector:
    matchLabels:
      ysp-product: mcx
  sourceIPBy: Network
status:
  host: ALL
```
### ulpproxy-lb-internal
```yaml
apiVersion: k8s.ovn.org/v1
kind: EgressService
metadata:
  name: ulpproxy-lb-internal
  namespace: mcs-prod01
  labels:
    app.kubernetes.io/managed-by: Helm
spec:
  network: '202'
  nodeSelector:
    matchLabels:
      ysp-product: mcx
  sourceIPBy: Network
status:
  host: ALL
```


## 附录



### 管理模式
```bash
NNCP（NMState）      → 建 VRF / 路由表 / 网卡从属关系（节点 OS 层）
MetalLB             → 给 LB Service 分配外部 IP，并通过 BGP 通告
OVN EgressService   → 告诉 OVN：“这个 LB Service 的 Pod 出口，用路由表 200”
Linux ip rule/table → 表 200 里是 m_bgp_vrf 的路由 → 从 m_bgp 出
```


### 验证
```bash
# 1. 看 VRF 和成员口
ip vrf show
ip link show m_bgp

# 2. 看表 200 内容
ip route show table 200

# 3. 看 OVN 给 egress service 加的 rule
ip rule | grep 200

# 4. 看节点有没有被 OVN 打标
kubectl get node <node> --show-labels | grep egress-service

# 5. Service 名必须和 EgressService 名一致
kubectl get svc -n ysp-z2-prod01 mgt-gateway-nginx
```







































