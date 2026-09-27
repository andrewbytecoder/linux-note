在k8s中服务能为服务提供稳定的虚拟IP和DNS名称，它们将客户端与容器的生命周期分离，并在集群内提供简单的L4级负载均衡

- Pod是临时性的：Pod的ip地址会不断的变化，因此客户端需要一个稳定的endpoint
- Load balanceing: 自动将流量分配到各个副本上
- 服务发现：使用DNS名称而非Pod的IP地址，来进行通信
- 控制性曝光：仅在内部进行曝光，或者根据需要进行外部曝光

## The type of services
- ClusterIP: 仅限内部使用虚拟IP地址，用于集群内的访问操作
- 节点端口：在每个节点上打开一个端口(30000-32767)
- 负载均衡器：用于配置外部负载均衡器（云环境或MetaLB）
- ExternalName：通过DNS将CNAME记录指向一个外部主机名，无需进行代理处理。
- Headless(`clusterIP: None`): 没有vip地址，使用DNS获取Pod的地址。

### ClusterIP Service
Kubernetes的ClusterIP类型的服务提供了一个集群内的虚拟IP地址。每个节点上的kube-proxy会管理数据平面规则（例如： iptables, IPVS或用户空间模式），将指向该服务虚拟IP地址的流量引导到相应的后端Pod上。

#### 如何使用kube-proxy来配置ClusterIP服务
![[Pasted image 20260924233513.png]]

创建或更新ClusterIP服务时，需要遵循如下步骤：
- API事件：当你使用`kubectl apply`应用一个service的时候，apiserver会收到事件触发，将该service配置存储在etcd中。并根据标签选择器更新 `EndpointSlice` 对象
- kube-proxy 监控：每个节点的Kube-proxy会持续监控services和EndpointSlices，并实时获取最新的更新事件
- program dataplane: kube-proxy将期望的状态转化为本地数据平面规则
	- Iptables mode: 安装 chains/rules 这些规则作用于 service VIP 的DNAT流量，使其定向发送到后端Pod的IP地址和端口上。同时，该模式还具备控制每次连接的亲和性和概率的功能。
	- IPVS模式：在内核级别为 service VIP配置虚拟服务器，该虚拟服务器可以连接到后端真实的Pod服务上，从而实现更好的扩展性和性能优化。
- traffic path: 任何位于任意节点的Pod，如果向Service的ClusterIP地址发送流量，就会触发kube-proxy规则。之后，流量会被负载均衡到一台健康状态的后端Pod上(无论是本地还是远程节点)。返回流量则遵循常规的路由规则（在集群内部无需进行SNAT转换）。
## 实验环境
实验环境复用IPAM中的实验环境
topo如下
```yaml
name: k8-services
topology:
  nodes:
    k8-services:
      kind: k8s-kind
      image: kindest/node:v1.28.0
      startup-config: k8-services-no-cni.yaml
      extras:
        k8s_kind:
          deploy:
            wait: 0s
---
apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
networking:
  disableDefaultCNI: true
  podSubnet: "192.168.0.0/16"
  serviceSubnet: "10.96.0.0/16"
nodes:
  - role: control-plane
  - role: worker
  - role: worker
---
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  # Configures Calico networking.
  calicoNetwork:
    # Note: The ipPools section cannot be modified post-install.
    ipPools:
    - blockSize: 26
      cidr: 192.168.0.0/16
      encapsulation: VXLANCrossSubnet
      natOutgoing: Enabled
      nodeSelector: all()
---
apiVersion: operator.tigera.io/v1
kind: APIServer
metadata:
  name: default
spec: {}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: default
  labels:
    app: nginx
spec:
  replicas: 2
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
        image: nginx:stable
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
  namespace: default
  labels:
    app: nginx
spec:
  selector:
    app: nginx
  ports:
  - name: http
    port: 80
    targetPort: 80
    protocol: TCP
  type: ClusterIP
```

