## 在使用Calico的kubernetes环境中进行MTU配置
MTU配置的两个重要概念
1. calico Pod接口的MTU：Calico默认的MTU值为何为 1450? 这一数值如何影响Pod之间通信？又该如何正确配置该数值？
2. 网络基础设施MTU值：VLAN接口的MTU值如何影响跨子网的kubernetes通信。

MTU 最大传输单元是指能够在网络上传输的最大数据包大小。对那个某个数据包的大小超过MTU时，就必须对该数据包进行分割处理，或直接丢弃该数据包。

|Network Type|Common MTU|Description|
|---|---|---|
|Standard Ethernet|1500 bytes|Default for most networks|
|Jumbo Frames|9000 bytes|Used in data centers for performance|
|VXLAN Overlay|1450 bytes|1500 - 50 bytes VXLAN overhead|

## MTU 构造原理详解

MTU会影响整个数据包，一个数据包由多层协议头部和实际的数据内容组成。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Ethernet Frame                                   │
├──────────────┬──────────────┬──────────────────────┬───────────────────────┤
│   Ethernet   │     IP       │   TCP/UDP Header     │       Payload         │
│    Header    │   Header     │                      │       (Data)          │
│   14 bytes   │  20 bytes    │  20 bytes (TCP)      │      Variable         │
│              │              │   8 bytes (UDP)      │                       │
└──────────────┴──────────────┴──────────────────────┴───────────────────────┘
               │◄────────────────── MTU (e.g., 1500 bytes) ─────────────────►│
                                                     │◄─── MSS (Payload) ───►│
```

- MTU：指的是数据包的最大大小(包括头部、TCP/UDP头部以及有效载荷) -- 不包含以太网头部
- MSS(最大段大小)：TCP数据段中的最大有效载荷(MTU-20bytes IP - 20 bytes TCP = MSS)
```bash
# 以1500 MTU为例
MSS = 1500 - 20 - 20
# 以 9000 MTU巨型帧为例
MTU = 9000
MSS = 9000 - 20(IP) - 20(TCP)
```


## 实验topo图
![[Pasted image 20261023100510.png]]
- Arista cEOS 交换机充当核心交换机。为了进行演示，VLAN 10 和 VLAN 20 的 SVI 被分别配置为使用 9000 字节的巨型帧传输模式和 1500 字节的标准帧传输模式。
- Calico CNI 提供了容器网络功能。由于使用了 VXLAN 技术，初始时所使用的 MTU 值为默认值 1450
- Netshoot 模块（ `netshoot-client` / `netshoot-server` ）可用于测试节点/VLAN 之间的最大传输单元值以及连接性。

该实验环境有助于直观地了解容器网络接口（Calico CNI）与底层物理/VLAN 接口之间的 MTU 不匹配问题。通过该实验可以清楚地看到：如果 MTU 配置不当，就会导致 Kubernetes 网络在处理大尺寸数据包时出现故障——比如那些在 TLS 握手过程中使用的数据包。

## 资源清单

### 网络topo
```yaml
name: mtu-lab
topology:
  nodes:
    ceos01:
      kind: arista_ceos
      image: ceos:4.34.0F
      startup-config: startup-configs/ceos01-startup-config.config
    k01:
      kind: k8s-kind
      startup-config: k01-no-cni.yaml
      extras:
        k8s_kind:
          deploy:
            wait: 0s

    k01-control-plane:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.10/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1"

    k01-worker:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.11/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1"

    k01-worker2:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.10.12/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1"

    k01-worker3:
      kind: ext-container
      exec:
        - "ip addr add dev eth1 10.10.20.20/24"
        - "ip route add 10.10.10.0/24 via 10.10.20.1"

  links:
    - endpoints: ["ceos01:eth1", "k01-control-plane:eth1"]
    - endpoints: ["ceos01:eth2", "k01-worker:eth1"]
    - endpoints: ["ceos01:eth3", "k01-worker2:eth1"]
    - endpoints: ["ceos01:eth4", "k01-worker3:eth1"]

```

### kind 配置
使用第二张网卡建立ovn网络
```yaml
apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
name: k01
networking:
  disableDefaultCNI: true
  podSubnet: "192.168.0.0/16"
  serviceSubnet: "10.96.0.0/16"

nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.10"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.11"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.12"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.20.20"

```


### 网络测试工具

服务端放到work3上
```yaml
---
apiVersion: v1
kind: Pod
metadata:
  name: netshoot-server
  labels:
    app: netshoot-server
spec:
  # Schedule on worker3 (VLAN 20) for cross-VLAN traffic demonstration
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
          - key: kubernetes.io/hostname
            operator: In
            values:
            - k01-worker3
  containers:
  - name: netshoot
    image: nicolaka/netshoot
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "Netshoot Server pod started"
      echo "IP: $(hostname -i)"
      # Keep the pod running
      while true; do
        sleep 3600
      done

---
apiVersion: v1
kind: Service
metadata:
  name: netshoot-server
spec:
  selector:
    app: netshoot-server
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP

```

客户端放到work上
```yaml
---
apiVersion: v1
kind: Pod
metadata:
  name: netshoot-client
  labels:
    app: netshoot-client
spec:
  # Schedule on worker (VLAN 10) for cross-VLAN traffic to server on worker3
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
          - key: kubernetes.io/hostname
            operator: In
            values:
            - k01-worker
  containers:
  - name: netshoot
    image: nicolaka/netshoot
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "Netshoot Client pod started"
      echo "IP: $(hostname -i)"
      echo ""
      echo "=== MTU Lab Client ==="
      echo "Use this pod to test MTU and connectivity."
      echo ""
      # Keep the pod running
      while true; do
        sleep 3600
      done

