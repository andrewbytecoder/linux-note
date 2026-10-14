网络服务质量-带宽限制
在本模块中，你将学习如何使用 Calico 网络策略（NetworkPolicy）限制 Pod 和/或命名空间的带宽。

## Calico Network QoS - Bandwidth Limiting(Calico 网络 QoS -- 带宽限制)
本实验演示如何使用 Calico 内置的注解（annotations）实现服务质量（QoS，Quality of Service）带宽限制。你将把带宽限制应用到 Pod 和命名空间上，并使用 iperf3 验证实际的带宽限速效果。

## 概述

在多租户的kubernetes环境中，单个容器可能会消耗过多的网络带宽，从而导致其他工作负载陷入困境。因此，采用QoS带宽限制功能是非常必要的。
- Resource Fairness: 资源公平分配，避免出现噪声邻居现象，即一个节点独占带宽的情况
- 成本控制：为那些不需要消耗大量网络资源的工作负载限制带宽使用量
- 性能隔离：确保关键服务能够获得所需的带宽资源
- SLA Enforcement: SLA执行，针对每个租户或应用程序层，强制执行带宽限制。

calico 通过 Pod 和命名空间注解提供网络带宽限制。这在以下场景中非常有用：
- Multi-tenant environments(多租户环境)：限制每个租户可以消耗的带宽
- 成本控制：防止任何一个Pod或命名空间占满整个网络带宽
- 应用级别 QoS：为关键应用保障最低带宽
- 限速：防止网络滥用和意外 突发流量

Calico使用以下Linux内核特性实现QoS：
- Ingress(入站方向)：使用tcd(tc的调度器)限制入站流量。
- Egress(出站方向)：使用挂载在Pod的veth结构上的令牌过滤器(TBF: Token Bucket Filter)来限制出站流量。

>注意： 带宽限制是一种尽力而为-best effort的机制。在极少数情况下，由于底层Linux流量控制(traffic control)实现的特性，他可能无法做到100%精确。

## Calico QoS是如何工作的
Calico 通过在Pod或命名空间上设置注释来实现对应用的带宽限制：
1. Pod-level: 直接给Pod添加注释
2. 命名空间级别：给命名空间添加注释，以对其中所有Pod应用限制

Calico 会读取这些注解，并在每个 Pod 的 veth 接口上编程相应的内核 QoS 机制（出站方向使用 TBF，入站方向使用 tcd）。

|Annotation  注释/说明|Description  描述|
|---|---|
|`qos.projectcalico.org/ingressBandwidth`|Limits incoming traffic to the pod  <br>限制进入节点的入站流量|
|`qos.projectcalico.org/egressBandwidth`|Limits outgoing traffic from the pod  <br>限制从节点发出的流量|
数值单位可以使用后缀 k(kilobits), M(megabits), G(gigabits)

eg.
```yaml
metadata: 
  annotations: 
    qos.projectcalico.org/ingressBandwidth: "10M" 
    qos.projectcalico.org/egressBandwidth: "10M"
```

在底层，Calico 使用 Linux 流量控制技术（tc）和令牌桶过滤器（TBF）排队机制，来对容器虚拟以太网接口实施这些限制。

![[qos.png]]


## 资源清单

### iperf-server
```yaml
---
# iperf3 server without QoS limits (baseline test)
apiVersion: v1
kind: Pod
metadata:
  name: iperf-server
  labels:
    app: iperf-server
spec:
  containers:
  - name: iperf-server
    image: networkstatic/iperf3
    command: ["iperf3", "-s"]
    ports:
    - containerPort: 5201
      protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: iperf-server
spec:
  selector:
    app: iperf-server
  ports:
  - port: 5201
    targetPort: 5201
    protocol: TCP
```


### iperf-client
```yaml
---
# iperf3 client without QoS limits (baseline test)
apiVersion: v1
kind: Pod
metadata:
  name: iperf-client
  labels:
    app: iperf-client
spec:
  containers:
  - name: iperf-client
    image: networkstatic/iperf3
    command: ["sleep", "infinity"]
```

### iperf-server-qos
```yaml
---
# iperf3 server WITH QoS bandwidth limits
apiVersion: v1
kind: Pod
metadata:
  name: iperf-server-qos
  labels:
    app: iperf-server-qos
  annotations:
    # Calico QoS annotations - limit bandwidth to 10 Mbps
    qos.projectcalico.org/ingressBandwidth: "10M"
    qos.projectcalico.org/egressBandwidth: "10M"
spec:
  containers:
  - name: iperf-server
    image: networkstatic/iperf3
    command: ["iperf3", "-s"]
    ports:
    - containerPort: 5201
      protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: iperf-server-qos
spec:
  selector:
    app: iperf-server-qos
  ports:
  - port: 5201
    targetPort: 5201
    protocol: TCP
```

