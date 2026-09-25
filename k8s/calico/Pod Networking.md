
## Calico Pod Networking
![[Pasted image 20260923161139.png]]
在 Kubernetes 中，每个 Pod 都需要一个唯一的 IP 地址以及良好的网络连接，这样才能正常运作。Pod 的网络配置非常重要，因为：
1. 动态创建 Pod：Pod 是临时性的，经常会被创建或销毁。每个新的 Pod 都需要网络连接，以便与集群中的其他 Pod、服务以及外部资源进行通信。
2. 网络隔离：每个容器都有属于自己的网络命名空间，这样可以提供一定程度的安全隔离性。不过，仍然需要一些机制来连接不同容器的网络命名空间与主机网络的命名空间。
3. 服务发现：合理配置网络环境使得各个 Pod 能够访问 Kubernetes 服务，进行 DNS 解析，并与其他 Pod 进行通信，而无需考虑它们在集群中的物理位置。
4. 容器与容器之间的通信：同一 Pod 中的多个容器需要通过 localhost 进行通信，因此需要进行有效的网络命名空间共享以及接口管理。

Calico 通过创建虚拟网络接口、管理 IP 地址分配、建立路由表，以及实现整个集群基础设施中的安全跨节点通信，从而提供了全面的容器网络功能。

## Pod 网络是如何连接的
当创建一个容器组时，多个 Kubernetes 组件会协同工作以实现网络连接的功能：
![[Pasted image 20260923161501.png]]
1. kube-apiserver接收到关于创建Pod的请求，并将其分配给一个节点来处理
2. kubelet检测到新的Pod之后，会调用容器运行时（containerd/CRI-O）进行处理
3. 容器运行时负责创建Pod的网络命名空间
4. 容器运行时调用Calico的CNI插件
5. Calico CNI向Calico IPAM插件请求一个IP地址，Calico IPAM会从节点分配到的IP块中分配一个IP给Calico CNI使用
		查看节点的IP块
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
```
6. Calico CNI创建一个Veth接口对：一端保留在主机上 `cali6d09fa47963`，另外一端则连接到容器内部(eth0)
7. Calico CNI会更新Calico数据存储库，加入相关WorkloadEndpoint的信息(包括Pod的IP地址、接口、节点以及标签)
8. Calico CNI向容器运行时返回了包含网络配置细节的成功相应
9. 容器运行时模块已成功向kubelet报告了网络设置的完成情况
10. kubelet将包含容器状态（正在运行）以及分配到的IP地址信息的数据，更新到kube-apiserver中

### 此外
Calico CNI通过Calico接口更新了主机路由，实现了直接指向Pod IP的路由，同时通过虚拟网关(169.254.1.1) 配置了Pod的默认路由，以便集群之间进行通信。
结果：Pod 拥有唯一的 IP 地址，可以通过 Calico 的路由基础设施与集群中的其他 Pod 进行通信。

```bash
master ✗ $ kubectl exec -it multitool -- sh                         
/ # ps
    PID TTY          TIME CMD
     29 pts/1    00:00:00 sh
     35 pts/1    00:00:00 ps
/ # ip addr 
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP group default qlen 1000
    link/ether 1a:69:96:5e:c4:28 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 192.168.131.130/32 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::1869:96ff:fe5e:c428/64 scope link 
       valid_lft forever preferred_lft forever