```

### 交换机配置
```config
! Arista cEOS startup configuration
! MTU Lab - Configured with 9000 byte jumbo frames
!
hostname ceos
!
! Define VLAN 10
!
vlan 10
   name Calico-Network-Subnet1
!
! Define VLAN 20
!
vlan 20
   name Calico-Network-Subnet2
!
! Configure interfaces as access ports in VLAN 10 with jumbo MTU
!
interface Ethernet1
   description Connection to k01-control-plane
   switchport mode access
   switchport access vlan 10
   mtu 9000
!
interface Ethernet2
   description Connection to k01-worker
   switchport mode access
   switchport access vlan 10
   mtu 9000
!
interface Ethernet3
   description Connection to k01-worker2
   switchport mode access
   switchport access vlan 10
   mtu 9000

interface Ethernet4
   description Connection to k01-worker3
   switchport mode access
   switchport access vlan 20
   mtu 9000
!
! Layer 3 interface for VLAN 10 with jumbo MTU
!
interface Vlan10
   description Calico Network L3 Interface - Subnet 1
   ip address 10.10.10.1/24
   mtu 9000

interface Vlan20
   description Calico Network L3 Interface - Subnet 2
   ip address 10.10.20.1/24
   mtu 9000
!
! Enable IP routing
!
ip routing
!
! Management interface (standard MTU for management traffic)
!
interface Management0
   ip address dhcp
   no shutdown
!
! User configuration
!
username admin privilege 15 secret admin
!
! Enable HTTP API
!
management api http-commands
   no shutdown

end

```


## 实验验证
### Calico Pod 接口的MTU值
本节验证Calico默认的MTU设置如何影响容器之间的通信
#### 验证实验环境是否正常
topo校验
```bash
> containerlab inspect -t topology.clab.yaml
10:21:34 INFO Parsing & checking topology file=topology.clab.yaml
╭─────────────────────┬──────────────────────┬─────────┬───────────────────────╮
│         Name        │      Kind/Image      │  State  │     IPv4/6 Address    │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane   │ ext-container        │ running │ 172.21.0.2            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker          │ ext-container        │ running │ 172.21.0.3            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2         │ ext-container        │ running │ 172.21.0.5            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::5 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker3         │ ext-container        │ running │ 172.21.0.4            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ clab-mtu-lab-ceos01 │ arista_ceos          │ running │ 172.20.20.2           │
│                     │ ceos:4.34.0F         │         │ 3fff:172:20:20::2     │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane   │ k8s-kind             │ running │ 172.21.0.2            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker          │ k8s-kind             │ running │ 172.21.0.3            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2         │ k8s-kind             │ running │ 172.21.0.5            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::5 │
├─────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker3         │ k8s-kind             │ running │ 172.21.0.4            │
│                     │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
╰─────────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

k8s节点运行情况

```bash
> kubectl get node -o wide
NAME                STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION     CONTAINER-RUNTIME
k01-control-plane   Ready    control-plane   29m   v1.35.0   10.10.10.10   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker          Ready    <none>          28m   v1.35.0   10.10.10.11   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker2         Ready    <none>          28m   v1.35.0   10.10.10.12   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
k01-worker3         Ready    <none>          28m   v1.35.0   10.10.20.20   <none>        Debian GNU/Linux 12 (bookworm)   7.0.0-34-generic   containerd://2.2.0
```

查看测试工具运行情况

```bash
> kubectl get pod -o wide
NAME              READY   STATUS    RESTARTS   AGE   IP               NODE          NOMINATED NODE   READINESS GATES
netshoot-client   1/1     Running   0          11m   192.168.81.68    k01-worker    <none>           <none>
netshoot-server   1/1     Running   0          11m   192.168.209.68   k01-worker3   <none>           <none>  
```

#### 检查Calico的默认Pod 接口 eth0 的MTU
Calico 会为每个Pod创建一个虚拟以太网对。让我们来看下该Pod接口的MTU值吧：
```bash
> kubectl exec netshoot-client -- ip link show eth0
2: eth0@if9: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether 8a:59:4b:55:7d:14 brd ff:ff:ff:ff:ff:ff link-netnsid 0
~/calico-containerlab/18-mtu > 
```
该Pod的接口MTU值为1450字节。这是Calico的默认设置，即在 `Installation` 资源中未明确指定的MTU值时的默认值。

#### 验证主机接口的MTU值
这些主机接口都配置为使用巨型帧传输方式 `MTU 9500`，这是Containerlab中默认设置行为(当cEOS中配置为 9000时，这里会留有余量进行网络封装使用)
```bash
> docker exec k01-worker ip link show eth1
531: eth1@if532: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9500 qdisc noqueue state UP mode DEFAULT group default 
    link/ether aa:c1:ab:c0:87:f5 brd ff:ff:ff:ff:ff:ff link-netnsid 1
    altname clab-o-167bbd20b9352032
```

