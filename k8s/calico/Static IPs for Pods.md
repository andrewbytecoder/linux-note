calico支持使用 IPAM组件为kubernetes中的Pod分配静态IP地址，这些功能是通过Pod注解来实现的。
默认情况下下，kubernetes中的Pod需要从CNI哪里获取动态分配的IP地址。不过，某些应用场景需要稳定且可预测的IP地址。
- 旧版本应用程序集成：哪些需要将特定IP地址列入白明代的应用程序
- External DNS RecordsL 创建直接指向各个Pod的DNS条目
- 调试与监控：更便于在日志中识别特定的容器
- Stateful Workloads: 那些需要保持一致的网络身份的应用程序

## Calico 静态IP分配的原理是什么
calico允许你通过注释为某个Pod指定一个静态IP地址
```yaml
metadata:
  annotations:
    cni.projectcalico.org/ipAddrs: "[\"192.168.1.100\"]"
```
要求：
- 该IP地址必须位于已配置的Calico IPPool范围内
- 该IP当前不得被其他Pod所使用
- 在创建Pod时，必须添加该注释(之后添加无效)

## 清单文件

### static ip
```yaml
---
# Pod with static IP using Calico annotation
apiVersion: v1
kind: Pod
metadata:
  name: static-pod
  labels:
    app: static-pod
# 使用calico 指定的注解进行 静态 IP的设置
  annotations:
    cni.projectcalico.org/ipAddrs: "[\"192.168.100.10\"]"
spec:
  containers:
  - name: busybox
    image: busybox:1.36
    command: ["sleep", "3600"]

```

### 预留IP段
```yaml
---
# IPReservation to reserve a range of IPs from automatic assignment
# These IPs can still be used for static assignments via annotations
# /29 = 8 IPs (192.168.100.8 - 192.168.100.15)
apiVersion: crd.projectcalico.org/v1
kind: IPReservation
metadata:
  name: reserved-ips
spec:
  reservedCIDRs:
  - 192.168.100.8/29
```


## 环境检查
### 查看网络topo图
```bash
> containerlab inspect -t k01.clab.yaml
11:59:58 INFO Parsing & checking topology file=k01.clab.yaml
╭───────────────────┬──────────────────────┬─────────┬───────────────────────╮
│        Name       │      Kind/Image      │  State  │     IPv4/6 Address    │
├───────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane │ k8s-kind             │ running │ 172.21.0.2            │
│                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├───────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker        │ k8s-kind             │ running │ 172.21.0.3            │
│                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
╰───────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

### 查看IP地址池
```bash
> kubectl get ippools -o custom-columns='NAME:.metadata.name,CIDR:.spec.cidr'
NAME                  CIDR
default-ipv4-ippool   192.168.0.0/16
```

### 查看IP地址预留的情况
部署脚本已经使用 tools/04-ip-reservation.yaml▸为 `192.168.100.8/29` 地址段预定了 IP 地址（共 8 个 IP 地址：192.168.100.8-192.168.100.15）。这样一来，Calico 就无法自动分配该地址段内的 IP 地址了，这些 IP 地址将保留下来，用于静态分配。

```bash
> kubectl get ipreservations
NAME           CREATED AT
reserved-ips   2026-10-20T03:46:54Z
> kubectl get ipreservations reserved-ips -o yaml
apiVersion: projectcalico.org/v3
kind: IPReservation
metadata:
  name: reserved-ips
spec:
  reservedCIDRs:
  - 192.168.100.8/29
