## Calico Pod Routing
在kubernetes中，Pod需要在整个集群范围内进行无缝通信，但这带来了独特的网络挑战，需要复杂的路由解决方案来应对这些挑战，Pod路由在多种关键场景中至关重要。


## Pod-to-Pod 在同一节点内的通信
即使Pod位于同一个物理节点上，它们仍然运行在独立的网络命名空间中，因此需要正确的路由配置来支持它们之间的通信。
- 每个Pod都有自己独立的网络命名空间，拥有/32地址。它们无法直接通过ARP协议与其他的Pod的IP地址进行通信，因此流量必须通过主机进行转发。
- 确定性主机路由（169.254.1.1）：Calico会根据每个Pod的需求来配置路由，并使用统一的link-local next hop方式将Veth对连接起来。这种方式能够消除L2 broadcast/ARP的干扰，从而确保可观测的可达性。
- Central Enforcement & visibility: 通过主机进行路由处理，可以实现Networkpolicy政策的执行，包括对contrack/stateful inspection 功能的支持，同时还能获取相关指标数据，并且能够快速更新路由的生命周期。即便是针对节点内部的流量，也能实现这样的处理。

## Pod-to-Pod 在不同Node间的通讯
跨节点Pod之间的通信会引入额外的复杂性，需要整个集群范围的路由协调工作：
- Smarter Routing with Node Blocks: Calico 为每个节点分配自己的IP块（例如/26子网），而不是需要公告每个Pod的IP。这样，Pod的启动和停止就不会导致网络被频繁的更新，只有块的变化才会被考虑。这种方法使得路由更加稳定、快速，并且在扩展、卸载或移动Pod时避免了出现路由空洞的情况。
- 保留Pod身份（无需SNAT）: 在节点之间保持原始的Pod IP地址，这样可以确保NetworkPolicy、可观测性以及服务负载均衡决策的准确性和一致性。
- 高效性、可观测的流量分配：通过对每个节点进行路由处理，Calico避免了不必要的隧道传输，节省了MTU空间，并采用了ECMP算法来确保路径的均衡性。这样的设计能够减低延迟、减少开销，并保障节点间的稳定性能。
Calico 通过提供全面的路由解决方案来应对这些挑战，该方案能够高效地处理节点内核节点间的路由问题。

> ECMP：多条等价路径，避免单跳瓶颈


## 环境搭建
### 启动两个daemonSet类型服务-用于网络连通性测试
这次环境依然使用IPAM中的环境，不过增加一个multitool用来进行网络连接性测试
`multitool-1.yaml` - 用于网络连接性测试
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: multitool-1
  namespace: default
  labels:
    app: multitool-1
spec:
  selector:
    matchLabels:
      app: multitool-1
  template:
    metadata:
      labels:
        app: multitool-1
    spec:
      containers:
      - name: multitool
        image: praqma/network-multitool:latest
        ports:
        - containerPort: 80
          name: http
        - containerPort: 443
          name: https
        env:
        - name: HTTP_PORT
          value: "80"
        - name: HTTPS_PORT
          value: "443"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        command:
        - /bin/bash
        - -c
        - |
          echo "Multitool-1 pod started on node: $HOSTNAME"
          echo "Available tools: curl, wget, nslookup, dig, ping, traceroute, netstat, ss, iperf3, tcpdump"
          echo "Pod IP: $(hostname -i)"
          echo "Node: $(cat /proc/sys/kernel/hostname)"
          nginx -g "daemon off;"
      restartPolicy: Always
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
---
apiVersion: v1
kind: Service
metadata:
  name: multitool-1-service
  namespace: default
  labels:
    app: multitool-1
spec:
  selector:
    app: multitool-1
  ports:
  - name: http
    port: 80
    targetPort: 80
    protocol: TCP
  - name: https
    port: 443
    targetPort: 443
    protocol: TCP
  type: ClusterIP