#### 测试基本 Ping 功能(使用小数据包)
现在来测试一次普通的 ping 请求吧：56 字节的数据加上 8 字节的 ICMP 头部，总共 64 字节
```bash
> kubectl get pod -o wide
NAME              READY   STATUS    RESTARTS   AGE   IP               NODE          NOMINATED NODE   READINESS GATES
netshoot-client   1/1     Running   0          23m   192.168.81.68    k01-worker    <none>           <none>
netshoot-server   1/1     Running   0          23m   192.168.209.68   k01-worker3   <none>           <none>
> kubectl exec -it netshoot-client -- sh
~ # ping -c 3 192.168.209.68
PING 192.168.209.68 (192.168.209.68) 56(84) bytes of data.
64 bytes from 192.168.209.68: icmp_seq=1 ttl=62 time=1.47 ms
64 bytes from 192.168.209.68: icmp_seq=2 ttl=62 time=0.884 ms
64 bytes from 192.168.209.68: icmp_seq=3 ttl=62 time=0.776 ms

--- 192.168.209.68 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2043ms
rtt min/avg/max/mdev = 0.776/1.043/1.471/0.305 ms
~ # 
```
**Small packets work fine!  小数据包完全没问题！**

#### 测试大延迟情况（超过Pod的MTU限制）
现在，让我们发送一个超过 1450 这个数值的巨大数据包。我们将使用 8900 字节的数据量，并设置“不要分片”标志（ `-M do` ）。
```bash
~ # ping -c 3 -s 8900 -M do 192.168.209.68
PING 192.168.209.68 (192.168.209.68) 8900(8928) bytes of data.
ping: sendmsg: Message too large
ping: sendmsg: Message too large
ping: sendmsg: Message too large

--- 192.168.209.68 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2029ms

```

- `-s 8900`: 将ICMP的数据包有效载荷设置为 8900字节
- `-M do`: 设置禁止分片，如果数据包超过了最大传输单元MTU，那么该数据包就不会被分片传输

ping 测试失败了！错误信息 `message too long, mtu=1450` 清楚地表明，Pod 接口的 MTU 值为 1450，这一数值导致无法发送较大的数据包。

#### 理解问题所在

```bash
> kubectl exec -it netshoot-client -- sh
~ # route -n 
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         169.254.1.1     0.0.0.0         UG    0      0        0 eth0
169.254.1.1     0.0.0.0         255.255.255.255 UH    0      0        0 eth0
~ # ip addr 
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host proto kernel_lo 
       valid_lft forever preferred_lft forever
2: eth0@if9: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP group default qlen 1000
    link/ether 8a:59:4b:55:7d:14 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 192.168.81.68/32 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::8859:4bff:fe55:7d14/64 scope link proto kernel_ll 
       valid_lft forever preferred_lft forever
~ # 
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     POD INTERFACE MTU LIMITATION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  You want to send: 8900 bytes                                               │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  netshoot-client │                                                       │
│  │                  │                                                       │
│  │  eth0 MTU: 1450  │ ◄── Calico default, not configured!                   │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           │  8900 bytes > 1450 MTU                                          │
│           │                                                                 │
│           ▼                                                                 │
│     ❌ BLOCKED!                                                              
│     "message too long, mtu=1450"                                            │
│                                                                             │
│  The packet never even leaves the pod!                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 修复：在calico安装配置中设置MTU值
为了支持巨型帧，我们需要在 Calico 的安装配置文件中设置 MTU 值（位于 calico-cni-config/custom-resources.yaml 文件中）。在设置 MTU 值时，需考虑到 VXLAN 协议带来的额外开销，即 50 字节。

```bash
Pod MTU = Physical MTU - VXLAN Overhead Pod MTU = 9000 - 50 = 8950
```

```bash
> kubectl patch installation default --type='merge' -p '{"spec":{"calicoNetwork":{"mtu":8950}}}'
installation.operator.tigera.io/default patched
```

#### 重启Pod以应用新的MTU值
该 MTU 值的更改仅适用于新创建的 Pod。请使用 tools/01-netshoot-server.yaml 和 tools/02-netshoot-client.yaml 这两个文件来删除并重新创建测试用 Pod。

```bash
> cd tools
> ls
01-netshoot-server.yaml  02-netshoot-client.yaml
> kubectl delete -f .
pod "netshoot-server" deleted
service "netshoot-server" deleted
pod "netshoot-client" deleted
> kubectl apply -f .
pod/netshoot-server created
service/netshoot-server created
pod/netshoot-client created
> kubectl get pod -o wide
NAME              READY   STATUS    RESTARTS   AGE   IP                NODE          NOMINATED NODE   READINESS GATES
netshoot-client   1/1     Running   0          13s   192.168.164.132   k01-worker2   <none>           <none>
netshoot-server   1/1     Running   0          13s   192.168.209.69    k01-worker3   <none>           <none>
> kubectl exec netshoot-client -- ip link show eth0
2: eth0@if11: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 8950 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether 8a:1d:73:54:13:bd brd ff:ff:ff:ff:ff:ff link-netnsid 0
```
Pod内部的eth0接口的MTU值已经变成了8950
#### 再次测试大包的Ping
```bash
> SERVER_IP=$(kubectl get pod netshoot-server -o jsonpath='{.status.podIP}')
kubectl exec netshoot-client -- ping -c 3 -s 8900 -M do $SERVER_IP
PING 192.168.209.69 (192.168.209.69) 8900(8928) bytes of data.
8908 bytes from 192.168.209.69: icmp_seq=1 ttl=62 time=1.08 ms
8908 bytes from 192.168.209.69: icmp_seq=2 ttl=62 time=0.797 ms
8908 bytes from 192.168.209.69: icmp_seq=3 ttl=62 time=0.908 ms