```
>`192.168.100.8/29` 网络段中的IP地址(`192.168.100.8-15`) 已经被预留，不会自动分配给Pod。这些IP地址仍可用于手动分配给特定的设备。

### 验证动态生成的 Pod 是否拥有位于预留范围之外的 IP 地址
在设置过程中，动态容器Pod被部署之后，可以看到该容器的IP地址并不在预定的 `192.168.100.8/29` 范围内：
```bash
> kubectl get pod dynamic-pod -o wide
NAME          READY   STATUS    RESTARTS   AGE   IP              NODE         NOMINATED NODE   READINESS GATES
dynamic-pod   1/1     Running   0          22m   192.168.81.72   k01-worker   <none>           <none>
```
关键观察：该容器从 `192.168.0.0/16` 地址池中随机获取 IP 地址，而不会从预保留的 `192.168.100.8/29` 地址范围内获取 IP 地址。

### 部署具有静态IP的Pod
我们使用带有注释的Yaml来部署一个具有固定IP地址的Pod
```bash
> kubectl apply -f tools/02-static-pod.yaml
pod/static-pod created
> kubectl get pod
NAME          READY   STATUS    RESTARTS   AGE
dynamic-pod   1/1     Running   0          24m
static-pod    1/1     Running   0          5s
> kubectl get pod static-pod -o wide
NAME         READY   STATUS    RESTARTS   AGE   IP               NODE         NOMINATED NODE   READINESS GATES
static-pod   1/1     Running   0          19s   192.168.100.10   k01-worker   <none>           <none>
```
关键观察结果：该虚拟机确实获得了我们指定的 IP 地址： `192.168.100.10` （属于预留的 IP 地址范围）

### 验证静态IP地址的标注是否正确
让我们检查下Pod的注解，确认设置是否正确
```bash
> kubectl get pod static-pod -o jsonpath='{.metadata.annotations}'|jq .
{
  "cni.projectcalico.org/containerID": "21a73010ae008376ff0402f6ef3b65f98010eb6c157cc34a3dda781ce61b4685",
  "cni.projectcalico.org/ipAddrs": "[\"192.168.100.10\"]",
  "cni.projectcalico.org/podIP": "192.168.100.10/32",
  "cni.projectcalico.org/podIPs": "192.168.100.10/32",
}
```

### 测试静态IP的连接性
确认其他Pod能访问该静态IP地址:
```bash
> kubectl get pod -o wide
NAME          READY   STATUS    RESTARTS        AGE    IP               NODE         NOMINATED NODE   READINESS GATES
dynamic-pod   1/1     Running   2 (31m ago)     151m   192.168.81.72    k01-worker   <none>           <none>
static-pod    1/1     Running   2 (7m22s ago)   127m   192.168.100.10   k01-worker   <none>           <none>
> kubectl exec -it dynamic-pod -- ping -c 3 192.168.100.10
PING 192.168.100.10 (192.168.100.10): 56 data bytes
64 bytes from 192.168.100.10: seq=0 ttl=63 time=0.081 ms
64 bytes from 192.168.100.10: seq=1 ttl=63 time=0.047 ms
64 bytes from 192.168.100.10: seq=2 ttl=63 time=0.047 ms

--- 192.168.100.10 ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.047/0.058/0.081 ms
```

### 尝试使用已经被分配的IP地址
让我们看看，我们定义一个Yaml来再次尝试创建另外一个拥有相同静态IP的Pod，会发生什么情况吧
```bash
> kubectl apply -f tools/03-duplicate-ip-pod.yaml
pod/duplicate-pod created
```
```bash
> kubectl get pod
NAME            READY   STATUS              RESTARTS      AGE
duplicate-pod   0/1     ContainerCreating   0             11s
dynamic-pod     1/1     Running             2 (35m ago)   155m
static-pod      1/1     Running             2 (10m ago)   130m
> kubectl describe pod duplicate-pod|grep -aA5 Events
Events:
  Type     Reason                  Age   From               Message
  ----     ------                  ----  ----               -------
  Normal   Scheduled               81s   default-scheduler  Successfully assigned default/duplicate-pod to k01-worker
  Warning  FailedCreatePodSandBox  81s   kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "80122f6b9cbd03e0e29c52afee1204cc6136a0b3e5e1f42182dd69d9f54ceb0e": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  80s   kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "b78b1cb490fe081949219ff6f1ead7b809b92e4e18f32196a6b894fbf0c5fca0": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