```

`multitool-2.yaml` - 用于网络连接性测试
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: multitool-2
  namespace: default
  labels:
    app: multitool-2
spec:
  selector:
    matchLabels:
      app: multitool-2
  template:
    metadata:
      labels:
        app: multitool-2
    spec:
      containers:
      - name: multitool
        image: praqma/network-multitool:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 8443
          name: https
        env:
        - name: HTTP_PORT
          value: "8080"
        - name: HTTPS_PORT
          value: "8443"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        command:
        - /bin/bash
        - -c
        - |
          echo "Multitool-2 pod started on node: $HOSTNAME"
          echo "Available tools: curl, wget, nslookup, dig, ping, traceroute, netstat, ss, iperf3, tcpdump"
          echo "Pod IP: $(hostname -i)"
          echo "Node: $(cat /proc/sys/kernel/hostname)"
          nginx -g "daemon off;"
      restartPolicy: Always
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
---
apiVersion: v1
kind: Service
metadata:
  name: multitool-2-service
  namespace: default
  labels:
    app: multitool-2
spec:
  selector:
    app: multitool-2
  ports:
  - name: http
    port: 8080
    targetPort: 8080
    protocol: TCP
  - name: https
    port: 8443
    targetPort: 8443
    protocol: TCP
  type: ClusterIP
```

## 确认集群环境信息
检查ContainerLab拓扑状态，以确保集群已准备就绪
这里复用的是 `calico-ipam.clab.yaml` 因此环境状态也是和IPAM中的ContainerLab网络拓扑保持了一致
```bash
master ✗ $ containerlab inspect -t calico-ipam.clab.yaml 
10:29:08 INFO Parsing & checking topology file=calico-ipam.clab.yaml
╭───────────────────────────┬──────────────────────┬─────────┬───────────────────────╮
│            Name           │      Kind/Image      │  State  │     IPv4/6 Address    │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ calico-ipam-control-plane │ k8s-kind             │ running │ 192.168.48.3          │
│                           │ kindest/node:v1.28.0 │         │ fc00:f853:ccd:e793::3 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ calico-ipam-worker        │ k8s-kind             │ running │ 192.168.48.2          │
│                           │ kindest/node:v1.28.0 │         │ fc00:f853:ccd:e793::2 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ calico-ipam-worker2       │ k8s-kind             │ running │ 192.168.48.4          │
│                           │ kindest/node:v1.28.0 │         │ fc00:f853:ccd:e793::4 │
╰───────────────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

该输出结果显示了 ContainerLab 的拓扑结构状态，其中包括三个在 Docker 容器中运行的 Kubernetes 节点。所有节点都处于“运行”状态，它们分配的 IPv4 和 IPv6 地址都在 Docker 桥接网络类型Kind（192.168.48.0/20）内。

```bash
master ✗ $ docker network inspect kind|grep Subnet
                    "Subnet": "fc00:f853:ccd:e793::/64"
                    "Subnet": "192.168.48.0/20",
```

```bash
宿主机
 ├─ docker0 (172.17.0.0/16)        ← Docker 默认桥
 │    └─ buildkit 容器
 │
 ├─ kind 网络 (192.168.48.0/24)    ← Kind 给“虚拟机/节点”用的
 │    ├─ calico-ipam-control-plane (192.168.48.3)
 │    ├─ calico-ipam-worker        (192.168.48.2)
 │    └─ calico-ipam-worker2       (192.168.48.4)
 │
 └─ containerlab mgmt 网络（你之前改的 172.17.0.0/16 或类似）
      └─ clab 管理器 / 外部可达入口
