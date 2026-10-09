Calico的BGP(边界网关协议)。通过与上游网络的BGP互联，可以通告Pod的CIDR地址以及服务相关的CIDR地址。
当BGP建立的时候，会将IPAM 的负载均衡前缀告知给上游服务，如下图所示：
![[Pasted image 20261009091918.png]]
>IPAM管理的不只是单个IP，而是一段前缀，BGP告知的正是这段前缀，而不是一个个具体地址。 `100.64.0.0/24 via 10.10.10.11`
## 清单
大部分清单文件同Calico BGP 小节，详见 [[Calico BGP]]

### BGP 配置
```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false
  # 这里必须配置，否则将和Calico BGP实验一样，只会建立BGP对等连接，但是不会进行路由的广播
  serviceLoadBalancerIPs:
  - cidr: 172.16.0.240/28
```

如果按照以下进行配置，calico将只会进行BGP对等连接，但是不会进行任何的路由宣告
```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false

```

### 负载均衡IP地址池配置
```yaml
apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
 name: loadbalancer-ip-pool
spec:
 cidr: 172.16.0.240/28
 blockSize: 28
 natOutgoing: true
 disabled: false
 assignmentMode: Automatic
 allowedUses:
  - LoadBalancer
```

### LB类型的服务创建
```yaml
apiVersion: v1
kind: Service
metadata:
  name: lb-nginx-service
  namespace: default
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
      name: default
  type: LoadBalancer
```

## 实验环境

### 检查k8s集群情况

```bash
❯ kubectl get nodes
NAME                STATUS   ROLES           AGE   VERSION
k01-control-plane   Ready    control-plane   13h   v1.35.0
k01-worker          Ready    <none>          13h   v1.35.0
k01-worker2         Ready    <none>          13h   v1.35.0
```

## 配置负载均衡类型服务以及BGP告知信息
默认情况下，部署的nginx服务只能通过Cluster IP进行访问该服务。Cluster IP地址可以被集群内的公祖负载用来连接服务，不过集群外无法通过这写IP地址连接服务。

我们有如下服务：
```bash
❯ kubectl get pod
NAME                                READY   STATUS    RESTARTS   AGE
nginx-deployment-84d779799d-2zxl4   1/1     Running   0          14h
nginx-deployment-84d779799d-c298w   1/1     Running   0          14h
```
对应的service信息
```bash
❯ kubectl get svc
NAME            TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
kubernetes      ClusterIP   10.96.0.1      <none>        443/TCP   14h
nginx-service   ClusterIP   10.96.48.166   <none>        80/TCP    13h
```
这时我们可以看到 nginx-service 只有 CLUSTER-IP 没有 EXTERNAL-IP(`<none>`)，因此，只能在集群内部访问，并不能在外部访问对应的服务。
接下来我们一步步将nginx-service 修改为能够暴露给集群外的工作负载。为此我们需要创建一个可以向上游网络进行广播的  `type: LoadBalancer` 的服务。

### 配置负载均衡所使用的IP地址池(IPPOOL)
在创建`type: LoadBalancer`服务之前，我们首先需要创建一个可用于分配IP地址的IPPOOL。而且这个IP池需要在当前网络中能够进行路由，并且不得与网络中的其他子网产生冲突。

```yaml
apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
 name: loadbalancer-ip-pool
spec:
 cidr: 172.16.0.240/28
 blockSize: 28
 natOutgoing: true
 disabled: false
 assignmentMode: Automatic
 allowedUses:
  - LoadBalancer
```

```bash
kubectl apply -f ./k8s-manifests/lb-ippool.yaml
```

验证配置已经生效
```bash
> kubectl get ippool
NAME                   CREATED AT
default-ipv4-ippool    2026-10-08T11:31:28Z
loadbalancer-ip-pool   2026-10-08T11:34:07Z
```

