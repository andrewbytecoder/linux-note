在每个节点上运行DNS缓存代理来可以提升Kubernetest环境中的DNS性能。你将手动部署NodeLocal DNSCache，并了解透明代理机制的工作机制。

## 概述
在标准的kubernetes DNS架构中，所有来自Pod的DNS查询都会被发送到CoreDNs服务(kube-dns)进行处理。NodeLocal DNS缓存则能够解决这种架构带来的若干问题。
![[Pasted image 20261020152447.png]]
*延迟改善*
在当前的DNS架构中，哪些具有最高DNS查询处理能力的Pod，如果不存在本地kube-dns示例，就可能需要连接到另一个节点获取响应。在这种情况下，使用本地缓存可以帮助降低延迟，因为响应可以从同一个节点提供。

**conntrack 竞争条件**
跳过iptables中的DNAT操作和连接跟踪功能，有助于减少conntrack表的竞争现象，同时避免UDP DNS数据占用过多的conntrack表空间。这是繁忙的集群中DNS故障出现间歇性的常见原因。

*TCP连接处理*
从本地缓存代理到kube-dns的连接已升级为TCP协议。与UDP协议不同，TCP协议在连接关闭时会移除相关的contrack记录（默认超时时间30s）。这一改进能够降低conntrack表的压力。

*减低尾部延迟*
将DNS查询的传输协议从UDP升级为TCP后，因UDP数据包丢失导致的延迟以及DNS超时问题得到了有效缓解。如果没有NodeLocal DNS缓存，超时时间可能会达到30s(即尝试3次后仍无法完成查询)。由于NodeLocal 缓存会负载处理UDP DNS查询，因此应用程序无需进行任何修改。

*节点级指标*
NodeLocal DNSCache 提供节点级别的DNS请求相关指标和详细信息，这使得调试DNS问题以及监控每个节点的性能变得更加容易。

***Negative Caching***
可以启用 **Negative Caching** 使用NXDOMAIN响应，从而减少对不存在域名的重复查询。

| Benefit              | Description                                    |
| -------------------- | ---------------------------------------------- |
| **Local Cache**      | DNS responses served from the same node        |
| **No DNAT**          | Bypasses kube-proxy's iptables DNAT rules      |
| **No Conntrack**     | NOTRACK rules prevent conntrack table issues   |
| **TCP Upstream**     | Uses TCP to CoreDNS (faster conntrack cleanup) |
| **UDP to Pods**      | Pods still use UDP (no app changes needed)     |
| **Per-Node Metrics** | Prometheus metrics per node                    |
| **Negative Caching** | NXDOMAIN responses cached locally              |

[administer-cluster-nodelocaldns](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/)

>注意：高 DNS 查询每秒次数通常不是由“不良应用程序”引起的，而是由于并发处理、系统扩展性、重试机制以及启动过程中的同步问题导致的。NodeLocal DNS 缓存的存在，正是因为 Kubernetes 能够同时处理所有这些因素。

## NodeLocal DNSCache 的工作原理（iptables 模式）
当 kube-proxy 以 iptables 模式运行时，NodeLocal DNSCache 会使用透明代理方式进行处理。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Without NodeLocal DNSCache                                                  │
│                                                                              │
│  ┌─────────┐      10.96.0.10:53       ┌─────────────┐                       │
│  │   Pod   │ ────────────────────────►│   CoreDNS   │  (remote pod)         │
│  └─────────┘   (network traversal)    └─────────────┘                       │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  With NodeLocal DNSCache (iptables mode)                                     │
│                                                                              │
│  ┌─────────┐      10.96.0.10:53       ┌──────────────────┐                  │
│  │   Pod   │ ────────────────────────►│ NodeLocal DNS    │  (same node!)    │
│  └─────────┘   (routed locally!)      │ Cache            │                  │
│                                       │                  │                  │
│                 Pod's resolv.conf     │ Binds locally:   │  cache miss      │
│                 still shows:          │ • 10.96.0.10  ◄──┼─────────────►    │
│                 nameserver 10.96.0.10 │ • 169.254.20.10  │    CoreDNS       │
│                                       └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

透明拦截工作原理：
1. 虚拟接口创建：NodeLocal DNSCache 在每个节点上创建一个虚拟接口 (`nodelocaldns`)
2. IP绑定：代理将Kube-dns集群的ClusterIP (`10.96.0.10`)直接绑定到这个本地接口上
3. 本地路由：对那个一个Pod像 `10.96.0.10` 发送DNS查询时，Linux内核会找到与此IP关联的本地接口，并将其路由到本地网络
4. 对于Pods来说完全是透明的：Pods不需要进行任何配置更改，它们仍然可以使用 `10.96.0.10` 作为名称服务器
5. 上游服务：为处理缓存缺失的情况，专门建立了名为 `kube-dns-upstream` 的服务

![[Pasted image 20261021135126.png]]

## 清单文件