--- 192.168.209.69 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2064ms
rtt min/avg/max/mdev = 0.797/0.928/1.081/0.116 ms
~/calico-containerlab/18-mtu/tools >  
```

可以看到大尺寸的数据包可以正常传输了，正确的MTU配置使得各个网络单元之间能够使用巨型帧进行数据传输

- `-s 8900` 用于指定ICMP数据载荷的内容(8900字节)
- `8908 bytes` 在回复消息中，数据内容包括： payload(8900) + ICMP header(8 bytes)
- `8928`: in the first line = total IP packet = payload (8900) + ICMP header (8) + IP header (20)

#### 总结

| Scenario       | Pod Interface MTU | 8900-byte Ping | Result                           |
| -------------- | ----------------- | -------------- | -------------------------------- |
| Calico Default | 1450              | ❌ Fails        | `message too long, mtu=1450`     |
| MTU Configured | 8950              | ✅ Works        | Packets transmitted successfully |

重要提示：在安装 Calico 的过程中，必须将“Installation”配置项中的 MTU 值设置为与网络基础设施相匹配的值。默认的 1450 MTU 值适用于标准的 1500 字节网络，而不适用于巨型数据包传输。

### VLAN 接口的MTU值
在本节中阐述了网络基础设施的MTU值如何影响子网之间的通信。

#### 验证当前VXLAN MTU配置
连接到交换机，然后检查 VXLAN 接口的MTU值：

```bash
> docker exec -it clab-mtu-lab-ceos01 Cli
ceos>enable
ceos#show ip interface brief
                                                                              Address
Interface         IP Address           Status       Protocol           MTU    Owner  
----------------- -------------------- ------------ -------------- ---------- -------
Management0       172.20.20.2/24       up           up                1500           
Vlan10            10.10.10.1/24        up           up                9000           
Vlan20            10.10.20.1/24        up           up                9000       
```

两个VXLAN接口的MTU值均为 9000 字节

#### 从work3测试API的连接性
Worker3 位于 VLAN 20 中，必须通过交换机才能连接到位于 VLAN 10 中的 API 服务器。
```bash
> docker exec k01-worker3 curl -k --connect-timeout 10 https://10.10.10.10:6443/healthz
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100     2  100     2    0     0    306      0 --:--:-- --:--:-- --:--:--   333ok
```
VLAN 间通信能够实现，是因为 VLAN 的 MTU 值（9000）与主机的 MTU 值相同（9000）。

#### 将VLAN20的MTU值调整为 1500
现在，让我们来模拟下一种网络配置错误的情况：VXLAN20使用的是标准的MTU值，而各个主机则使用的是巨型帧
```bash
> docker exec -it clab-mtu-lab-ceos01 Cli
ceos>enable 
ceos#configure terminal
ceos(config)#interface Vlan20
ceos(config-if-Vl20)#mtu 1500
ceos(config-if-Vl20)#exit
ceos(config)#end
ceos#show ip interface brief
                                                                              Address
Interface         IP Address           Status       Protocol           MTU    Owner  
----------------- -------------------- ------------ -------------- ---------- -------
Management0       172.20.20.2/24       up           up                1500           
Vlan10            10.10.10.1/24        up           up                9000           
Vlan20            10.10.20.1/24        up           up                1500           