```

### 检查集群状态
```bash
master ✗ $ kubectl get nodes -o wide 
NAME                        STATUS   ROLES           AGE   VERSION   INTERNAL-IP    EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION      CONTAINER-RUNTIME
calico-ipam-control-plane   Ready    control-plane   23h   v1.28.0   192.168.48.3   <none>        Debian GNU/Linux 11 (bullseye)   6.17.0-35-generic   containerd://1.7.1
calico-ipam-worker          Ready    <none>          23h   v1.28.0   192.168.48.2   <none>        Debian GNU/Linux 11 (bullseye)   6.17.0-35-generic   containerd://1.7.1
calico-ipam-worker2         Ready    <none>          23h   v1.28.0   192.168.48.4   <none>        Debian GNU/Linux 11 (bullseye)   6.17.0-35-generic   containerd://1.7.1
```
三个kubernetes节点全部处于就绪状态，正在运行v1.28.0版本的kubernetes。这确定了集群是健康的，并且可以用于测试Pod的路由功能。

### 确保多实例用于测试的Daemonset正在运行
DaemonSets（multitool-1和multitool-2）都在运行，每个节点上都对应着一个容器，这些容器从各自节点的IP地址块中获取唯一的IP地址。
```bash
master ✗ $ kubectl get pods -o wide  
NAME                READY   STATUS    RESTARTS   AGE   IP                NODE                        NOMINATED NODE   READINESS GATES
multitool-1-h5z55   1/1     Running   0          35m   192.168.112.131   calico-ipam-worker2         <none>           <none>
multitool-1-hnkl4   1/1     Running   0          35m   192.168.131.131   calico-ipam-worker          <none>           <none>
multitool-1-nh4qg   1/1     Running   0          35m   192.168.18.73     calico-ipam-control-plane   <none>           <none>
multitool-2-6jbdt   1/1     Running   0          35m   192.168.131.132   calico-ipam-worker          <none>           <none>
multitool-2-jql6b   1/1     Running   0          35m   192.168.18.72     calico-ipam-control-plane   <none>           <none>
multitool-2-zlm2k   1/1     Running   0          35m   192.168.112.130   calico-ipam-worker2         <none>           <none>
```

## 检查同节点内Pod-to-Pod之间的通信情况

### 进入到`multitool-1-h5z55` 查看网络信息
检查IP地址
```bash
master ✗ $ kubectl exec -it multitool-1-h5z55 -- sh         
/ # ip addr 
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: eth0@if8: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP group default qlen 1000
    link/ether 0e:eb:42:cc:24:01 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 192.168.112.131/32 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::ceb:42ff:fecc:2401/64 scope link 
       valid_lft forever preferred_lft forever