```
该容器会长时间停留在 `ContainerCreating` 状态，因为该IP地址已经被占用

```bash
> kubectl describe pod duplicate-pod|tail -10
  Warning  FailedCreatePodSandBox  2m35s              kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "80122f6b9cbd03e0e29c52afee1204cc6136a0b3e5e1f42182dd69d9f54ceb0e": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  2m34s              kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "b78b1cb490fe081949219ff6f1ead7b809b92e4e18f32196a6b894fbf0c5fca0": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  2m18s              kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "b37764f468ad7a6c6af8cec673412067d7201143d46b94cb90417266e0a36255": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  2m4s               kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "e788dcd0fe38e221559db6e59271068c989c05c32f5cbf2385743949cd84ecce": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  110s               kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "05b601139d2314d83e8c282eba3a477a551c6bce09f60a14e08b8001702d340f": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  95s                kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "3096bea288b7367af88ac0ad9391e6f26ac64c31f555b3cdb8153a0552085bf2": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  80s                kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "1ce9d1fdcbff4121ddc910ae4a20f7665b244c2c62597bac6bab0e1b66404244": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  68s                kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "50dfe2d6400b319c3fcd251ed1cdf7e3b6ddacdae5bd81459ee21cc13f401d13": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  53s                kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "295c486550b55826654d7ee501b4da109ada7cfed24da040607e104ebcaceb68": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
  Warning  FailedCreatePodSandBox  10s (x3 over 39s)  kubelet            (combined from similar events): Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "9aaa4cb12a861140a81141560cfd4d5c9aa5c9a59b933ad237f9d841aabb785c": plugin type="calico" failed (add): error getting IP from IPAM: resource already exists: 192.168.100.10
~/calico-containerlab/16-static-ip >  
```

清理掉失败的容器
```bash
> kubectl delete pod duplicate-pod
pod "duplicate-pod" deleted
```

### 删除并重新创建具有相同静态IP的Pod
静态IP地址在Pod被删除或重新创建后仍然保持不变

```bash
> kubectl get pod -o wide
NAME          READY   STATUS    RESTARTS      AGE    IP               NODE         NOMINATED NODE   READINESS GATES
dynamic-pod   1/1     Running   2 (41m ago)   161m   192.168.81.72    k01-worker   <none>           <none>
static-pod    1/1     Running   0             6s     192.168.100.10   k01-worker   <none>           <none>
> kubectl delete pod static-pod
pod "static-pod" deleted
> kubectl apply -f tools/02-static-pod.yaml
pod/static-pod created
> kubectl wait --for=condition=ready pod/static-pod --timeout=60s
pod/static-pod condition met
> 
> kubectl get pod -o wide
NAME          READY   STATUS    RESTARTS      AGE    IP               NODE         NOMINATED NODE   READINESS GATES
dynamic-pod   1/1     Running   2 (43m ago)   163m   192.168.81.72    k01-worker   <none>           <none>
static-pod    1/1     Running   0             58s    192.168.100.10   k01-worker   <none>           <none>
```
我们删除 `static-pod` 并且再次创建它，观察发现，该pod再次创建的时候获取的静态IP依旧是 `192.168.100.10`

## 总结
|Aspect|Dynamic IP|Static IP|
|---|---|---|
|Configuration|None (default)|Pod annotation|
|IP Selection|Automatic from pool|User-specified|
|Persistence|Changes on pod restart|Same IP on recreation|
|Use Case|General workloads|Legacy integration|
- 先进行预留：在分配静态Ip地址之前，请使用IPReservation来预先预留IP地址范围
- 简单注释：使用 `cni.projectcalico.org/ipAddrs` 注释来分配静态IP地址
- IP地址池要求：静态IP必须位于已配置的IP池范围内
- 唯一性：每个静态IP地址在同一时间只能被一个Pod使用
- 在应用创建时：在创建Pod时，必须包含相关的注释信息


