### iperf-client-qos
```yaml
---
# iperf3 client WITH QoS bandwidth limits
apiVersion: v1
kind: Pod
metadata:
  name: iperf-client-qos
  labels:
    app: iperf-client-qos
  annotations:
    # Calico QoS annotations - limit bandwidth to 10 Mbps
    qos.projectcalico.org/ingressBandwidth: "10M"
    qos.projectcalico.org/egressBandwidth: "10M"
spec:
  containers:
  - name: iperf-client
    image: networkstatic/iperf3
    command: ["sleep", "infinity"]
```

## 环境检查
### 网络topo
```bash
> containerlab inspect -t calico-qos.clab.yaml
19:59:31 INFO Parsing & checking topology file=calico-qos.clab.yaml
╭──────────────────────────┬──────────────────────┬─────────┬───────────────────────╮
│           Name           │      Kind/Image      │  State  │     IPv4/6 Address    │
├──────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ calico-qos-control-plane │ k8s-kind             │ running │ 172.21.0.3            │
│                          │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├──────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ calico-qos-worker        │ k8s-kind             │ running │ 172.21.0.2            │
│                          │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
╰──────────────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

### 验证Nodes和Pods
```bash
> kubectl get nodes
NAME                       STATUS   ROLES           AGE    VERSION
calico-qos-control-plane   Ready    control-plane   167m   v1.35.0
calico-qos-worker          Ready    <none>          167m   v1.35.0
> kubectl get pods -o wide
NAME           READY   STATUS    RESTARTS   AGE    IP               NODE                NOMINATED NODE   READINESS GATES
iperf-client   1/1     Running   0          160m   192.168.183.73   calico-qos-worker   <none>           <none>
iperf-server   1/1     Running   0          160m   192.168.183.72   calico-qos-worker   <none>           <none>
```



### 带宽测试(No QoS Limits)
```bash
> kubectl exec -it iperf-client -- iperf3 -c iperf-server -t 5
Connecting to host iperf-server, port 5201
[  5] local 192.168.183.73 port 40536 connected to 10.96.149.170 port 5201
[ ID] Interval           Transfer     Bitrate         Retr  Cwnd
[  5]   0.00-1.00   sec  5.91 GBytes  50.7 Gbits/sec    0    534 KBytes       
[  5]   1.00-2.00   sec  5.83 GBytes  50.0 Gbits/sec    0    718 KBytes       
[  5]   2.00-3.00   sec  5.87 GBytes  50.4 Gbits/sec    0    718 KBytes       
[  5]   3.00-4.00   sec  5.33 GBytes  45.8 Gbits/sec    0    718 KBytes       
[  5]   4.00-5.00   sec  5.22 GBytes  44.8 Gbits/sec    0    796 KBytes       
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate         Retr
[  5]   0.00-5.00   sec  29.9 GBytes  51.4 Gbits/sec    0            sender
[  5]   0.00-5.00   sec  29.9 GBytes  51.4 Gbits/sec                  receiver

iperf Done.
```
关键观察结果：如果没有 QoS 限制，带宽会非常高（在容器化环境中通常可以达到数 Gbps），因为不存在限制。


### 带宽测试(QoS Limits)
启动iperf测试相关服务
```bash
> cd tools
> ls
01-iperf-server.yaml  02-iperf-client.yaml  03-iperf-server-qos.yaml  04-iperf-client-qos.yaml
> kubectl apply -f .
pod/iperf-server unchanged
service/iperf-server unchanged
pod/iperf-client unchanged
pod/iperf-server-qos created
service/iperf-server-qos created
pod/iperf-client-qos created
> kubectl get pod
NAME               READY   STATUS    RESTARTS   AGE
iperf-client       1/1     Running   0          162m
iperf-client-qos   1/1     Running   0          4s
iperf-server       1/1     Running   0          162m
iperf-server-qos   1/1     Running   0          4s
~/calico-containerlab/12-calico-qos/tools > 
```

确认QoS应用成功
```bash
> kubectl get pod iperf-server-qos -o jsonpath='{.metadata.annotations}' | jq .
{
  "cni.projectcalico.org/containerID": "0269d37fa81913041d5560b0758f37b8944b53afbaba20663a4e4e5ebc10c3ab",
  "cni.projectcalico.org/podIP": "192.168.183.74/32",
  "cni.projectcalico.org/podIPs": "192.168.183.74/32",
  "kubectl.kubernetes.io/last-applied-configuration": "{\"apiVersion\":\"v1\",\"kind\":\"Pod\",\"metadata\":{\"annotations\":{\"qos.projectcalico.org/egressBandwidth\":\"10M\",\"qos.projectcalico.org/ingressBandwidth\":\"10M\"},\"labels\":{\"app\":\"iperf-server-qos\"},\"name\":\"iperf-server-qos\",\"namespace\":\"default\"},\"spec\":{\"containers\":[{\"command\":[\"iperf3\",\"-s\"],\"image\":\"networkstatic/iperf3\",\"imagePullPolicy\":\"IfNotPresent\",\"name\":\"iperf-server\",\"ports\":[{\"containerPort\":5201,\"protocol\":\"TCP\"}]}]}}\n",
  "qos.projectcalico.org/egressBandwidth": "10M",
  "qos.projectcalico.org/ingressBandwidth": "10M"
}
```

## 在QoS限制情况下进行测试
```bash
> kubectl exec -it iperf-client-qos -- iperf3 -c iperf-server-qos -t 5
Connecting to host iperf-server-qos, port 5201
[  5] local 192.168.183.75 port 51368 connected to 10.96.161.246 port 5201
[ ID] Interval           Transfer     Bitrate         Retr  Cwnd
[  5]   0.00-1.00   sec   130 MBytes  1.09 Gbits/sec    0    653 KBytes       
[  5]   1.00-2.00   sec  1.25 MBytes  10.5 Mbits/sec    0    653 KBytes       
[  5]   2.00-3.00   sec  1.38 MBytes  11.5 Mbits/sec    0    653 KBytes       
[  5]   3.00-4.00   sec  1.38 MBytes  11.5 Mbits/sec    0    653 KBytes       
[  5]   4.00-5.00   sec  1.38 MBytes  11.5 Mbits/sec    0    653 KBytes       
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate         Retr
[  5]   0.00-5.00   sec   135 MBytes   226 Mbits/sec    0            sender
[  5]   0.00-5.06   sec   131 MBytes   218 Mbits/sec                  receiver

