## kubernetes headless services
接下来我们来探究下kubernetes无头服务的工作原理，以及它们与普通ClusterIP服务的区别。无头服务无需使用虚拟IP地址，而是通过直接解析DNS到Pod的IP地址来实现通信。这种通信使得应用程序能够直接在同一集群内的不同Pod之间进行交互，因此对于需要持久化状态管理的应用程序来说，无头服务是非常重要的。

## 概述
在标准的kubernetes服务中，ClusterIP通过kube-proxy和稳定的VIP来实现负载均衡。不过，某些应用场景需要直接访问特定的Pod。
- Stateful Applications(状态化应用程序)：像Redis、MySQL、PostgreSQL、MongoDB 和 Cassandra这样的数据库需要客户端能够连接特定的实例副本(例如：主副本与备副本)
- Peer Discovery: 分布式系统（如kafka, Elasticsearch, etcd等）需要容器之间能够直接发现并相互通信
- Client-Side Load Balancing(): 哪些自己实现负载均衡逻辑的应用程序需要访问所有Pod的IP地址
- Service Mesh integration(服务网格集成)：某些服务网格倾向于直接使用Pod寻址，以实现细粒度的流量控制

| 特性（Feature）                 | ClusterIP 服务（ClusterIP Service） | 无头服务（Headless Service） |
| --------------------------- | ------------------------------- | ---------------------- |
| 虚拟 IP（VIP）                  | 有（`clusterIP: <IP>`）            | 无（`clusterIP: None`）   |
| DNS 解析（DNS Resolution）      | 返回服务 VIP                        | 直接返回 Pod IP            |
| 负载均衡（Load Balancing）        | 由 kube-proxy 处理                 | 由客户端处理或不做负载均衡          |
| iptables 规则（iptables Rules） | 由 kube-proxy 创建                 | 无（没有可做 NAT 的 VIP）      |
| 使用场景（Use Case）              | 通用服务发现                          | 有状态应用、对等节点发现           |

### 无头服务创建的DNS记录
无头服务根据工作负载类型创建不同的DNS记录：
使用StatefulSet时：
- A record: `<service>.<namespace>.svc.cluster.local` → 返回所有 Pod IP
- **每个 Pod 的 A 记录**：`<pod-name>.<service>.<namespace>.svc.cluster.local` → 返回特定 Pod 的 IP
- 示例：`redis-0.redis-headless.default.svc.cluster.local` → Pod IP

使用Deployment/ReplicaSet时：
- **A record**：`<service>.<namespace>.svc.cluster.local` → 返回所有 Pod IP
- 没有单个 Pod 的 DNS 记录（Pod 不具备稳定的身份标识）

## 资源清单

### 网络topo
```yaml
name: headless-services
topology:
  nodes:
    headless-services:
      kind: k8s-kind
      image: kindest/node:v1.35.0
      startup-config: headless-services-no-cni.yaml
      extras:
        k8s_kind:
          deploy:
            wait: 0s
```

### kind集群配置
```yaml
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
```

### Calico 配置
```yaml
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
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
```

### service配置