```

### 检查路由表
```bash
/ # ip route 
default via 169.254.1.1 dev eth0 
169.254.1.1 dev eth0 scope link 
```
- 默认路由：所有流量都通过eth0接口，访问地址为 169.254.1.1
- 169.254.1.1： Calico的虚拟下一跳IP地址（link-local address）
- scope link: next-hop 可以在同一网段上直接访问到
- Calico方法：在所有节点之间使用统一的next-hop Ip地址，从而简化了路由过程。

### 在同一节点上ping另一个Pod
`multitool-2-zlm2k` 也在节点 `calico-ipam-worker2` 上，ip地址为 `192.168.112.130`
```bash
/ # ping 192.168.112.130
PING 192.168.112.130 (192.168.112.130) 56(84) bytes of data.
64 bytes from 192.168.112.130: icmp_seq=1 ttl=63 time=0.096 ms
64 bytes from 192.168.112.130: icmp_seq=2 ttl=63 time=0.029 ms
64 bytes from 192.168.112.130: icmp_seq=3 ttl=63 time=0.033 ms
64 bytes from 192.168.112.130: icmp_seq=4 ttl=63 time=0.035 ms
^C
--- 192.168.112.130 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3082ms
rtt min/avg/max/mdev = 0.029/0.048/0.096/0.027 ms
/ # 
```
从输出可以看出，在同一节点上，实现了Pod-to-Pod的成功通信， TTL值为63，表示数据包在通过主机的路由层时只进行了一次转发（从原始的64跳数中减去一次转发）。

如果Ping自己，TTL跳数就不会减少
```bash
/ # ping 192.168.112.131
PING 192.168.112.131 (192.168.112.131) 56(84) bytes of data.
64 bytes from 192.168.112.131: icmp_seq=1 ttl=64 time=0.018 ms
64 bytes from 192.168.112.131: icmp_seq=2 ttl=64 time=0.026 ms
^C
--- 192.168.112.131 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1025ms
rtt min/avg/max/mdev = 0.018/0.022/0.026/0.004 ms
```

### 连接主机节点查看路由
```bash
# 连接到对应的node节点
master ✗ $ docker exec -it calico-ipam-worker2 sh 
# 查看路由信息
# ip route 
default via 192.168.48.1 dev eth0 
192.168.18.64 via 192.168.48.3 dev eth0 proto 80 onlink 
192.168.18.64/26 via 192.168.48.3 dev eth0 proto 80 onlink 
192.168.48.0/20 dev eth0 proto kernel scope link src 192.168.48.4 
blackhole 192.168.112.128/26 proto 80 
192.168.112.129 dev califc3d9c0f7ff scope link 
192.168.112.130 dev cali04e25a980e8 scope link 
192.168.112.131 dev calidd4df715692 scope link 
192.168.131.128 via 192.168.48.2 dev eth0 proto 80 onlink 
192.168.131.128/26 via 192.168.48.2 dev eth0 proto 80 onlink 
# ip route |grep 192.168.112.130
192.168.112.130 dev cali04e25a980e8 scope link 
```
可以看到，在node上直接通过Calico Veth 接口 `cali04e25a980e8` 直接连接到Pod的IP地址  `192.168.112.130`，这种方式可以实现Node内的Pod通讯，而无需网关。

### 到multitool-2抓包查看
在 `multitool-1` 上 ping 同节点上的`multitool-2` 的Pod，并在 `multitool-2` 上抓包查看数据交互
```bash
master ✗ $ kubectl exec -it multitool-1-h5z55 -- sh                                                                                              1 ↵
/ # ping  192.168.112.130
PING 192.168.112.130 (192.168.112.130) 56(84) bytes of data.
64 bytes from 192.168.112.130: icmp_seq=1 ttl=63 time=0.058 ms
64 bytes from 192.168.112.130: icmp_seq=2 ttl=63 time=0.048 ms
64 bytes from 192.168.112.130: icmp_seq=3 ttl=63 time=0.072 ms
64 bytes from 192.168.112.130: icmp_seq=4 ttl=63 time=0.035 ms
64 bytes from 192.168.112.130: icmp_seq=5 ttl=63 time=0.038 ms
64 bytes from 192.168.112.130: icmp_seq=6 ttl=63 time=0.048 ms
```

```bash
andrew•~» kubectl exec -it  multitool-2-zlm2k -- sh                                                                     [11:28:49]
/ # tcpdump -n 
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
03:30:28.966531 IP 192.168.112.131 > 192.168.112.130: ICMP echo request, id 34, seq 1, length 64
03:30:28.966541 IP 192.168.112.130 > 192.168.112.131: ICMP echo reply, id 34, seq 1, length 64
03:30:29.990335 IP 192.168.112.131 > 192.168.112.130: ICMP echo request, id 34, seq 2, length 64
03:30:29.990346 IP 192.168.112.130 > 192.168.112.131: ICMP echo reply, id 34, seq 2, length 64
03:30:31.014305 IP 192.168.112.131 > 192.168.112.130: ICMP echo request, id 34, seq 3, length 64
03:30:31.014314 IP 192.168.112.130 > 192.168.112.131: ICMP echo reply, id 34, seq 3, length 64
03:30:32.038256 IP 192.168.112.131 > 192.168.112.130: ICMP echo request, id 34, seq 4, length 64
03:30:32.038264 IP 192.168.112.130 > 192.168.112.131: ICMP echo reply, id 34, seq 4, length 64
03:30:33.062258 IP 192.168.112.131 > 192.168.112.130: ICMP echo request, id 34, seq 5, length 64
03:30:33.062267 IP 192.168.112.130 > 192.168.112.131: ICMP echo reply, id 34, seq 5, length 64
03:30:34.086262 IP 192.168.112.131 > 192.168.112.130: ICMP echo request, id 34, seq 6, length 64
03:30:34.086275 IP 192.168.112.130 > 192.168.112.131: ICMP echo reply, id 34, seq 6, length 64
03:30:34.342265 ARP, Request who-has 169.254.1.1 tell 192.168.112.130, length 28
03:30:34.342277 ARP, Request who-has 192.168.112.130 tell 192.168.48.4, length 28
03:30:34.342320 ARP, Reply 192.168.112.130 is-at fe:cb:86:b3:c6:49, length 28
03:30:34.342319 ARP, Reply 169.254.1.1 is-at ee:ee:ee:ee:ee:ee, length 28
^C
16 packets captured
16 packets received by filter
0 packets dropped by kernel
```

这个tcpdump输出结果显示了同一个Node上两个Pod之间的双向ICMP流量：
- Source Pod(192.168.112.131) 向 Destination Pod(192.168.112.130) 发送echo请求
- Immediate Replies: 每个请求都得到了及时回复（时间精确到了微妙级别），这确保了节点内部的高效通信。
- Ping流：这里的 id 34 只有34说明抓包期间只有一个ping进程。
- 相同CIDR块：这两个IP地址来自同一个节点的 192.168.112.128/26 子网，这说明这是同一台服务器上的Pod在进行通信。
- 无需NAT封装处理：原始Pod的IP地址被保留了下来，这表明Calico可以直接进行路由转发，而无需通过隧道传输来节省开销。

第二个Pod multitool-2-zlm2k(multitool-2)的IP地址为192.168.112.130/32，该地址位于eth0接口上。这个IP地址同样属于同一个CIDR块（192.168.112.128/26），这说明这两个Pod位于同一个工作节点上。

![[Pasted image 20260924112433.png]]

```bash
master ✗ $ kubectl get blockaffinities -o yaml
apiVersion: v1
items:
- apiVersion: projectcalico.org/v3
  kind: BlockAffinity
  metadata:
    creationTimestamp: "2026-09-23T04:00:09Z"
    name: calico-ipam-control-plane-192-168-18-64-26
    resourceVersion: "4698"
    uid: a4c00304-a475-4212-a05d-6f390e886ed5
  spec:
    cidr: 192.168.18.64/26
    node: calico-ipam-control-plane
    state: confirmed