ceos#exit
~/calico-containerlab/18-mtu/tools >      
```

### 从work3测试API连接性
```bash
> docker exec k01-worker3 curl -k --connect-timeout 10 https://10.10.10.10:6443/healthz
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:--  0:00:10 --:--:--     0
curl: (28) SSL connection timeout
```
通信失败，由于较大的数据包（如证书）无法通过MTU值为1500的VXLAN 20 SVI 网络，因此TLS握手过程超时了。

```bash
> docker exec -it clab-mtu-lab-ceos01 Cli
ceos>enable
ceos#config terminal
ceos(config)#interface Vlan10
ceos(config-if-Vl10)#mtu 1500
ceos(config-if-Vl10)#exit
ceos(config)#end
ceos#exit
> docker exec k01-worker curl -k --connect-timeout 10 https://10.10.10.10:6443/healthz
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100     2  100     2    0     0    425      0 --:--:-- --:--:-- --ok:--:--   500
```
同VXLAN之间的通信仍然可以正常运行，因为VLAN 10内的数据流量是通过第二层交换来传输的，不会经过SVI设备

#### 理解失败的原因
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VLAN SVI MTU MISMATCH                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SAME VLAN (worker → API server):                                           │
│  ┌────────────┐      L2 Switch      ┌────────────┐                          │
│  │   worker   │ ──────────────────► │    API     │                          │
│  │ VLAN 10    │    (no routing)     │   server   │                          │
│  └────────────┘                     └────────────┘                          │
│        ✅ Works - SVI MTU not involved                                      │
│                                                                             │
│  DIFFERENT VLAN (worker3 → API server):                                     │
│  ┌────────────┐    ┌─────────┐    ┌─────────┐    ┌────────────┐             │
│  │  worker3   │ ─► │ VLAN 20 │ ─► │ VLAN 10 │ ─► │    API     │             │
│  │  VLAN 20   │    │   SVI   │    │   SVI   │    │   server   │             │
│  │ MTU: 9000  │    │MTU:1500 │    │MTU:9000 │    │  VLAN 10   │             │
│  └────────────┘    └─────────┘    └─────────┘    └────────────┘             │
│        │               │                                                    │
│        │               └──► ❌ Packet dropped! (9000 > 1500)                │
│        │                                                                    │
│        └──► Sends 9000-byte packets (TLS certificate)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 为什么TLS握手会失败(Don't Fragment Bit)
由于 TCP 处理大尺寸数据包的方式，TLS/SSL 连接特别容易受到 MTU 不匹配问题的影响。

#### TCP 会设置“不要分片”位。
默认情况下，TCP 会在 IP 头部设置 DF（禁止分片）位。这意味着：
- 数据包不能被中间的路由器/交换机拆分
- 如果数据包大小超过了路径上的最大传输单元大小，那么该数据包将会被丢弃（而不会被分割成更小部分）
- 发送方依靠路径最大传输单元协议发现PMTUD来确定最正确的最大传输单元数值

#### 为什么TCP默认会使用DF字段

| Reason                  | Explanation                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| **Performance**         | Fragmentation is expensive - each fragment needs separate processing |
| **Reliability**         | If one fragment is lost, the entire packet must be retransmitted     |
| **Reassembly overhead** | The receiver must buffer and reassemble fragments                    |
| **Security**            | Fragmentation can be exploited for attacks                           |

#### TLS握手数据包的大小
在TLS握手过程中，服务器会发送其证书链。这些证书的规模可能相当大：

| TLS Message       | Typical Size           | Exceeds 1500 MTU? |
| ----------------- | ---------------------- | ----------------- |
| ClientHello       | 200-500 bytes          | No                |
| ServerHello       | 100-200 bytes          | No                |
| **Certificate**   | **2,000-10,000 bytes** | **Yes!**          |
| ServerKeyExchange | 300-500 bytes          | No                |
| Finished          | 50-100 bytes           | No                |

#### 当MTU不匹配时会发生什么

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TLS HANDSHAKE WITH MTU MISMATCH                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Client sends ClientHello (small packet) ────────────────► Server        │
│     ✅ Packet fits in MTU, delivered successfully                           │
│                                                                             │
│  2. Server sends ServerHello (small packet) ◄──────────────── Server        │
│     ✅ Packet fits in MTU, delivered successfully                           │
│                                                                             │
│  3. Server sends Certificate (LARGE packet ~4KB) ◄─────────── Server        │
│     │                                                                       │
│     │  TCP sets DF=1 (Don't Fragment)                                       │
│     │  Packet size: ~4000 bytes                                             │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────┐                                │
│  │  Router/Switch with MTU 1500            │                                │
│  │                                         │                                │
│  │  4000 bytes > 1500 MTU                  │                                │
│  │  DF=1, cannot fragment                  │                                │
│  │                                         │                                │
│  │  ❌ PACKET DROPPED!                     │                                │
│  │                                         │                                │
│  │  Should send ICMP "Fragmentation        │                                │
│  │  Needed" but often blocked by firewalls │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                             │
│  4. Client waits for Certificate... times out                               │
│     Result: "SSL connection timeout"                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 观察**Path MTU Discovery** - PMTUD
在这个实验中，我们可以观察到交换机发送的 ICMP“需要分片”消息。进行这项实验需要同时使用三台终端设备。

| Terminal       | Purpose                                                               |
| -------------- | --------------------------------------------------------------------- |
| **Terminal 1** | tcpdump on control-plane (capture ICMP messages)                      |
| **Terminal 2** | Monitor session on Arista switch (optional, for switch-level capture) |
| **Terminal 3** | Initiate curl connection from worker3                                 |

Terminal1: 在控制平面节点上，捕获类型为 3、代码为 4 的 ICMP 消息（表示“目标地址无法到达——需要分片传输”）：
```bash
> docker inspect k01-control-plane |grep Pid
            "Pid": 4058289,
            "PidMode": "",
            "PidsLimit": null,
> sudo nsenter -t 4058289 -n
[sudo] password for andrew: 
root@andrew:/home/andrew/calico-containerlab/18-mtu/tools# tcpdump -i any -nn -vv 'icmp[icmptype] == 3 and icmp[icmpcode] == 4'
tcpdump: data link type LINUX_SLL2
tcpdump: listening on any, link-type LINUX_SLL2 (Linux cooked v2), snapshot length 262144 bytes
13:24:31.651339 eth1  In  IP (tos 0xc0, ttl 64, id 21031, offset 0, flags [none], proto ICMP (1), length 576)
    172.20.20.2 > 10.10.10.10: ICMP 10.10.20.20 unreachable - need to frag (mtu 1500), length 556
        IP (tos 0x0, ttl 63, id 73, offset 0, flags [DF], proto TCP (6), length 1684)
    10.10.10.10.6443 > 10.10.20.20.43806: Flags [P.], seq 3223626700:3223628332, ack 3482232382, win 55, options [nop,nop,TS val 2492666038 ecr 1788315067], length 1632
13:24:31.857480 eth1  In  IP (tos 0xc0, ttl 64, id 21168, offset 0, flags [none], proto ICMP (1), length 576)
    172.20.20.2 > 10.10.10.10: ICMP 10.10.20.20 unreachable - need to frag (mtu 1500), length 556
        IP (tos 0x0, ttl 63, id 74, offset 0, flags [DF], proto TCP (6), length 1684)
    10.10.10.10.6443 > 10.10.20.20.43806: Flags [P.], seq 0:1632, ack 1, win 55, options [nop,nop,TS val 2492666244 ecr 1788315067], length 1632