iperf Done.
```
您可能会注意到，在最初的几秒钟内，带宽较高（约 1.09 Gbps），之后逐渐降至 11.5 Mbps。这种现象是正常的，因为令牌桶过滤器（Token Bucket Filter, TBF）的工作机制就是如此。

TBF qdisc 机制包含一个“突发”参数（ `burst 10Mb` ）。该参数允许在令牌桶未耗尽之前，以全速处理短期的突发流量。这是经过精心设计的：这样做既能提升像网络请求这类具有突发性的数据的传输效率，同时又能确保整体流量不会超出长期限制。

| Test  测试                          | Sustained Bandwidth  持续带宽 | Notes  备注                                                                                   |
| --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| Without QoS  没有服务质量保障             | ~50+ Gbps                 | No restrictions, maximum available  <br>没有限制，资源使用无上限                                        |
| With QoS (10M)  凭借 QoS 功能（1100 万） | ~11 Mbps                  | Limited by Calico QoS annotations (after initial burst)  <br>受《Calico QoS 规范》的约束（在初始流量高峰过后） |

```
Bandwidth
    ^
300 |  ████                        Without QoS: Constant high bandwidth
    |  ████
 50 |
 10 |       ████ ████ ████ ████   With QoS: Limited after burst
  0 |______________________________> Time
       0s   1s   2s   3s   4s   5s
        ↑
      Burst
```


## 总结


| Aspect  方面/角度      | Without QoS  没有服务质量保障                | With QoS  通过 QoS 机制                           |     |
| ------------------ | ------------------------------------ | --------------------------------------------- | --- |
| Configuration  配置  | None  没有                             | Simple pod annotations  简单的 Pod 注释            |     |
| Bandwidth  带宽      | Unrestricted (~Gbps)  无限制（约 Gbps 级别） | Limited (~10 Mbps)  带宽有限（约 10 Mbps）           |     |
| Implementation  实施 | N/A  无具体内容可供翻译。                      | Linux tc with TBF  基于 Linux 的 TC 系统，附带 TBF 功能 |     |
| Use Case  使用场景     | Default pods  默认 Pod                 | Multi-tenant, cost control  <br>多租户模式，成本可控    | 、   |
**Key Takeaways:  关键要点：**

1. **Simple Configuration**: Just add annotations to pod metadata  
    简单配置：只需在 Pod 的元数据中添加注释即可
2. **Immediate Effect**: QoS is applied when the pod starts  
    即时效果：当节点开始运行时，就会应用服务质量相关设置。
3. **Per-Pod Granularity**: Each pod can have different limits  
    容器粒度：每个容器可以拥有不同的限制条件
4. **Linux tc Based**: Uses proven kernel traffic shaping  
    基于 Linux TCP 协议：采用经过验证的内核流量控制技术


### 额外的QoS控制选项
| Annotation  注释/说明                      | Description  描述                                                |
| -------------------------------------- | -------------------------------------------------------------- |
| `qos.projectcalico.org/ingressPackets` | Limit incoming packets per second  <br>每秒允许进入的数据包数量有限          |
| `qos.projectcalico.org/egressPackets`  | Limit outgoing packets per second  <br>每秒允许发送的数据包数量有限          |
| `qos.projectcalico.org/dscp`           | Set DSCP value for traffic prioritization  <br>为流量优先级设置 DSCP 值 |