无头服务配置
```yaml
# Redis StatefulSet with Headless Service and Replication
# This demonstrates:
# 1. Pod-specific DNS records (redis-0.redis-headless, redis-1.redis-headless, etc.)
# 2. How Redis replicas discover and connect to the master using headless service DNS
# 
# Architecture:
# - redis-0: Master (primary) - accepts writes
# - redis-1, redis-2: Replicas - discover master via redis-0.redis-headless DNS
apiVersion: v1
kind: Service
metadata:
  name: redis-headless
  namespace: default
  labels:
    app: redis
spec:
  ports:
  - port: 6379
    name: redis
  # clusterIP: None makes this a headless service
  clusterIP: None
  selector:
    app: redis
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: default
spec:
  # serviceName must match the headless service name for DNS to work
  serviceName: "redis-headless"
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      terminationGracePeriodSeconds: 10
      initContainers:
      # Init container waits for DNS to be ready for replicas
      # This ensures redis-0 is discoverable before replicas start
      - name: init-redis
        image: redis:7-alpine
        command:
        - /bin/sh
        - -c
        - |
          set -ex
          # Extract pod ordinal from hostname (e.g., redis-0 -> 0)
          ORDINAL=${HOSTNAME##*-}
          
          # If this is a replica (ordinal > 0), wait for master to be available
          if [ "$ORDINAL" != "0" ]; then
            echo "This is replica redis-$ORDINAL, waiting for master redis-0..."
            until redis-cli -h redis-0.redis-headless.default.svc.cluster.local ping; do
              echo "Waiting for redis-0.redis-headless to be ready..."
              sleep 2
            done
            echo "Master redis-0 is ready!"
          else
            echo "This is the master redis-0, no need to wait"
          fi
        resources:
          requests:
            cpu: 10m
            memory: 16Mi
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: redis
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        # Redis configuration with dynamic master/replica setup
        # Replicas discover master using headless service DNS: redis-0.redis-headless
        command:
        - /bin/sh
        - -c
        - |
          set -ex
          # Extract pod ordinal from hostname (e.g., redis-0 -> 0)
          ORDINAL=${HOSTNAME##*-}
          
          if [ "$ORDINAL" = "0" ]; then
            # This is the master
            echo "Starting as MASTER (redis-0)"
            exec redis-server \
              --bind 0.0.0.0 \
              --protected-mode no \
              --replica-announce-ip ${POD_NAME}.redis-headless.default.svc.cluster.local
          else
            # This is a replica - connect to master using headless service DNS
            # KEY CONCEPT: Replicas discover master via: redis-0.redis-headless.default.svc.cluster.local
            echo "Starting as REPLICA (redis-$ORDINAL), replicating from redis-0.redis-headless"
            exec redis-server \
              --bind 0.0.0.0 \
              --protected-mode no \
              --replicaof redis-0.redis-headless.default.svc.cluster.local 6379 \
              --replica-announce-ip ${POD_NAME}.redis-headless.default.svc.cluster.local
          fi
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 15
          periodSeconds: 10
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
```

deployment类型服务
```yaml
# Deployment with both ClusterIP and Headless Services
# This demonstrates the difference in DNS resolution between the two types
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
        lifecycle:
          postStart:
            exec:
              command:
              - /bin/sh
              - -c
              - |
                echo "<html><body><h1>Deployment Pod: $(hostname)</h1><p>IP: $(hostname -i)</p></body></html>" > /usr/share/nginx/html/index.html
---
# Regular ClusterIP Service - for comparison
apiVersion: v1
kind: Service
metadata:
  name: nginx-clusterip
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
  # Default type is ClusterIP - gets a VIP
  type: ClusterIP
---
# Headless Service for the same Deployment
apiVersion: v1
kind: Service
metadata:
  name: nginx-headless
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
  # clusterIP: None makes this a headless service
  clusterIP: None
```

## 环境检查