- apiVersion: projectcalico.org/v3
  kind: BlockAffinity
  metadata:
    creationTimestamp: "2026-09-23T04:03:36Z"
    name: calico-ipam-worker-192-168-131-128-26
    resourceVersion: "5163"
    uid: e5227720-b462-4482-97b9-c016e1dc1d5e
  spec:
    cidr: 192.168.131.128/26
    node: calico-ipam-worker
    state: confirmed
- apiVersion: projectcalico.org/v3
  kind: BlockAffinity
  metadata:
    creationTimestamp: "2026-09-23T04:06:00Z"
    name: calico-ipam-worker2-192-168-112-128-26
    resourceVersion: "5474"
    uid: 35c56f39-4eff-4b2e-b825-02e92bb24077
  spec:
    cidr: 192.168.112.128/26
    node: calico-ipam-worker2
    state: confirmed
kind: List
metadata:
  resourceVersion: ""
andrew@andrew:~/k8-networking-calico-containerlab/containerlab/01-calico-ipam 
master ✗ $ kubectl get pod -o wide            
NAME                READY   STATUS    RESTARTS   AGE    IP                NODE                        NOMINATED NODE   READINESS GATES
multitool-1-h5z55   1/1     Running   0          115m   192.168.112.131   calico-ipam-worker2         <none>           <none>
multitool-1-hnkl4   1/1     Running   0          115m   192.168.131.131   calico-ipam-worker          <none>           <none>
multitool-1-nh4qg   1/1     Running   0          115m   192.168.18.73     calico-ipam-control-plane   <none>           <none>
multitool-2-6jbdt   1/1     Running   0          115m   192.168.131.132   calico-ipam-worker          <none>           <none>
multitool-2-jql6b   1/1     Running   0          115m   192.168.18.72     calico-ipam-control-plane   <none>           <none>
multitool-2-zlm2k   1/1     Running   0          115m   192.168.112.130   calico-ipam-worker2         <none>           <none>
andrew@andrew:~/k8-networking-calico-containerlab/containerlab/01-calico-ipam 
```


## 检查不同Node之间Pod-to-Pod之间的通信
`multitool-1-h5z55` 的IP `192.168.112.131` 位于节点  `calico-ipam-worker2` 上
`multitool-1-hnkl4` 的IP `192.168.131.131` 位于节点 `calico-ipam-worker` 上
两个Pod进行通信属于跨节点进行通信。
```bash
master ✗ $ kubectl get pod -o wide 
NAME                READY   STATUS    RESTARTS   AGE    IP                NODE                        NOMINATED NODE   READINESS GATES
multitool-1-h5z55   1/1     Running   0          3h3m   192.168.112.131   calico-ipam-worker2         <none>           <none>
multitool-1-hnkl4   1/1     Running   0          3h3m   192.168.131.131   calico-ipam-worker          <none>           <none>
multitool-1-nh4qg   1/1     Running   0          3h3m   192.168.18.73     calico-ipam-control-plane   <none>           <none>
multitool-2-6jbdt   1/1     Running   0          3h3m   192.168.131.132   calico-ipam-worker          <none>           <none>
multitool-2-jql6b   1/1     Running   0          3h3m   192.168.18.72     calico-ipam-control-plane   <none>           <none>
multitool-2-zlm2k   1/1     Running   0          3h3m   192.168.112.130   calico-ipam-worker2         <none>           <none>