### 检查所有容器和服务都已经启动
```bash
master ✗ $ kubectl get pod -o wide 
NAME                                READY   STATUS    RESTARTS   AGE   IP                NODE                        NOMINATED NODE   READINESS GATES
multitool-1-h5z55                   1/1     Running   0          25h   192.168.112.131   calico-ipam-worker2         <none>           <none>
multitool-1-hnkl4                   1/1     Running   0          25h   192.168.131.131   calico-ipam-worker          <none>           <none>
multitool-1-nh4qg                   1/1     Running   0          25h   192.168.18.73     calico-ipam-control-plane   <none>           <none>
multitool-2-6jbdt                   1/1     Running   0          25h   192.168.131.132   calico-ipam-worker          <none>           <none>
multitool-2-jql6b                   1/1     Running   0          25h   192.168.18.72     calico-ipam-control-plane   <none>           <none>
multitool-2-zlm2k                   1/1     Running   0          25h   192.168.112.130   calico-ipam-worker2         <none>           <none>
nginx-deployment-55d7bb4b86-j5q5j   1/1     Running   0          46m   192.168.112.132   calico-ipam-worker2         <none>           <none>
nginx-deployment-55d7bb4b86-lqswq   1/1     Running   0          46m   192.168.131.133   calico-ipam-worker          <none>           <none>
```

- 可以看到这些Pod运行状态良好，并且分布在各个节点上，这证明控制平面和woker的调度和准备状态都是正常的
- Pod IP列显示了可路由的Pod CIDR地址，这些地址将会出现在EndpointSlices中
```bash
master ✗ $ kubectl get services |grep nginx-service
nginx-service         ClusterIP   10.96.102.172   <none>        80/TCP              53m
```
- Service VIP的地址是 `10.96.102.172`，这是集群内部使用的稳定的地址，客户端使用该地址而非Pod的IP地址进行连接。
- 类型设置为ClusterIP，因此只有通过VIP或DNS方式，才能在集群命名空间中访问它（例如，使用 `nginx-service`）
```bash
master ✗ $ kubectl get endpointslice |grep nginx-service
nginx-service-jp9bz         IPv4          80          192.168.131.133,192.168.112.132                 57m
```
- `EndpointSlice`列出了负载均衡后端的IP地址，这里IP地址应该与上面nginx pod的IP地址一致
- 这证实了 `kube-controller-manager`已经配置了响应的endpoints并且kube-proxy能够为该服务定制数据平面的规则。

## 验证
### 测试Pod到service的连接

```bash
master ✗ $ kubectl exec -it multitool-1-hnkl4 -- sh
/ # curl http://nginx-service:80
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, nginx is successfully installed and working.
Further configuration is required for the web server, reverse proxy, 
API gateway, load balancer, content cache, or other features.</p>

<p>For online documentation and support please refer to
<a href="https://nginx.org/">nginx.org</a>.<br/>
To engage with the community please visit
<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>
For enterprise grade support, professional services, additional 
security features and capabilities please refer to
<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
/ # 
```
通过curl域名，可以看到在k8s中已经能通过域名对服务进行访问

### 检查iptables规则(ClusterIP path)
访问某个服务 IP 的流量首先会到达 KUBE-SERVICES，然后会被路由到 KUBE-SVC chain 进行负载均衡，最后会到达其中一个 KUBE-SEP endpoint chains，在那里 DNAT 会将流量映射到实际的 Pod 上。这就是 kube-proxy 如何通过单一的稳定服务 IP 来抽象化多个 Pod 的方式。
![[Pasted image 20260925173154.png]]
### 定位service规则
> iptables 小知识

| **<br><br>链名<br><br>** | **<br><br>含义<br><br>**                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `KUBE-SERVICES`        | 所有 Service 流量的总入口                                                      |
| `KUBE-SVC-<hash>`      | 某个 Service 的链，做“选哪个后端”的负载均衡，可以选择性地标记以供MASQ处理，并随机选择一个端点进行连接             |
| `KUBE-SEP-<hash>`      | 某个 **Service Endpoint（后端 Pod）**​ 的链，做真正的 DNAT                          |
| `KUBE-NODEPORTS`       | NodePort 类型流量入口，将数据包定向到Pod的IP地址和端口，返回流量可能会根据kube-proxy的后置路由规则进行SNAT转换。 |

| **<br><br>参数<br><br>** | **<br><br>含义<br><br>**                   |
| ---------------------- | ---------------------------------------- |
| `-A`                   | **Append**：追加到链尾（最常用）                    |
| `-I`                   | **Insert**：插入到链头或指定位置                    |
| `-D`                   | **Delete**：删除规则                          |
| `-R`                   | **Replace**：替换规则                         |
| `-L`                   | **List**：列出规则（你用 `iptables -S` 时看到的就是这个） |
| `-P`                   | **Policy**：设置链的默认策略（ACCEPT/DROP）         |