```

- `172.20.20.2` （交换机）向 `10.10.10.10` （控制平面）发送 ICMP 消息。
- 消息： `ICMP 10.10.20.20 unreachable - need to frag (mtu 1500)`
- 原始数据包的大小为 1664 字节，且 `flags [DF]` 已被设置。
- 该交换机正在告诉服务器：“我无法转发这个数据包，因为我的最大传输单元大小仅为 1500。

Terminal2: 

```bash
> docker exec -it clab-mtu-lab-ceos01 Cli
ceos>enable
ceos#configure terminal
ceos(config)#monitor session sniff source Ethernet1 both
ceos(config)#monitor session sniff destination cpu
ceos(config)#end 
ceos#show monitor session

Session sniff 
------------------------

Sources:

Both Interfaces:        Et1

Destination Ports:

    Cpu :  active (mirror0)



ceos#bash

Arista Networks EOS shell

[root@ceos /]# tcpdump -i mirror0 -n icmp or port 6443
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on mirror0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
05:24:31.648442 00:1c:73:1b:cd:d7 > aa:c1:ab:bc:d1:60, ethertype IPv4 (0x0800), length 74: 10.10.20.20.43806 > 10.10.10.10.sun-sr-https: Flags [S], seq 3482231864, win 56760, options [mss 9460,sackOK,TS val 1788315066 ecr 0,nop,wscale 10], length 0
05:24:31.648542 aa:c1:ab:bc:d1:60 > 00:1c:73:1b:cd:d7, ethertype IPv4 (0x0800), length 74: 10.10.10.10.sun-sr-https > 10.10.20.20.43806: Flags [S.], seq 3223626699, ack 3482231865, win 56688, options [mss 9460,sackOK,TS val 2492666035 ecr 1788315066,nop,wscale 10], length 0
05:24:31.648892 00:1c:73:1b:cd:d7 > aa:c1:ab:bc:d1:60, ethertype IPv4 (0x0800), length 66: 10.10.20.20.43806 > 10.10.10.10.sun-sr-https: Flags [.], ack 1, win 56, options [nop,nop,TS val 1788315066 ecr 2492666035], length 0
05:24:31.650111 00:1c:73:1b:cd:d7 > aa:c1:ab:bc:d1:60, ethertype IPv4 (0x0800), length 583: 10.10.20.20.43806 > 10.10.10.10.sun-sr-https: Flags [P.], seq 1:518, ack 1, win 56, options [nop,nop,TS val 1788315067 ecr 2492666035], length 517
05:24:31.650180 aa:c1:ab:bc:d1:60 > 00:1c:73:1b:cd:d7, ethertype IPv4 (0x0800), length 66: 10.10.10.10.sun-sr-https > 10.10.20.20.43806: Flags [.], ack 518, win 55, options [nop,nop,TS val 2492666037 ecr 1788315067], length 0
05:24:31.651111 aa:c1:ab:bc:d1:60 > 00:1c:73:1b:cd:d7, ethertype IPv4 (0x0800), length 1698: 10.10.10.10.sun-sr-https > 10.10.20.20.43806: Flags [P.], seq 1:1633, ack 518, win 55, options [nop,nop,TS val 2492666038 ecr 1788315067], length 1632
05:24:31.651320 00:1c:73:1b:cd:d7 > aa:c1:ab:bc:d1:60, ethertype 802.1Q (0x8100), length 594: vlan 10, p 0, ethertype IPv4 (0x0800), 172.20.20.2 > 10.10.10.10: ICMP 10.10.20.20 unreachable - need to frag (mtu 1500), length 556

```

Terminal3: 

```bash
docker exec k01-worker3 curl -k --connect-timeout 10 https://10.10.10.10:6443/healthz
```
操作会超时，但请继续关注终端 1 和终端 2 中的输出信息。



#### 可选验证
验证TCP数据中是否设置了 `Don't Fragment` 位置
```bash
docker exec k01-control-plane tcpdump -i eth1 host 10.10.20.20 -vv | grep -E 'DF|length'
```
这将显示不要分片标志和数据包的长度，或者为了更加简洁的显示效果，可以将两者显示在同一行

#### 清理操作
**清理操作：禁用监控会话（非常重要！）**

```bash
docker exec -it clab-mtu-lab-ceos01 Cli
```

```bash
enable
configure terminal
no monitor session sniff
end
```

### 为什么PMTUD会失效：反向路径过滤机制(RPF) Reverse Path Filtering
尽管交换机确实发送了 ICMP“需要分片”的消息，但 TLS 握手过程仍然失败了。为什么会这样呢？
**隐藏的罪魁祸首：RPF 机制导致了 ICMP 消息的丢失**

仔细查看 ICMP 消息的来源：
```bash
172.20.20.2 > 10.10.10.10: ICMP 10.10.20.20 unreachable - need to frag (mtu 1500)
```
该 ICMP 消息来自 `172.20.20.2` ——也就是 Arista 交换机的管理接口，而非 `10.10.20.20` （即消息的原始目的地）

Linux 默认启用了反向路径过滤功能。该功能会检查进入数据包的源 IP 地址是否可以通过同一接口再发送出去。由于 `172.20.20.2` 无法通过 `eth1` 访问（它们位于不同的网络中），因此该 ICMP 数据包会被直接丢弃！

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Why ICMP Messages Are Dropped                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   API Server (10.10.10.10) sends packet to worker3 (10.10.20.20)            │
│                                                                             │
│   Switch (VLAN 20 SVI) drops packet, sends ICMP "need to frag"              │
│   Source IP of ICMP: 172.20.20.2 (switch management IP)                     │
│                                                                             │
│   API Server receives ICMP on eth1:                                         │
│   - eth1 has route to 10.10.0.0/16                                          │
│   - 172.20.20.2 is NOT routable via eth1                                    │
│   - RPF check FAILS                                                         │
│   - ❌ ICMP packet DROPPED silently                                         │
│                                                                             │
│   Result: PMTUD never learns the correct MTU                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