```

> 环境搭建可以采用 IPAM中的方法，本节只是新部署一个网络工具Pod即可

## 部署 multitool Pod
`kubectl apply -f tools/multitool-pod.yaml` 
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multitool
  namespace: default
  labels:
    app: multitool
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
      echo "Multitool pod started"
      echo "Available tools: curl, wget, nslookup, dig, ping, traceroute, netstat, ss, iperf3, tcpdump"
      echo "Pod IP: $(hostname -i)"
      echo "Node: $HOSTNAME"
      nginx -g "daemon off;"
  restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: multitool-service
  namespace: default
  labels:
    app: multitool
spec:
  selector:
    app: multitool
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

## 确认结果

### 检查网络topo
```bash
containerlab inspect -t calico-ipam.clab.yaml
```
![[Pasted image 20260923165415.png]]

### 检查kubernetes集群状态
```bash
master ✗ $ kubectl get nodes -o wide
NAME                        STATUS   ROLES           AGE     VERSION   INTERNAL-IP    EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION      CONTAINER-RUNTIME
calico-ipam-control-plane   Ready    control-plane   5h27m   v1.28.0   192.168.48.3   <none>        Debian GNU/Linux 11 (bullseye)   6.17.0-35-generic   containerd://1.7.1
calico-ipam-worker          Ready    <none>          5h27m   v1.28.0   192.168.48.2   <none>        Debian GNU/Linux 11 (bullseye)   6.17.0-35-generic   containerd://1.7.1
calico-ipam-worker2         Ready    <none>          5h27m   v1.28.0   192.168.48.4   <none>        Debian GNU/Linux 11 (bullseye)   6.17.0-35-generic   containerd://1.7.1
```
所有node节点都显示Ready，说明kubernetes集群运行正常，已准备好承载工作负载。

### 确认节点正在运行
```bash
master ✗ $ kubectl get pods         
NAME        READY   STATUS    RESTARTS   AGE
multitool   1/1     Running   0          104m
```
多功能工具包应该会显示 `STATUS: Running` 和 `READY: 1/1` ，这表明它已经可以用于网络分析了

### 检查Pod的网络接口
```bash
master ✗ $ kubectl exec -it multitool -- sh                                                                                                     130 ↵
# 检查IP地址
/ # ip addr 
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP group default qlen 1000
    link/ether 1a:69:96:5e:c4:28 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 192.168.131.130/32 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::1869:96ff:fe5e:c428/64 scope link 
       valid_lft forever preferred_lft forever
/ # 
```
1. 接口1 回环(lo)：用于本地通信的标准回环接口
2. 接口2(eth0@if7)：Pod的主网络接口
	- MTU从标准的1500减少到1450，这是为了兼容容器VxLAN的额外开销
	- inet 192.168.131.130/32 具有32位子网掩码，单一主机路由
	- link-netnsid 0: 通过veth对连接到主机网络命名空间
	- @if7: 表示这是veth配对中的一个断点，连接到了主机上的接口7

### 检查路由表
```bash
/ # ip route 
default via 169.254.1.1 dev eth0 
169.254.1.1 dev eth0 scope link
```
- 默认路由：所有流量都通过eth0接口，访问的地址为168.254.1.1
- 169.254.1.1：Calico的虚拟下一跳地址（link-local address)
- scope link: 下一跳可以在同一网段上直接访问到
- Calico 的方法：所有节点之间使用统一的下一跳IP地址，从而简化了路由的过程
### 检查DNS配置
```bash
/ # cat /etc/resolv.conf 
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```
- 搜索域名：自动完成域名以进行名称解析
    - default.svc.cluster.local：默认命名空间中的服务
    - **svc.cluster.local**: 集群内任何命名空间的服务
    - **cluster.local**: 集群范围内的资源以及与集群相关的通用领域。
    - **ec2.internal**: AWS EC2 内部域名（继承自宿主的 EC2 实例）
- **nameserver 10.96.0.10**: 10.96.0.10：所有 DNS 查询的 CoreDNS 服务 IP 地址
    - 这是 `kube-system` 命名空间中 `kube-dns` 服务的集群 IP 地址。
    - 所有关于 Pod 的 DNS 查询都会被转发到 CoreDNS 进行解析。
- **options ndots:5**:  查询行为配置
    - 那些点数少于 5 个的姓名会被视为相对姓名（通过添加域名后缀进行搜索）
    - 那些以 5 个或更多点组成的名称被视为完全限定的域名（FQDN）。
    - 例如： `kubernetes` → 搜索 `kubernetes.default.svc.cluster.local`
    - 例如： `google.com.` → 直接作为 FQDN 进行查询

此 DNS 配置支持 Kubernetes 服务发现功能，使得容器可以通过短名称（例如 `kubernetes` ）或完全限定的名称（例如 `my-service.my-namespace.svc.cluster.local` ）来访问服务。

### 检查主机路由表
这里搭建的环境是使用Kind搭建的，因此，主机路由也是在kind创建的node里面

首先查看，Pod在哪个主机上运行
```bash
andrew@andrew:~/k8-networking-calico-containerlab/containerlab/01-calico-ipam 
master ✗ $ kubectl get pod -o wide         
NAME        READY   STATUS    RESTARTS   AGE    IP                NODE                 NOMINATED NODE   READINESS GATES
multitool   1/1     Running   0          4h5m   192.168.131.130   calico-ipam-worker   <none>           <none>
```
- IP地址：显示当前Pod的地址（192.168.131.130）
- 节点：表示当前Pod正在运行在`calico-ipam-worker`上

连接到Pod所在的主机上
```bash
master ✗ $ docker exec -it calico-ipam-worker bash           
root@calico-ipam-worker:/# 
```

现在你已经进入到了kubernetes的工作节点内部了，可以查看该节点的主机路由配置了
```bash
root@calico-ipam-worker:/# ip route |grep 192.168.131.130
192.168.131.130 dev cali6d09fa47963 scope link 
```

- 192.168.131.130 该Pod所在的IP地址，来自Pod的eth0接口
- dev cali6d09fa47963 进入该节点的流量通过calico veth接口进行
- scope link: 该目标在本地网络段中可以直接访问

### 检查主机上的Veth接口
```bash
root@calico-ipam-worker:/# ip addr |grep cali6d09fa47963 -A 3
7: cali6d09fa47963@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP group default qlen 1000
    link/ether ee:ee:ee:ee:ee:ee brd ff:ff:ff:ff:ff:ff link-netns cni-edbc1559-6012-9377-9ab1-21fd2bcc676c
    inet6 fe80::ecee:eeff:feee:eeee/64 scope link 
       valid_lft forever preferred_lft forever