```bash
# iptables -t nat -S KUBE-SERVICES | grep nginx-service
-A KUBE-SERVICES -d 10.96.102.172/32 -p tcp -m comment --comment "default/nginx-service:http cluster IP" -m tcp --dport 80 -j KUBE-SVC-6IM33IEVEEV7U3GP
```
上面一条规则整体实现的内容是：将TCP流量重定向到VIP `10.96.102.172:80` 上，然后跳转到每个服务的链路上 `KUBE-SVC-6IM33IEVEEV7U3GP`

- `-t nat`: NAT table 网络地址转换表，`-s` : 以附加语法显示规则
- `-d <ip>/32`: 确切的目标IP地址。`-p tcp` + `--dport 80`: TCP 80
- `-m comment`: 供人类阅读的注释。 `-j`: 跳转目标
### 检查Service Chain(服务链)

```bash
KUBE-SERVICES
  └─ KUBE-SVC-6IM33IEVEEV7U3GP   （nginx-service 的负载均衡链）
       ├─ KUBE-SEP-S672AJFPY6I4RIM3  → Pod A (192.168.112.132:80)
       └─ KUBE-SEP-7Z3ZPU4KZBWGFKNE  → Pod B (192.168.131.133:80)
```
```bash

# iptables -t nat -L KUBE-SVC-6IM33IEVEEV7U3GP -n -v --line-numbers
Chain KUBE-SVC-6IM33IEVEEV7U3GP (1 references)
num   pkts bytes target     prot opt in     out     source               destination         
1        0     0 KUBE-MARK-MASQ  tcp  --  *      *      !192.168.0.0/16       10.96.102.172        /* default/nginx-service:http cluster IP */ tcp dpt:80
2        0     0 KUBE-SEP-S672AJFPY6I4RIM3  all  --  *      *       0.0.0.0/0            0.0.0.0/0            /* default/nginx-service:http -> 192.168.112.132:80 */ statistic mode random probability 0.50000000000
3        2   120 KUBE-SEP-7Z3ZPU4KZBWGFKNE  all  --  *      *       0.0.0.0/0            0.0.0.0/0            /* default/nginx-service:http -> 192.168.131.133:80 */
# 
```

rule1: 如果客户所在位置超出 `192.168.0.0/16` 范围，则需要进行伪装标记(masquerade)
rule2-3: 将流量负载均衡到两个 endpoint 链；第一条以 50% 概率命中，第二条捕获剩余的全部流量（也是 50%）
- `-L`: list rules. `-n`:  no name resolution. `-v`: counters. `--line-numbers`: 索引
- `!CIDR`: negation match, `statistic mode random` probabilistic branching

#### 为什么需要伪装
```bash
外部客户端（比如 10.0.0.5）
    ↓ 访问 nginx-service ClusterIP: 10.96.102.172:80
Node（kube-proxy iptables 规则命中）
    ↓ DNAT → Pod IP: 192.168.112.132:80
Pod（nginx）
    ↓ 回包：src=192.168.112.132, dst=10.0.0.5
```
外部客户端进来可能连接任何一个Node，如果不进行伪装Pod 看到源 IP 是 `10.0.0.5`（外部 IP），它直接把回包发给自己网关 → 走外网路由 → **永远不会回到那个 Node**​ → 客户端收不到回包 → **连接卡死/超时**。
```bash
外部客户端 10.0.0.5 → Node:10.96.102.172:80
    ↓
【SNAT/MASQUERADE】src 改为 Node 的 IP（比如 192.168.0.10）
    ↓
DNAT → Pod 192.168.112.132:80
    ↓
Pod 回包 → 192.168.0.10（Node）
    ↓
Node 反向转换 → 回给 10.0.0.5 ✅
```

#### 负载均衡

```bash
2   0   0   KUBE-SEP-xxx  all  --  *  *  0.0.0.0/0  0.0.0.0/0  statistic mode random probability 0.50000000000
```