配置完成之后，Calico的IPAM控制器将使用所指定的CIDR范围来为负载均衡型服务分配IP地址。现在，我们已经配置了IP池，接下来我们为 `nginx-service`创建一个负载均衡类服务

### 创建 `type: LoadBalancer` 类型服务

```yaml
apiVersion: v1
kind: Service
metadata:
  name: lb-nginx-service
  namespace: default
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
      name: default
  type: LoadBalancer%        
```

我们使用kubectl命令创建这个服务
```bash
> kubectl apply -f lb-nginx-service.yaml
service/lb-nginx-service created
```

```bash
> kubectl get services
NAME               TYPE           CLUSTER-IP      EXTERNAL-IP    PORT(S)        AGE
kubernetes         ClusterIP      10.96.0.1       <none>         443/TCP        16h
lb-nginx-service   LoadBalancer   10.96.174.109   172.16.0.241   80:30951/TCP   52s
nginx-service      ClusterIP      10.96.48.166    <none>         80/TCP         16h
```

我们可以看到 lb-nginx-service已经创建好了，该服务的类型为 `LoadBalancer` ，ClusterIP  `10.96.174.109`,  externalIP `172.16.0.241`，externalIP 是来自负载均衡IP池中的IP

### 将负载均衡的CIDR信息通告给上游网络
为了向上游网络通告负载均衡器的CIDR范围，我们必须修改BGPConfiguration资源的配置，使其在前缀通告中包含负载均衡的ip地址。

```yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  nodeToNodeMeshEnabled: false
  serviceLoadBalancerIPs:
  - cidr: 172.16.0.240/28
```

现在我们已经配置了负载均衡服务，并将CIDR范围通告给了上游网络，接下来我们验证下从外部访问此服务的路由和连接情况。

## 验证路由和连接
### 在cEOS中验证路由表是否正确
执行程序进入到CEOS容器中。
```bash
docker exec -it clab-calico-bgp-lb-ceos01 Cli
```

接下来我们看下路由表
```bash
ceos>enable
ceos#show ip route

VRF: default
Source Codes:
       C - connected, S - static, K - kernel,
       O - OSPF, O IA - OSPF inter area, O E1 - OSPF external type 1,
       O E2 - OSPF external type 2, O N1 - OSPF NSSA external type 1,
       O N2 - OSPF NSSA external type2, O3 - OSPFv3,
       O3 IA - OSPFv3 inter area, O3 E1 - OSPFv3 external type 1,
       O3 E2 - OSPFv3 external type 2,
       O3 N1 - OSPFv3 NSSA external type 1,
       O3 N2 - OSPFv3 NSSA external type2, B - Other BGP Routes,
       B I - iBGP, B E - eBGP, R - RIP, I L1 - IS-IS level 1,
       I L2 - IS-IS level 2, A B - BGP Aggregate,
       A O - OSPF Summary, NG - Nexthop Group Static Route,
       V - VXLAN Control Service, M - Martian,
       DH - DHCP client installed default route,
       DP - Dynamic Policy Route, L - VRF Leaked,
       G  - gRIBI, RC - Route Cache Route,
       CL - CBF Leaked Route

Gateway of last resort is not set

 C        10.10.10.0/24
           directly connected, Vlan10
 B E      172.16.0.240/28 [200/0]
           via 10.10.10.10, Vlan10
 C        172.20.20.0/24
           directly connected, Management0

ceos#
```

改路由表表示，负载均衡器CIDR `172.16.0.240/28` 已经通过BGP成功被通告了
- `B E`: 这是一条外部BGP路由
- `172.16.0.240/28`: 是配置在Calico中的负载均衡IP地址池
- `[200/0]`: 显示了管理距离 100 和度量值 0.
- `via 10.10.10.10, Vlan10`: 表示下一跳目标是kubernetes节点的接口 (interface vlan 10)