### nodelocaldns.yaml
```yaml
# Copyright 2018 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

apiVersion: v1
kind: ServiceAccount
metadata:
  name: node-local-dns
  namespace: kube-system
  labels:
    kubernetes.io/cluster-service: "true"
    addonmanager.kubernetes.io/mode: Reconcile
---
apiVersion: v1
kind: Service
metadata:
  name: kube-dns-upstream
  namespace: kube-system
  labels:
    k8s-app: kube-dns
    kubernetes.io/cluster-service: "true"
    addonmanager.kubernetes.io/mode: Reconcile
    kubernetes.io/name: "KubeDNSUpstream"
spec:
  ports:
  - name: dns
    port: 53
    protocol: UDP
    targetPort: 53
  - name: dns-tcp
    port: 53
    protocol: TCP
    targetPort: 53
  selector:
    k8s-app: kube-dns
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: node-local-dns
  namespace: kube-system
  labels:
    addonmanager.kubernetes.io/mode: Reconcile
data:
  Corefile: |
    __PILLAR__DNS__DOMAIN__:53 {
        errors
        cache {
                success 9984 30
                denial 9984 5
        }
        reload
        loop
        bind __PILLAR__LOCAL__DNS__ __PILLAR__DNS__SERVER__
        forward . __PILLAR__CLUSTER__DNS__ {
                force_tcp
        }
        prometheus :9253
        health __PILLAR__LOCAL__DNS__:8080
        }
    in-addr.arpa:53 {
        errors
        cache 30
        reload
        loop
        bind __PILLAR__LOCAL__DNS__ __PILLAR__DNS__SERVER__
        forward . __PILLAR__CLUSTER__DNS__ {
                force_tcp
        }
        prometheus :9253
        }
    ip6.arpa:53 {
        errors
        cache 30
        reload
        loop
        bind __PILLAR__LOCAL__DNS__ __PILLAR__DNS__SERVER__
        forward . __PILLAR__CLUSTER__DNS__ {
                force_tcp
        }
        prometheus :9253
        }
    .:53 {
        errors
        cache 30
        reload
        loop
        bind __PILLAR__LOCAL__DNS__ __PILLAR__DNS__SERVER__
        forward . __PILLAR__UPSTREAM__SERVERS__
        prometheus :9253
        }
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-local-dns
  namespace: kube-system
  labels:
    k8s-app: node-local-dns
    kubernetes.io/cluster-service: "true"
    addonmanager.kubernetes.io/mode: Reconcile
spec:
  updateStrategy:
    rollingUpdate:
      maxUnavailable: 10%
  selector:
    matchLabels:
      k8s-app: node-local-dns
  template:
    metadata:
      labels:
        k8s-app: node-local-dns
      annotations:
        prometheus.io/port: "9253"
        prometheus.io/scrape: "true"
    spec:
      priorityClassName: system-node-critical
      serviceAccountName: node-local-dns
      hostNetwork: true
      dnsPolicy: Default  # Don't use cluster DNS.
      tolerations:
      - key: "CriticalAddonsOnly"
        operator: "Exists"
      - effect: "NoExecute"
        operator: "Exists"
      - effect: "NoSchedule"
        operator: "Exists"
      containers:
      - name: node-cache
        image: registry.k8s.io/dns/k8s-dns-node-cache:1.26.4
        resources:
          requests:
            cpu: 25m
            memory: 5Mi
        args: [ "-localip", "__PILLAR__LOCAL__DNS__,__PILLAR__DNS__SERVER__", "-conf", "/etc/Corefile", "-upstreamsvc", "kube-dns-upstream" ]
        securityContext:
          capabilities:
            add:
            - NET_ADMIN
        ports:
        - containerPort: 53
          name: dns
          protocol: UDP
        - containerPort: 53
          name: dns-tcp
          protocol: TCP
        - containerPort: 9253
          name: metrics
          protocol: TCP
        livenessProbe:
          httpGet:
            host: __PILLAR__LOCAL__DNS__
            path: /health
            port: 8080
          initialDelaySeconds: 60
          timeoutSeconds: 5
        volumeMounts:
        - mountPath: /run/xtables.lock
          name: xtables-lock
          readOnly: false
        - name: config-volume
          mountPath: /etc/coredns
        - name: kube-dns-config
          mountPath: /etc/kube-dns
      volumes:
      - name: xtables-lock
        hostPath:
          path: /run/xtables.lock
          type: FileOrCreate
      - name: kube-dns-config
        configMap:
          name: kube-dns
          optional: true
      - name: config-volume
        configMap:
          name: node-local-dns
          items:
            - key: Corefile
              path: Corefile.base
---
# A headless service is a service with a service IP but instead of load-balancing it will return the IPs of our associated Pods.
# We use this to expose metrics to Prometheus.
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/port: "9253"
    prometheus.io/scrape: "true"
  labels:
    k8s-app: node-local-dns
  name: node-local-dns
  namespace: kube-system
spec:
  clusterIP: None
  ports:
    - name: metrics
      port: 9253
      targetPort: 9253
  selector:
    k8s-app: node-local-dns
```

### netshoot
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dns-test
  namespace: default
spec:
  containers:
  - name: dns-test
    image: nicolaka/netshoot:latest
    command: ["sleep", "infinity"]

```


## 环境检查
### 检查网络topo

```bash
> containerlab inspect -t k01.clab.yaml
14:21:47 INFO Parsing & checking topology file=k01.clab.yaml
╭───────────────────┬──────────────────────┬─────────┬───────────────────────╮
│        Name       │      Kind/Image      │  State  │     IPv4/6 Address    │
├───────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane │ k8s-kind             │ running │ 172.21.0.4            │
│                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
├───────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker        │ k8s-kind             │ running │ 172.21.0.2            │
│                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├───────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2       │ k8s-kind             │ running │ 172.21.0.3            │
│                   │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
╰───────────────────┴──────────────────────┴─────────┴───────────────────────╯
```































































































































