```
- cali6d09fa47963@if2: 与Pod的eth0@if7接口关联的主机接端veth接口
- 接口if7 ↔ 接口if2：在 Pod 中，@if7 对应的实际上是主机上的接口 7；@if2 则表示该设备与 Pod 命名空间中的接口 2 相连。
- 没有IPv4地址：主机端的veth接口不需要用于三层网络的IP地址

### 关键路由注意事项
Veth接口对连接：Pod的eth0@if7与宿主机的cali6d09fa47963@if2建立对等连接，形成了一个点对点的链接。
直接主机路由：每个Pod都在主机上获得一个特定/32路由，该路由指向其专用的Calico接口
命名空间隔离：link-netn引用展示了如何使容器的网络命名保持隔离状态，同时仍然与主机保持链接

## 关键概念
该图展示了kubernetes Pod如何通过veth（虚拟以太网）对连接到主机网络。Pod的网络命名空间包含一个eth0接口，该接口具有/32子网地址，并且有一个默认路由指向虚拟网页，而主机网络命名空间则将流量通过相应的`cali*`接口路由到Pod的IP地址。这种设置能够实现网络隔离，在calico中进行节点级别的路由处理以及策略执行。
![[Pasted image 20260923193514.png]]
Point-to-Point Links:每个Pod接口都使用/32地址，从而在Pod与主机之间建立点对点的连接。
Virtual next-hop: calico将169.254.1.1 作为虚拟网关，使得所有的Pod都能够拥有一致的路由配置
基于主机的路由：实际的路由决策在kubernetes节点上做出，而Calico则负责维护详细的路由表，以实现节点间的通信。

## 摘要
- 容器网络命名空间：每个容器在其独立的网络命名空间中运行，该命名空间拥有来自 Calico IPAM 的唯一 IP 地址，以及专用的 `eth0` 接口。
- Veth 对：Calico 为每个 Pod 创建一个 Veth 对——一端（ `eth0` ）位于 Pod 的命名空间中，另一端（ `cali*` ）位于主机上——从而形成一个点对点的连接。
- 虚拟下一跳地址：169.254.1.1。所有节点都将所有出站流量通过链接本地地址 169.254.1.1 进行路由转发。这是一个统一的虚拟网关，Calico 在所有节点上都会使用它，以简化路由过程。
- 主机路由表：Kubernetes 节点为每个 Pod 维护一个特定的/32 主机路由，将指向某个 Pod IP 地址的流量导向相应的 Calico 接口。
- 通过 CoreDNS 进行 DNS 解析：所有名称的解析都使用 CoreDNS（地址：10.96.0.10）来完成。对于 Kubernetes 服务的查询，系统会使用短名称进行查找。
- CNI 生命周期：当创建一个 Pod 时，Calico 的 CNI 插件会协调进行 IP 分配、veth 对的创建、路由表更新以及数据存储库的注册等步骤，所有这些操作都会以有序的方式协同完成。

































