这些路由证实上游路由器(cEOS)已经通过BGP协议从Calico哪里获取了负载均衡器的CIDR信息，从而实现了对LoadBalancer服务的外部连接。

需要指出的是，该前缀由集群中所有节点通告，这是因为这个特定集群中所有节点都与上游路由器建立了配对，你可以通过查看bgp信息来确认这一点
```bash
ceos#show ip bgp summary
BGP summary information for VRF default
Router identifier 10.10.10.1, local AS number 65001
Neighbor Status Codes: m - Under maintenance
  Description              Neighbor    V AS           MsgRcvd   MsgSent  InQ OutQ  Up/Down State   PfxRcd PfxAcc
  "Calico Kubernetes Nodes 10.10.10.10 4 65010           1251      1282    0    0 18:08:40 Estab   1      1
  "Calico Kubernetes Nodes 10.10.10.11 4 65010           1250      1285    0    0 18:08:40 Estab   1      1
  "Calico Kubernetes Nodes 10.10.10.12 4 65010           1250      1283    0    0 18:08:40 Estab   1      1
```

该BGP摘要信息显示了与 全部三个kubernetes节点建立了对等会话
- `PfxRcd`: Prefixes Received， 已接收前缀，从每个BGP邻居接收的路由前缀数量，这里为1表明每个节点一条路由前缀
- `PfxAcc`: Prefixes Accepted, 通过路由过滤并被路由表接受的已接收前缀数量，这里为1表明每个节点接受一条前缀
每一个kubernetes节点都在通告相同的负载均衡器CIDR `172.16.0.240/28`，确认所有节点都可以作为LoadBalancer服务流量的下一跳。`State: Estab` 表明BGP会话健康，路由交换正常。

### 配置多路径(multi-path)
默认情况下，cEOS容器并未配置支持等价成本多路径路由功能。可以通过一下配置启用该功能。
```bash
config t
router bgp 65001
  maximum-paths 4
```

这将配置ECMP功能，并为学习到的BGP前缀添加最多四条路由。让我们再次查看路由表，已确认设置是否已经生效

```bash
ceos(config-router-bgp)#show ip route 

VRF: default
Source Codes:
       C - connected, S - static, K - kernel,
       O - OSPF, O IA - OSPF inter area, O E1 - OSPF external type 1,
       O E2 - OSPF external type 2, O N1 - OSPF NSSA external type 1,
       O N2 - OSPF NSSA external type2, O3 - OSPFv3,
       O3 IA - OSPFv3 inter area, O3 E1 - OSPFv3 external type 1,
       O3 E2 - OSPFv3 external type 2,
       O3 N1 - OSPFv3 NSSA external type 1,
       O3 N2 - OSPFv3 NSSA external type2, B - Other BGP Routes,
       B I - iBGP, B E - eBGP, R - RIP, I L1 - IS-IS level 1,
       I L2 - IS-IS level 2, A B - BGP Aggregate,
       A O - OSPF Summary, NG - Nexthop Group Static Route,
       V - VXLAN Control Service, M - Martian,
       DH - DHCP client installed default route,
       DP - Dynamic Policy Route, L - VRF Leaked,
       G  - gRIBI, RC - Route Cache Route,
       CL - CBF Leaked Route

Gateway of last resort is not set

 C        10.10.10.0/24
           directly connected, Vlan10
 B E      172.16.0.240/28 [200/0]
           via 10.10.10.10, Vlan10
           via 10.10.10.11, Vlan10
           via 10.10.10.12, Vlan10
 C        172.20.20.0/24
           directly connected, Management0
```
在使用 `maximum-paths 4` 启用 ECMP 后，路由表现在为负载均衡器 CIDR 显示了多个下一跳：
- 多个通过路径的入口：同一个前缀 `172.16.0.240/28` 现在可以通过三个 Kubernetes 节点（10.10.10.10、10.10.10.11、10.10.10.12）达到，且这些路径的传输成本相同。
- 负载分配：所有指向 LoadBalancer 服务的流量都将分布在三个节点上，从而实现冗余和负载共享。
- 高可用性：如果任何一个节点发生故障，系统会自动将其他健康的节点作为转接节点来承载流量。
这种 ECMP 配置能够确保从外部来源访问 LoadBalancer 服务时，流量分配既合理又具有弹性。