master ✗ $ kubectl exec -it multitool-1-h5z55 -- sh                 
/ # ping 192.168.131.131
PING 192.168.131.131 (192.168.131.131) 56(84) bytes of data.
64 bytes from 192.168.131.131: icmp_seq=1 ttl=62 time=0.083 ms
64 bytes from 192.168.131.131: icmp_seq=2 ttl=62 time=0.054 ms
64 bytes from 192.168.131.131: icmp_seq=3 ttl=62 time=0.072 ms
^C
--- 192.168.131.131 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2028ms
rtt min/avg/max/mdev = 0.054/0.069/0.083/0.011 ms
```

该输出表明在不同节点之间实现了成功的节点间通信。TTL值为62，表示数据包经过了次路由转发(先通过原节点的路由层，然后穿过网桥到达目标节点)。

### 连接到源容器所在的主机节点 - 即 `calico-ipam-worker2`

```bash
master ✗ $ docker exec -it calico-ipam-worker2 sh                  
# ip route get 192.168.131.131
192.168.131.131 via 192.168.48.2 dev eth0 src 192.168.48.4 uid 0 
    cache 
```
- `via 192.168.48.2`: 通过这个地址进行通信时，所有通往目标Pod的流量都会通过这个网关进行路由（该网关节点为 calico-ipam-worker，IP为 192.168.131.131的Pod就在这个node上）
- `dev eth0`: 流量通过eth0接口输出
- 源地址： 192.168.48.2路由表中显示的是主机使用的源IP地址，而不是容器实际用于传输数据的IP地址，容器使用的是自己的真实IP地址(`192.168.112.131`)作为传输源。当容器与集群外的外部网络进行通信时，才会发生源地址转换（SNAT），此时节点的IP地址会替代容器的IP地址用于出站通信。而在集群内部进行容器之间的通信时，不会发生SNAT，容器仍然使用原来的IP地址。
- cache: 此路由已缓存以提升性能表现

### 连接到目标Pod所在的宿主机节点 `calico-ipam-worker`
```bash
master ✗ $ docker exec -it calico-ipam-worker sh 
# ip route | grep 192.168.131.131
192.168.131.131 dev cali3f95003a94f scope link 
# ip route get 192.168.131.131
192.168.131.131 dev cali3f95003a94f src 192.168.48.2 uid 0 
    cache 