### 检查containerlab topo结构
```bash
> containerlab inspect -t headless-services.clab.yaml
22:09:39 INFO Parsing & checking topology file=headless-services.clab.yaml
╭─────────────────────────────────┬──────────────────────┬─────────┬───────────────────────╮
│               Name              │      Kind/Image      │  State  │     IPv4/6 Address    │
├─────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ headless-services-control-plane │ k8s-kind             │ running │ 172.18.0.3            │
│                                 │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├─────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ headless-services-worker        │ k8s-kind             │ running │ 172.18.0.2            │
│                                 │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├─────────────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ headless-services-worker2       │ k8s-kind             │ running │ 172.18.0.4            │
│                                 │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
╰─────────────────────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

### 检查pods和services
查看pod是否都正常运行
```bash
> kubectl get pod -o wide
NAME                                READY   STATUS    RESTARTS   AGE     IP                NODE                              NOMINATED NODE   READINESS GATES
multitool-krrjl                     1/1     Running   0          7m42s   192.168.112.194   headless-services-control-plane   <none>           <none>
multitool-kw6jr                     1/1     Running   0          7m42s   192.168.60.201    headless-services-worker          <none>           <none>
multitool-z2rs2                     1/1     Running   0          7m42s   192.168.140.4     headless-services-worker2         <none>           <none>
nginx-deployment-5cccd4ffd4-s9cf5   1/1     Running   0          7m42s   192.168.140.3     headless-services-worker2         <none>           <none>
nginx-deployment-5cccd4ffd4-v6zrx   1/1     Running   0          7m42s   192.168.60.200    headless-services-worker          <none>           <none>
redis-0                             1/1     Running   0          7m42s   192.168.140.2     headless-services-worker2         <none>           <none>
redis-1                             1/1     Running   0          7m34s   192.168.60.202    headless-services-worker          <none>           <none>
redis-2                             1/1     Running   0          7m25s   192.168.112.195   headless-services-control-plane   <none>           <none>
```

- `redis-0`: Master主节点，主要负责数据复制(接受数据写入操作)，并将数据复制至 `redis-1`和`redis-2`
- `redis-1,redis-2`: 这些服务通过无主服务DNS机制与`redis-0`连接在一起
- `nginx-deployment-*`: 带有随机后缀名的deployment容器
- multitool: 在每个节点上用于测试的容器

```bash
> kubectl get statefulsets.apps
NAME    READY   AGE
redis   3/3     26m
```
- 可以看到 `READY: 3/3` 说明 redis statefulSet的所有3个实例都已经运行
- StatefulSet确保Pod按照顺序排列创建(redis-0->redis-1->redis-2)，并维持了稳定的身份标识。

```bash
> kubectl get svc
NAME              TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
kubernetes        ClusterIP   10.96.0.1      <none>        443/TCP    29m
nginx-clusterip   ClusterIP   10.96.10.236   <none>        80/TCP     26m
nginx-headless    ClusterIP   None           <none>        80/TCP     26m
redis-headless    ClusterIP   None           <none>        6379/TCP   26m
```

- `nginx-clusterip`: 具有VIP的常规ClusterIP服务。
- `nginx-headless`: 用于Deployment类型服务的无头服务(`ClusterIP: None`)
- `redis-headless`: 适用于statefulSet类型服务的无头服务(`ClusterIP: None`)

## 对比 ClusterIP 和 Headless Service 的 DNS解析方式
进入到multitool来进行DNS解析功能测试

```bash
> kubectl get pods -l app=multitool -o wide
NAME              READY   STATUS    RESTARTS   AGE   IP                NODE                              NOMINATED NODE   READINESS GATES
multitool-krrjl   1/1     Running   0          39m   192.168.112.194   headless-services-control-plane   <none>           <none>
multitool-kw6jr   1/1     Running   0          39m   192.168.60.201    headless-services-worker          <none>           <none>
multitool-z2rs2   1/1     Running   0          39m   192.168.140.4     headless-services-worker2         <none>           <none>
> kubectl exec -it multitool-krrjl -- sh
/ # 
```

### 常规ClusterIP服务的DNS

```bash
> kubectl exec -it multitool-krrjl -- sh
/ # dig +search nginx-clusterip

; <<>> DiG 9.16.20 <<>> +search nginx-clusterip
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 63103
;; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1
;; WARNING: recursion requested but not available

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
; COOKIE: 7f8ed760a0f79e51 (echoed)
;; QUESTION SECTION:
;nginx-clusterip.default.svc.cluster.local. IN A

;; ANSWER SECTION:
nginx-clusterip.default.svc.cluster.local. 30 IN A 10.96.10.236

;; Query time: 42 msec
;; SERVER: 10.96.0.10#53(10.96.0.10)
;; WHEN: Tue Oct 13 14:44:14 UTC 2026
;; MSG SIZE  rcvd: 139

```

- 返回VIP地址(`10.96.10.236`)
- kube-proxy负责将负载均衡到后端容器
- 无论副本数量多少，客户端只能看到一个IP地址













