### 验证连接性
以上配置完成之后，我们验证下从cEOS容器到 nginx服务的连通性。
```bash
ceos(config-router-bgp)#telnet 172.16.0.241 80
Trying 172.16.0.241...
Connected to 172.16.0.241.
Escape character is 'off'.
get
HTTP/1.1 400 Bad Request
Server: nginx/1.30.5
Date: Fri, 09 Oct 2026 06:07:03 GMT
Content-Type: text/html
Content-Length: 157
Connection: close

<html>
<head><title>400 Bad Request</title></head>
<body>
<center><h1>400 Bad Request</h1></center>
<hr><center>nginx/1.30.5</center>
</body>
</html>
Connection closed by foreign host.
ceos(config-router-bgp)#
```

```bash
ceos(config-router-bgp)#show ip bgp 172.16.0.240/28
BGP routing table information for VRF default
Router identifier 10.10.10.1, local AS number 65001
BGP routing table entry for 172.16.0.240/28
 Paths: 3 available
  65010
    10.10.10.10 from 10.10.10.10 (10.10.10.10)
      Origin IGP, metric 0, localpref 100, IGP metric 0, weight 0, tag 0
      Received 01:02:51 ago, valid, external, ECMP head, ECMP, best, ECMP contributor
      Rx path id: 0x2
      Rx SAFI: Unicast
  65010
    10.10.10.11 from 10.10.10.11 (10.10.10.11)
      Origin IGP, metric 0, localpref 100, IGP metric 0, weight 0, tag 0
      Received 01:02:51 ago, valid, external, ECMP, ECMP contributor
      Rx path id: 0x2
      Rx SAFI: Unicast
  65010
    10.10.10.12 from 10.10.10.12 (10.10.10.12)
      Origin IGP, metric 0, localpref 100, IGP metric 0, weight 0, tag 0
      Received 01:02:51 ago, valid, external, ECMP, ECMP contributor
      Rx path id: 0x2
      Rx SAFI: Unicast
```
该输出确定了我们收到了来自nginx Pod的相应，下面的图片展示了这个实验中配置的内容概览。
![[Pasted image 20261009140806.png]]

## 总结
这个实验展示了如何将Calico BGP与LoadBalancer服务的集成，已提供对kubernetes工作负载的外部连接能力。整个设置包括为LoadBalancer服务创建一个专用的IP地址池，配置与服务CIDR相关的BGP通告，以及启用ECMP路由以实现高可用性和负载分发。
- LoadBalancer IP Pool: 使用Calico的IPAM功能，为负载均衡器分配一个专用的CIDR块(`172.16.0.240/28`)用于IP地址分配
- BGP Service Advertisement: 修改BGP配置，以便将LoadBalancer服务的CIDR地址通告给上游网络基础设施
- ECMP 配置：在上游交换机上启用等效成本多路径路由机制，以实现流量在所有Kubernetes节点上均匀分布
- 外部连接性：已成功验证从外部源到kubernetes服务的端到端连接性

**优势**
- 高可用性：即使某些节点发生故障，多个等效路径也能确保服务的正常运行
- 负载分配：流量会自动分配到所有可用的kubernetes节点上
- 原生路由：对于外部与Pod之间的通信，无需使用overlay封装技术
- 基础设施集成：通过标准的BGP协议，与现有基础网络设置实现无缝集成。

这种方案能够在利用现有网络基础设施的同时，为 Kubernetes 服务提供高质量的外部访问能力，同时还具备内置的冗余机制和负载均衡功能。


