验证RPF是否正在丢弃数据包
请检查当前的RPF设置
```bash
> docker exec k01-control-plane sysctl net.ipv4.conf.all.rp_filter
net.ipv4.conf.all.rp_filter = 1
```
值为1表示严格模式 -- 如果通过该接口无法访问源IP地址，那么相关数据包将会被丢弃。

### 修复 PMTUD 问题：禁用严格的 RPF 机制
将 RPF 设置为“宽松模式”（值为 `2` ），该模式下，系统仅检查源 IP 是否可以通过任意接口进行路由传输。
```bash
> docker exec k01-control-plane sysctl -w net.ipv4.conf.all.rp_filter=2
net.ipv4.conf.all.rp_filter = 2
```

> 安全警告：在生产环境中，不建议将 `rp_filter=2` 设置为“宽松模式”。宽松的 RPF 机制会削弱对 IP 欺骗攻击的防御能力。此处设置该模式仅用于演示：当 ICMP 消息未被阻止时，PMTUD 机制是如何工作的。
> **正确的解决方案是在所有网络层中正确配置 MTU 值，而不是削弱安全设置。**


### 确认 PMTUD 功能现已正常运行
**Terminal 1: Monitor MSS Negotiation**
该终端负责监控在 TCP 连接建立过程中，最大段大小(MSS)的协商过程。
什么是 MSS？MSS（最大段大小）是 TCP 协议中的一个参数，用于指定设备在单个 TCP 数据段中可以接收的最大数据量。该数值不包含 TCP 和 IP 头部信息，仅代表有效数据部分的大小。
**MSS 谈判流程：**
- MSS 是在 TCP 的三次握手过程中协商确定的（SYN、SYN-ACK、ACK 阶段）。
- 每个端点都会在 SYN 和 SYN-ACK 数据包中声明自己的 MSS 值。
- 双方都会选择在所公布的两个 MSS 值中较小的那个值来用于此次连接。
- MSS 的计算公式通常为：MTU - IP 头部长度（20 字节）- TCP 头部长度（20 字节）
- 例如：当 MTU 为 1500 字节时，MSS 则为 1460 字节（1500 - 20 - 20）。
- 这种协商机制能够确保数据包的大小不会超过路径上的最大传输单元大小，从而避免数据包被拆分。

```bash
docker exec k01-control-plane tcpdump -i eth1 host 10.10.20.20 -vv | grep mss
```

**Terminal 2: Trigger Connection from worker3**

```bash
docker exec k01-worker3 curl -k --connect-timeout 10 https://10.10.10.10:6443/healthz
```

**Terminal 1 Expected Output**

```bash
ip-10-10-20-20.ec2.internal.34458 > ip-10-10-10-10.ec2.internal.6443: Flags [S], ... options [mss 8960,...], length 0 ip-10-10-10-10.ec2.internal.6443 > ip-10-10-20-20.ec2.internal.34458: Flags [S.], ... options [mss 1460,...], length 0
```
- 客户端（worker3）使用其 9000 MTU 的接口，发送带有 `mss 8960` 标记的 SYN 包。
- 服务器（API 服务器）返回的响应为 `mss 1460` （该数值会根据缓存中的 PMTU 值进行调整！）
服务器从 ICMP 消息中获取了正确的路径 MTU 值，现在它所公布的 MSS 值更小了。连接成功了！


**Terminal 2 Expected Output**

```bash
ok
```

**验证路由表中的 PMTU 缓存信息**

你还可以通过查看路由表来验证缓存中的 PMTU 值：

```bash
docker exec k01-control-plane ip route get 10.10.20.20
10.10.20.20 via 10.10.10.1 dev eth1 src 10.10.10.10 uid 0 cache expires 192sec mtu 1500
```

关键观察：现在，路由缓存中显示的目标地址 `10.10.20.20` 对应的值为 `mtu 1500` 。这一数值实际上是 PMTUD 从 ICMP“需要分片”消息中获取的路径最大传输单元值。TCP 堆栈会利用这个缓存值来计算未来连接的 MSS 值。

### 这个过程发生了什么 
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PMTUD Success with Loose RPF                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. Previous connection attempt failed (packets too large)                 │
│                                                                             │
│   2. Switch sent ICMP "need to frag (mtu 1500)" from 172.20.20.2            │
│                                                                             │
│   3. With rp_filter=2 (loose mode):                                         │
│      - 172.20.20.2 IS routable (via default route or management network)    │
│      - RPF check PASSES                                                     │
│      - ✅ ICMP packet ACCEPTED                                              │
│                                                                             │
│   4. Linux TCP stack caches the PMTU (1500) for destination 10.10.20.0/24   │
│                                                                             │
│   5. Next connection: Server advertises MSS=1460 (1500 - 40 bytes headers)  │
│                                                                             │
│   6. All packets fit within 1500 MTU - connection succeeds!                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**RPF Modes Explained**

| Value | Mode | Behavior | Production Use |
|-------|------|----------|----------------|
| `0` | Disabled | No source validation | ❌ Insecure - allows IP spoofing |
| `1` | Strict | Source must be reachable via incoming interface | ✅ Recommended (default) |
| `2` | Loose | Source must be reachable via ANY interface | ⚠️ Not recommended - weakens spoofing protection |
### 将 RPF 模式重置为“严格模式”（推荐）