# 
```
- `192.168.131.131`: 目标Pod的IP
- `dev cali3f95003a94f`: 流量直接被路由到该Pod的calico Veth接口上
- scope link: 该目标在本地网络中可以直接访问，无需通过网关
- Local delivery: 与跨节点路由不同，本地Pod可以通过他们的veth接口直接访问


### 分析目标节点上的跨节点流量
```bash
/ # tcpdump -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
10:44:42.255732 IP 192.168.112.131 > 192.168.131.131: ICMP echo request, id 48, seq 1, length 64
10:44:42.255741 IP 192.168.131.131 > 192.168.112.131: ICMP echo reply, id 48, seq 1, length 64
10:44:43.302254 IP 192.168.112.131 > 192.168.131.131: ICMP echo request, id 48, seq 2, length 64
10:44:43.302263 IP 192.168.131.131 > 192.168.112.131: ICMP echo reply, id 48, seq 2, length 64
10:44:44.326328 IP 192.168.112.131 > 192.168.131.131: ICMP echo request, id 48, seq 3, length 64
10:44:44.326336 IP 192.168.131.131 > 192.168.112.131: ICMP echo reply, id 48, seq 3, length 64
10:44:45.350278 IP 192.168.112.131 > 192.168.131.131: ICMP echo request, id 48, seq 4, length 64
10:44:45.350286 IP 192.168.131.131 > 192.168.112.131: ICMP echo reply, id 48, seq 4, length 64
10:44:46.374314 IP 192.168.112.131 > 192.168.131.131: ICMP echo request, id 48, seq 5, length 64
10:44:46.374323 IP 192.168.131.131 > 192.168.112.131: ICMP echo reply, id 48, seq 5, length 64
10:44:47.398276 IP 192.168.112.131 > 192.168.131.131: ICMP echo request, id 48, seq 6, length 64
10:44:47.398285 IP 192.168.131.131 > 192.168.112.131: ICMP echo reply, id 48, seq 6, length 64
10:44:47.462202 ARP, Request who-has 169.254.1.1 tell 192.168.131.131, length 28
10:44:47.462206 ARP, Request who-has 192.168.131.131 tell 192.168.48.2, length 28
10:44:47.462225 ARP, Reply 192.168.131.131 is-at 46:be:c0:20:37:ba, length 28
10:44:47.462224 ARP, Reply 169.254.1.1 is-at ee:ee:ee:ee:ee:ee, length 28
^C
16 packets captured
16 packets received by filter
0 packets dropped by kernel
/ # 
```

- Source IP(192.168.112.131): 来自 `multitool-1-h5z55` 的IP `192.168.112.131` 位于节点  `calico-ipam-worker2` 上的Pod
- Destination IP(192.168.131.131): 来自`multitool-1-hnkl4` 的IP `192.168.131.131` 位于节点 `calico-ipam-worker` 上的Pod
- ICMP echo request/reply: 有双向回显，说明节点之间的流量是通的。
- No NAT: Pod的IP地址保持不变，证实了Calico采用的原生路由方式。
- 序列号：显示从后台ping过程开始的连续流量流程。

![[Pasted image 20260924133713.png]]

在使用该模式进行通信的过程中中，跨节点的Pod之间原滋原味的保留了src IP和dst IP，全过程没有经过NAT也不需要对数据进行额外的二次封装，因此在没有跨子网的情况下，这种形式更加的节省带宽。








