| **<br><br>列<br><br>** | **<br><br>值<br><br>**                             | **<br><br>含义<br><br>** |
| --------------------- | ------------------------------------------------- | ---------------------- |
| 1                     | `2`                                               | 规则序号                   |
| 2                     | `0`                                               | 匹配到的**数据包数**（pkts）     |
| 3                     | `0`                                               | 匹配到的**字节数**（bytes）     |
| 4                     | `KUBE-SEP-xxx`                                    | jump 到目标链（endpoint 链）  |
| 5                     | `all`                                             | 协议（all = 不限）           |
| 6                     | `--`                                              | 入接口                    |
| 7                     | `*`                                               | 出接口                    |
| 8                     | `0.0.0.0/0`                                       | 源 IP                   |
| 9                     | `0.0.0.0/0`                                       | 目标 IP                  |
| 10                    | `statistic mode random probability 0.50000000000` | **随机负载均衡模块**​          |
```bash
statistic mode random probability 0.5
```
这是iptables的statistic匹配模块，使用随机数决定当前报走不走这条规则：
```bash
每个包生成一个 [0,1) 的随机数
  → 如果 < 0.5 → 命中本条规则
  → 否则 → 继续匹配下一条
```


### 检查 endpoint DNAT#1

```bash
# iptables -t nat -L KUBE-SEP-S672AJFPY6I4RIM3 -n -v --line-numbers
Chain KUBE-SEP-S672AJFPY6I4RIM3 (1 references)
num   pkts bytes target     prot opt in     out     source               destination         
1        0     0 KUBE-MARK-MASQ  all  --  *      *       192.168.112.132      0.0.0.0/0            /* default/nginx-service:http */
2        0     0 DNAT       tcp  --  *      *       0.0.0.0/0            0.0.0.0/0            /* default/nginx-service:http */ tcp to:192.168.112.132:80
# 
```

这里被路由的数据包会先经过DNAT处理（`KUBE-MARK-MASQ`），然后被发送到 `192.168.112.132` 。如果需要该标记(`KUBE-MARK-MASQ`)还可以支持egress SNAT/masquerade 

- `DNAT ... to:<podIP>:<port>` : 将目的地址NAT功能映射到后端节点。

### 检查 endpoint DNAT#2

```bash
# iptables -t nat -L KUBE-SEP-7Z3ZPU4KZBWGFKNE -n -v --line-numbers
Chain KUBE-SEP-7Z3ZPU4KZBWGFKNE (1 references)
num   pkts bytes target     prot opt in     out     source               destination         
1        0     0 KUBE-MARK-MASQ  all  --  *      *       192.168.131.133      0.0.0.0/0            /* default/nginx-service:http */
2        2   120 DNAT       tcp  --  *      *       0.0.0.0/0            0.0.0.0/0            /* default/nginx-service:http */ tcp to:192.168.131.133:80
```
备用后端Pod `192.168.131.133`; 与之前的端点一起，这俩个就是该服务背后的后端组件


## Daigram: Chain and Flow

ClusterIP 服务 `nginx-service` -> VIP `10.96.102.172:80`  Endpoints： `192.168.112.132:80` 和 `192.168.131.133:80`
![[Pasted image 20260925200407.png]]

- `KUBE-SERVICE`: Global chain，匹配Service的VIP(ClusterIP);匹配后跳转对应的 per-service子链
- `KUBE-SVC-<hash>`: 每个Service对应的子链，负责打MASQ标记并对后端Pod做负载均衡分发。
- `KUBE-SEP-<hash>`: 每个endpoint后端Pod对应的子链，将目标地址DNAT到具体的PodIP:Port；在hairpin(回环)场景下会对源IP打MASQ标记。
- `MASQ/SNAT`: 在外部客户端访问 `ClusterIP/NodePort` 等场景下，通过SNAT将源IP修改为Node IP，确保Pod的回包能回到Node再转发给客户端。

|**<br><br>链/机制<br><br>**|**<br><br>精准中文<br><br>**|
|---|---|
|`KUBE-SERVICES`|全局链，匹配 Service 的 ClusterIP:Port，命中后跳转到对应 Service 子链|
|`KUBE-SVC-<hash>`|每个 Service 的子链，通过 statistic 随机模块做负载均衡，将流量分发到各 endpoint 链|
|`KUBE-SEP-<hash>`|每个后端 Pod 的子链，执行 DNAT 将目标地址改为 Pod IP:Port；hairpin 场景下对源 IP 打 MASQ 标记|
|`MASQ/SNAT`|将源 IP 改写为 Node IP，保证 Pod 回包经过 Node 转发回客户端，避免连接中断|