演示结束后，为确保安全，请恢复严格的 RPF 模式：

```bash
docker exec k01-control-plane sysctl -w net.ipv4.conf.all.rp_filter=1
```

| Issue                           | Impact                              |
| ------------------------------- | ----------------------------------- |
| **MTU mismatch**                | Large packets dropped at bottleneck |
| **ICMP from unexpected source** | RPF drops PMTUD messages            |
| **Silent failures**             | No error, just timeouts             |

- 从一开始正确配置MTU值，这是唯一可靠的解决方案
- 不要依赖PMTUD机制 - 由于各种原因(如RPF机制、防火墙等)，该机制可能会在毫无征兆的情况下失效
- 切勿在正式环境中使用未加密的 RPF 协议——这会削弱系统对 IP 欺骗攻击的防御能力。
- ICMP 消息的源 IP 地址很重要——网络设备可能会通过管理接口发送 ICMP 消息，从而破坏 PMTUD 机制。

### 修复措施：将VLAN20的MTU值恢复为 9000
现在，让我们通过将 VLAN 20 的 MTU 值恢复为 9000 来解决根本问题：

```bash
docker exec -it clab-mtu-lab-ceos01 Cli
configure terminal 
interface Vlan20 
mtu 9000 
exit 
end
exit
```

验证是否生效
```bash
docker exec k01-worker3 curl -k --connect-timeout 10 https://10.10.10.10:6443/healthz
```

| VLAN 20 MTU          | RPF Mode   | Worker3 → API Server | Result                                               |
| -------------------- | ---------- | -------------------- | ---------------------------------------------------- |
| 9000 (matches hosts) | Any        | ✅ Works              | TLS handshake succeeds                               |
| 1500 (mismatch)      | Strict (1) | ❌ Fails              | SSL timeout - PMTUD blocked by RPF                   |
| 1500 (mismatch)      | Loose (2)  | ✅ Works              | PMTUD succeeds, MSS adjusted (⚠️ not for production) |
- 正确配置 MTU 值——网络基础设施的 MTU 值必须与主机/容器的 MTU 值相等或更高。
- 不要依赖 PMTUD 机制——由于 RPF 机制、防火墙的阻挡，或是来自意外来源的 ICMP 消息，该机制可能会在毫无征兆的情况下失效。
- 在生产环境中绝不要使用未封装的 RPF 数据包——虽然 `rp_filter=2` 机制有助于 PMTUD 功能的正常运行，但它会削弱系统对 IP 欺骗攻击的防御能力。

## 总结

### Calico MTU配置
- Calico 默认为 Pod 接口设置 1450 的 MTU 值。
- 对于使用巨型帧的环境，必须在“安装”选项中配置 MTU 值。
-  公式： `Pod MTU = Physical MTU - Encapsulation Overhead`
- 对于MTU值为 9000 的网络：9000 - 50 = 8950

### 网络基础设施的MTU
- VLAN SVI MTU 参数会影响子网之间的路由传输（L3 层流量）
- 同 VLAN 内的流量在链路层进行交换，同时会绕过 SVI 的 MTU 限制。
- 所有层级都必须保持一致的 MTU 值：从 Pod 到 Host，再到网络。


### PMTUD 与反向路径过滤技术（RPF）
- PMTUD 依赖于 ICMP 中的“需要分片”消息来正常工作。
- 网络设备可能会从管理接口发送 ICMP 消息，而非发送给原始目的地。
- Linux 的 RPF 功能（反向路径过滤）可能会丢弃来自意外来源 IP 的 ICMP 数据包。
- 宽松的 RPF 模式（ `rp_filter=2` ）允许 PMTUD 机制正常工作，但不建议在正式环境中使用（该模式会削弱对 IP 欺骗行为的防护能力）。
- 不要依赖 PMTUD 机制——从一开始就正确配置 MTU 值。这才是唯一可靠的解决方案。

###  常见的 MTU 设置

| Environment | Physical MTU | Calico MTU | Pod Interface |
|-------------|--------------|------------|---------------|
| Standard | 1500 | Not set | 1450 (default) |
| Standard + VXLAN | 1500 | 1450 | 1450 |
| Jumbo Frames | 9000 | 8950 | 8950 |
| Jumbo + VXLAN | 9000 | 8950 | 8950 |

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| `message too long, mtu=1450` | Calico MTU not configured | Set MTU in Installation resource |
| Large pings fail, small work | MTU mismatch somewhere | Check all MTU values |
| Cross-VLAN TLS timeout | VLAN SVI MTU too low | Increase VLAN interface MTU |
| kubectl exec hangs | MTU affecting API traffic | Check inter-VLAN MTU |
| PMTUD not working | RPF dropping ICMP | Set `rp_filter=2` (loose mode) |
| ICMP "need to frag" ignored | ICMP from unexpected source IP | Check ICMP source, adjust RPF |

### RPF Debugging Commands

```bash
# Check current RPF setting
sysctl net.ipv4.conf.all.rp_filter

# Set loose mode (allows ICMP from any routable source)
sysctl -w net.ipv4.conf.all.rp_filter=2

# Capture ICMP "Fragmentation Needed" messages
tcpdump -i any -nn -vv 'icmp[icmptype] == 3 and icmp[icmpcode] == 4'

# Monitor MSS negotiation
tcpdump -i eth1 host <destination> -vv | grep mss
```















