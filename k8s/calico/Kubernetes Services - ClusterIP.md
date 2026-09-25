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

## ipset

实际生产场景中可能使用的是ipset模式

```bash
#  iptables -t nat -S KUBE-SERVICES 
-N KUBE-SERVICES
-A KUBE-SERVICES -s 127.0.0.0/8 -j RETURN
-A KUBE-SERVICES ! -s 10.224.0.0/11 -m comment --comment "Kubernetes service cluster ip + port for masquerade purpose" -m set --match-set KUBE-CLUSTER-IP dst,dst -j KUBE-MARK-MASQ
-A KUBE-SERVICES -m addrtype --dst-type LOCAL -j KUBE-NODE-PORT
-A KUBE-SERVICES -m set --match-set KUBE-CLUSTER-IP dst,dst -j ACCEPT
```
它看起来规则很少，但其实背后隐藏了所有的 Service 流量处理逻辑。

### 逐行解读

```
-N KUBE-SERVICES
```

- **含义**：新建一个名为 `KUBE-SERVICES` 的自定义链（Chain）。这是所有 Service 流量的总入口。

```
-A KUBE-SERVICES -s 127.0.0.0/8 -j RETURN
```

- **含义**：如果流量源 IP 是 `127.0.0.0/8`（本机回环地址），直接返回（不做任何处理）。这是为了不干扰本机的 localhost 访问。

```
-A KUBE-SERVICES ! -s 10.224.0.0/11 -m comment --comment "Kubernetes service cluster ip + port for masquerade purpose" -m set --match-set KUBE-CLUSTER-IP dst,dst -j KUBE-MARK-MASQ
```

- **这是最关键的一条规则（核心优化点）**。
- **含义**：
    - `! -s 10.224.0.0/11`：**源 IP 不是 Pod 网段**（即外部流量或非集群内 Pod 流量）。
    - `-m set --match-set KUBE-CLUSTER-IP dst,dst`：**目的地址是 ClusterIP**（这里没有直接写死 IP，而是去查一个叫 `KUBE-CLUSTER-IP` 的 ipset 集合）。
    - `-j KUBE-MARK-MASQ`：如果命中上面条件，跳转到 `KUBE-MARK-MASQ` 链打标记（为了后续做 SNAT/MASQUERADE）。
- **为什么规则这么少？**​ 因为**所有 ClusterIP 都被打包放进了 `KUBE-CLUSTER-IP` 这个 ipset 里**。不管你建了 10 个还是 1000 个 Service，这里永远只需要这一条规则来匹配“所有 ClusterIP”。

```
-A KUBE-SERVICES -m addrtype --dst-type LOCAL -j KUBE-NODE-PORT
```

- **含义**：如果目的地址是本机的非 ClusterIP（比如 NodePort 或 HostNetwork），跳转到 `KUBE-NODE-PORT` 链处理。

```
-A KUBE-SERVICES -m set --match-set KUBE-CLUSTER-IP dst,dst -j ACCEPT
```

- **含义**：如果目的是 ClusterIP，直接 ACCEPT（接受）。
- **注意**：这里的 ACCEPT 并不是终点。它意味着“匹配到了 Service，具体的 DNAT 转发逻辑在后续的链（KUBE-SVC-xxx）里”。在 iptables 的 filter 表中 ACCEPT 是放行，但在 nat 表中，如果没有后续的 DNAT，流量其实还没真正到达 Pod。这里的逻辑是：先 ACCEPT 进入 Service 处理流程，由 kube-proxy 安装的其他规则完成 DNAT。

### 总结：为什么“只有这一个”？

你看到的不是“只有一个规则”，而是“一个总入口”**。

1. **聚合匹配**：通过 `ipset`（`KUBE-CLUSTER-IP`），把所有 Service 的 IP 打包在一起，用一条规则 `-m set ...` 全部匹配出来。
2. **分流处理**：
    - 如果是外部流量访问 ClusterIP → 打标记（为了 MASQ）。
    - 如果是 NodePort 流量 → 交给 NodePort 链。
    - 如果是 ClusterIP 流量 → ACCEPT（进入后续的负载均衡链）。


**简单一句话：**

> 这是 Kubernetes 为了提升大规模集群性能，用 `ipset` 把所有 Service IP 打包，实现了“一条规则管所有 Service”的优化手段。