## 新版本的calico网络策略使用nftables命令iptalbes-nft进行管理
```bash
[root@k8smaster-ims ~]# iptables-nft -t nat -L KUBE-SERVICES -n -v
Chain KUBE-SERVICES (2 references)
 pkts bytes target     prot opt in     out     source               destination  
# localhost流量直接放行     
    7   420 RETURN     all  --  *      *       127.0.0.0/8          0.0.0.0/0          
# 外部流量访问Service做SNAT标记 
# 给包打标记（`0x4000/0x4000`），后续 POSTROUTING 链看到这个标记就做 SNAT
    0     0 KUBE-MARK-MASQ  all  --  *      *      !10.224.0.0/11        0.0.0.0/0            /* Kubernetes service cluster ip + port for masquerade purpose */ match-set KUBE-CLUSTER-IP dst,dst
# NodePort类型访问集群，跳转到 KUBE-NODE-PORT chain，里面按目的端口分发到具体 Service
   67  5724 KUBE-NODE-PORT  all  --  *      *       0.0.0.0/0            0.0.0.0/0            ADDRTYPE match dst-type LOCAL
# ClusterIP 流量放行（DNAT 之前的最终匹配）
# ACCEPT 接受该包，让后续 nat 表的 DNAT 规则生效
# 目的 IP:Port 是 Service ClusterIP
   38  3984 ACCEPT     all  --  *      *       0.0.0.0/0            0.0.0.0/0            match-set KUBE-CLUSTER-IP dst,dst
```

表头含义
```bash
pkts  bytes  target     prot  opt  in     out    source               destination
```

|**<br><br>字段<br><br>**|**<br><br>含义<br><br>**|
|---|---|
|`pkts`|命中该规则的**数据包个数**（计数器）|
|`bytes`|命中该规则的**总字节数**（计数器）|
|`target`|匹配后执行的**动作**（跳转到哪个 chain / 做什么处理）|
|`prot`|匹配的**协议**（tcp/udp/icmp/`all` 表示不限）|
|`opt`|IP 选项匹配（通常为空，或显示 `!` 取反）|
|`in`|**入接口**（包从哪个网卡进来，`*` 表示不限）|
|`out`|**出接口**（nat 表 PREROUTING 链里这个字段无意义，总是 `*`）|
|`source`|**源 IP 范围**​|
|`destination`|**目的 IP 范围**​|
```bash
包进入 nat 表 PREROUTING / OUTPUT
                              ↓
                        KUBE-SERVICES
                              ↓
        ┌─────────┬────────────┼────────────────┬──────────────┐
        ↓         ↓            ↓                ↓              ↓
   源=lo      外部源+        目的=           目的=          其他
   RETURN   ClusterIP    LOCAL IP            ClusterIP      (不匹配任何)
   (跳过)   MARK-MASQ   NODE-PORT           ACCEPT         (隐式 RETURN)
              ↓              ↓                  ↓
          POSTROUTING    KUBE-NODE-PORT    KUBE-SVC-xxx
          SNAT           按端口跳            DNAT→PodIP
```


### 查看 Service->Pod 映射
```bash
[root@k8smaster-ims ~]# ipvsadm -Ln 
# IPVS内核模块版本号， size 4096 IPVS 哈希表大小，表示 IPVS 内部虚拟服务表的基础桶数量
IP Virtual Server version 1.2.1 (size=4096)
#  Prot 类型 如TCP UDP
# LocalAddress:Port 虚拟服务地址（VIP:Port）,在k8s中对应Service的ClusterIP:端口
# rr 轮询算法
# Flags 附加标志，如persistent表示开启了持久连接
# RemoteAddress:Port 后端真实服务器地址（RIP:Port），在k8s中对应Pod IP:端口 
# Forward 转发模式： Masq=NAT模式，Route=DR直连路由，Tun=IP隧道
# Weight 后端服务器权重，值月到分配到的请求越多，0表示不接受新的请求
# ActiveConn 活跃连接数，即当处于TCP ESTABLISHED状态的连接
# InActConn 非活跃连接数，即除ESTABLISHED外的其他状态连接数（如：SYN_RECV, TIME_WAIT, CLOSE_WAIT, FIN_WAIT）
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.96.0.1:443 rr
  -> 10.168.8.107:6443            Masq    1      14         0         
TCP  10.96.0.10:53 rr
  -> 10.250.40.0:53               Masq    1      0          0     
TCP  10.96.1.114:8080 rr persistent 10800
  -> 10.250.40.42:8080            Masq    1      0          0         
```


