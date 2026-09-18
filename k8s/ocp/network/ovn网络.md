
ovn网络在ocp中是openshift-ovn-kubernetes中的ovnkube-node-xxxxx中进行管理，可以进入到Pod内部查看集群网络的路由表
```bash
[ysp-dc3@localhost ~]$ kubectl exec -it -n openshift-ovn-kubernetes ovnkube-node-7bcqr -- sh
sh-5.1# 
sh-5.1# ovn-nbctl lr-route-list ovn_cluster_router
IPv4 Routes
Route Table <main>:
               100.64.0.2                100.88.0.2 dst-ip
               100.64.0.3                100.88.0.3 dst-ip
               100.64.0.4                100.88.0.4 dst-ip
               100.64.0.5                100.88.0.5 dst-ip
               100.64.0.6                100.64.0.6 dst-ip
               100.64.0.7                100.88.0.7 dst-ip
            10.226.0.0/21                100.88.0.3 dst-ip
            10.226.8.0/21                100.88.0.2 dst-ip
           10.226.16.0/21                100.88.0.4 dst-ip
           10.226.24.0/21                100.88.0.5 dst-ip
           10.226.40.0/21                100.88.0.7 dst-ip
           10.226.32.0/21               10.226.32.2 src-ip
            10.226.0.0/16                100.64.0.6 src-ip
```



## 为什么多个地址都SNAT到同一个外部IP 10.161.45.50
OVN的SNAT设计原理：多个pod内部的ip --> 同一个外部IP(10.161.45.50)

原因：
1. IP地址复用：在k8s中，为了节省公网IP资源，多个Pod共享同一个出口IP地址
2. 连接跟踪：通过TCP/UDP端口区分不同的Pod的连接
	- Pod A (10.225.58.247:50000) → SNAT → 10.161.45.50:50000
	- Pod B (10.225.59.28:50000) → SNAT → 10.161.45.50:50001
3. OCP的负载均衡设计：所有的Pod的出口流量都通过一个IP，便于管理和监控

### 查看具体的SNAT规则
```bash
# 查看所有SNAT规则
ovn-nbctl lr-nat-list GR_worker4.z2.ameidc2.com
sh-5.1# ovn-nbctl lr-nat-list GR_worker4.z2.ameidc2.com
TYPE             GATEWAY_PORT          MATCH                 EXTERNAL_IP        EXTERNAL_PORT    LOGICAL_IP          EXTERNAL_MAC         LOGICAL_PORT
snat                                                         10.161.45.50                        10.225.56.3
snat                                                         10.161.45.50                        10.225.59.32
snat                                                         10.161.45.50                        10.225.58.247
snat                                                         10.161.45.50                        10.225.59.30
snat                                                         10.161.45.50                        10.225.56.7
snat                                                         10.161.45.50                        10.225.59.24
snat                                                         10.161.45.50                        10.225.59.23
snat                                                         10.161.45.50                        10.225.59.26
snat                                                         10.161.45.50                        10.225.59.27
snat                                                         10.161.45.50                        10.225.59.20
snat                                                         10.161.45.50                        10.225.59.28
snat                                                         10.161.45.50                        100.64.0.9
sh-5.1# 
# 查看特定Pod的SNAT
ovn-nbctl lr-nat-list GR_worker4.z2.ameidc2.com | grep "10.225.58.247"
# 输出：external ip: "10.161.45.50" logical ip: "10.225.58.247" type: "snat"
```


## Pod内部只能和 10.161.45.50/24通信吗
Pod可以访问任何网络，但是有条件
### Pod可以访问的网络
1. 本地网络：10.225.0.0/21（Pod网络）
2. 外部网络：通过br-ex(10.161.45.0/24)
3. 特定路由的网络：如果配置路由，可以访问其他网络

### 当前限制的原因
```bash
Pod网络: 10.225.0.0/21
允许访问:
  通过GR_worker4 (100.64.0.9) 可以访问的网络
  默认只有br-ex网络 (10.161.45.0/24)
```

## ovn_cluster_router的哪条路由允许访问10.161.45.50？
路由表分析：
```bash
ovn-nbctl lr-route-list ovn_cluster_router
10.225.56.0/21                100.64.0.9 src-ip
10.225.0.0/16                100.64.0.9 src-ip
```


访问路径详解：
当Pod (10.225.58.247) 访问 10.161.45.50：

### 步骤1：数据包从Pod发出
```bash
源IP: 10.225.58.247
目标IP: 10.161.45.50
```

### 步骤2：匹配ovn_cluster_router路由
数据包从 `rtos-worker4.z2.ameidc2.com` 进入`ovn_cluster_router`

路由表匹配逻辑：

1. 先匹配目的地址路由：查找到10.161.45.50的路由 → 没有
2. 然后匹配源地址路由：
	Pod源IP 10.225.58.247 ∈ 10.225.0.0/16
	匹配路由：10.225.0.0/16 100.64.0.9 src-ip
	这意味着：当数据包的源IP在10.225.0.0/16范围内时，下一跳是100.64.0.9
### 步骤3：转发到GR_worker4
数据包被转发到100.64.0.9 (GR_worker4.z2.ameidc2.com)

### 步骤4：GR_worker4处理
在GR_worker4.z2.ameidc2.com中：

1. 路由表：没有显示，但应该有到本地网络的路由 
2. 目标IP 10.161.45.50 是GR_worker4的外部接口IP (rtoe-GR_worker4)
3. 数据包直接发送到外部接口，不经过SNAT
### 步骤5：到达目标
数据包通过ext_worker4交换机 → br-ex接口 → 到达10.161.45.50


### 为什么能访问10.161.45.50而不能访问10.161.48.14
**关键区别**
1. 10.161.45.50：是GR_work4的外部接口IP，在OVN网络内部
	- 目标地址在OVN网络拓扑中
	- GR_worker4知道这是自己的接口
2. 10.161.48.14：是主机public接口IP，不在OVN网络内部
	- OVN不知道这个网络的存在
	- 没有到10.161.48.0/24的路由
#### 路由决策图
```bash
Pod (10.225.58.247) → 访问 10.161.45.50
    ↓
ovn_cluster_router:
    匹配源IP路由: 10.225.0.0/16 → 100.64.0.9
    ↓
转发到 GR_worker4 (100.64.0.9)
    ↓
GR_worker4:
    目标IP 10.161.45.50 是自己的接口
    ↓
直接发送到 rtoe-GR_worker4 接口
    ↓
到达 10.161.45.50 ✓
Pod (10.225.58.247) → 访问 10.161.48.14
    ↓
ovn_cluster_router:
    匹配源IP路由: 10.225.0.0/16 → 100.64.0.9
    ↓
转发到 GR_worker4 (100.64.0.9)
    ↓
GR_worker4:
    查找路由表：没有到10.161.48.0/24的路由
    ↓
数据包被丢弃 ✗
```

#### 验证GR_worker4的路由表：
命名规则`GR_+nodename`
```bash
# 查看GR_worker4的路由表
ovn-nbctl lr-route-list GR_worker4.z2.ameidc2.com
sh-5.1# ovn-nbctl lr-route-list GR_worker4.z2.ameidc2.com
IPv4 Routes
Route Table <main>:
           169.254.0.0/17               169.254.0.4 dst-ip rtoe-GR_worker4.z2.ameidc2.com
            10.225.0.0/16                100.64.0.1 dst-ip
                0.0.0.0/0               10.161.45.6 dst-ip rtoe-GR_worker4.z2.ameidc2.com
sh-5.1# 
# 如果没有输出或没有到10.161.48.0/24的路由
# 就需要添加路由
```

#### 解决方案
```
# 在GR_worker4中添加到10.161.48.0/24的路由
# 假设10.161.45.1是br-ex网络的网关
ovn-nbctl lr-route-add GR_worker4.z2.ameidc2.com 10.161.48.0/24 10.161.45.1
# 或者在ovn_cluster_router中添加路由
ovn-nbctl lr-route-add ovn_cluster_router 10.161.48.0/24 100.64.0.9
```

## 源地址路由 (src-ip) 的特殊性
在您的路由表中：
```bash
10.225.56.0/21                100.64.0.9 src-ip
10.225.0.0/16                100.64.0.9 src-ip
```

> src-ip路由：这是一种策略路由，基于源IP地址选择下一跳，而不是目的IP。

### 工作方式：
1. 传统路由：基于目标IP选择路径
2. 源地址路由：基于源IP选择路径

在OCP OVN中，这种设计允许：
- 不同节点的Pod有不同的出口路径
- 实现多网卡出口负载均衡
- 支持网络策略隔离

### 总结
1. 多个Pod共享一个SNAT IP：为了IP地址复用和简化管理
2. Pod不限于访问10.161.45.50/24：可以访问任何有路由配置的网络
3. 访问10.161.45.50的路由：通过源地址路由 10.225.0.0/16 → 100.64.0.9 实现
4. 无法访问10.161.48.14的原因：OVN中没有到该网络的路由

### 其他
#### 查看ovn路由
查找ovn路由器

```bash
[ysp-dc2@localhost ~]$ kubectl get pod -Aowide | grep -i ovn
openshift-ovn-kubernetes                           ovnkube-control-plane-bd6dc987-bv6qm                         2/2     Running     0                27d     10.161.45.31    master1.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-control-plane-bd6dc987-kqzkp                         2/2     Running     0                27d     10.161.45.33    master3.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-296dh                                           8/8     Running     21 (28d ago)     30d     10.161.45.35    worker2.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-86rcg                                           8/8     Running     29 (29d ago)     30d     10.161.45.36    worker3.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-f7c7l                                           8/8     Running     28 (27d ago)     30d     10.161.45.33    master3.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-g62nw                                           8/8     Running     19 (28d ago)     30d     10.161.45.52    worker6.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-h6j4b                                           8/8     Running     12 (30d ago)     30d     10.161.45.32    master2.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-m542f                                           8/8     Running     37 (21d ago)     30d     10.161.45.50    worker4.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-njc5m                                           8/8     Running     28 (21d ago)     30d     10.161.45.51    worker5.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-p8v82                                           8/8     Running     10 (30d ago)     30d     10.161.45.31    master1.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-qtfvh                                           8/8     Running     39 (21d ago)     30d     10.161.45.34    worker1.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-wq2sc                                           8/8     Running     19 (28d ago)     30d     10.161.45.53    worker7.z2.ameidc2.com   <none>           <none>
[ysp-dc2@localhost ~]$
```
查看
```bash
[ysp-dc2@localhost ~]$ kubectl -it exec -n openshift-ovn-kubernetes ovnkube-node-wq2sc -- sh
Defaulted container "ovn-controller" out of: ovn-controller, ovn-acl-logging, kube-rbac-proxy-node, kube-rbac-proxy-ovn-metrics, northd, nbdb, sbdb, ovnkube-controller, kubecfg-setup (init)
sh-5.1# ovn-nbctl lr-list
98e1ec34-fcd7-4d7d-ac3f-98c2fa67736c (GR_worker7.z2.ameidc2.com)
8a6a088b-3e76-4139-bb00-00797aa375c8 (ovn_cluster_router)
sh-5.1# ovn-nbctl lr-route-list GR_worker7.z2.ameidc2.com
IPv4 Routes
Route Table <main>:
           169.254.0.0/17               169.254.0.4 dst-ip rtoe-GR_worker7.z2.ameidc2.com
            10.225.0.0/16                100.64.0.1 dst-ip
                0.0.0.0/0               10.161.45.6 dst-ip rtoe-GR_worker7.z2.ameidc2.com
sh-5.1# ovn-nbctl lr-route-list ovn_cluster_router       
IPv4 Routes
Route Table <main>:
               100.64.0.2                100.88.0.2 dst-ip
               100.64.0.3                100.88.0.3 dst-ip
               100.64.0.4                100.88.0.4 dst-ip
               100.64.0.5                100.88.0.5 dst-ip
               100.64.0.6                100.88.0.6 dst-ip
               100.64.0.7                100.88.0.7 dst-ip
               100.64.0.8                100.64.0.8 dst-ip
               100.64.0.9                100.88.0.9 dst-ip
              100.64.0.10               100.88.0.10 dst-ip
              100.64.0.11               100.88.0.11 dst-ip
            10.225.0.0/21                100.88.0.3 dst-ip
            10.225.8.0/21                100.88.0.2 dst-ip
           10.225.16.0/21                100.88.0.4 dst-ip
           10.225.24.0/21                100.88.0.5 dst-ip
           10.225.32.0/21                100.88.0.6 dst-ip
           10.225.40.0/21                100.88.0.7 dst-ip
           10.225.56.0/21                100.88.0.9 dst-ip
           10.225.64.0/21               100.88.0.10 dst-ip
           10.225.72.0/21               100.88.0.11 dst-ip
           10.225.48.0/21                100.64.0.8 src-ip
            10.225.0.0/16                100.64.0.8 src-ip
sh-5.1#
```
修复方法：
```bash
# 添加路由（选择一个即可）
ovn-nbctl lr-route-add GR_worker4.z2.ameidc2.com 10.161.48.0/24 10.161.45.1
# 或
ovn-nbctl lr-route-add ovn_cluster_router 10.161.48.0/24 100.64.0.9
```

完整的例子
```bash
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ kubectl get pod -Aowide | grep -i ovn
openshift-ovn-kubernetes                           ovnkube-control-plane-bd6dc987-bv6qm                         2/2     Running     0                27d     10.161.45.31    master1.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-control-plane-bd6dc987-kqzkp                         2/2     Running     0                27d     10.161.45.33    master3.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-296dh                                           8/8     Running     21 (29d ago)     30d     10.161.45.35    worker2.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-86rcg                                           8/8     Running     29 (29d ago)     30d     10.161.45.36    worker3.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-f7c7l                                           8/8     Running     28 (27d ago)     30d     10.161.45.33    master3.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-g62nw                                           8/8     Running     19 (29d ago)     30d     10.161.45.52    worker6.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-h6j4b                                           8/8     Running     12 (30d ago)     30d     10.161.45.32    master2.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-m542f                                           8/8     Running     37 (21d ago)     30d     10.161.45.50    worker4.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-njc5m                                           8/8     Running     28 (21d ago)     30d     10.161.45.51    worker5.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-p8v82                                           8/8     Running     10 (30d ago)     30d     10.161.45.31    master1.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-qtfvh                                           8/8     Running     39 (21d ago)     30d     10.161.45.34    worker1.z2.ameidc2.com   <none>           <none>
openshift-ovn-kubernetes                           ovnkube-node-wq2sc                                           8/8     Running     19 (29d ago)     30d     10.161.45.53    worker7.z2.ameidc2.com   <none>           <none>
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ kubectl -it exec -n ovnkube-node-m542f -- sh
error: pod, type/name or --filename must be specified
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ 
[ysp-dc2@localhost ~]$ kubectl -it exec -n openshift-ovn-kubernetes ovnkube-node-m542f -- sh
Defaulted container "ovn-controller" out of: ovn-controller, ovn-acl-logging, kube-rbac-proxy-node, kube-rbac-proxy-ovn-metrics, northd, nbdb, sbdb, ovnkube-controller, kubecfg-setup (init)
sh-5.1# ovn-nbctl
ovn-nbctl: missing command name (use --help for help)
sh-5.1# ovn-nbctl show
switch 9aa78674-d12a-4133-a88c-0cc144eb2f7d (ext_worker4.z2.ameidc2.com)
    port etor-GR_worker4.z2.ameidc2.com
        type: router
        addresses: ["00:0c:29:89:b9:fa"]
        router-port: rtoe-GR_worker4.z2.ameidc2.com
    port br-ex_worker4.z2.ameidc2.com
        type: localnet
        addresses: ["unknown"]
switch e0dedae4-d14f-4b53-bbba-e78076605d56 (join)
    port jtor-ovn_cluster_router
        type: router
        router-port: rtoj-ovn_cluster_router
    port jtor-GR_worker4.z2.ameidc2.com
        type: router
        router-port: rtoj-GR_worker4.z2.ameidc2.com
switch a6c6ec35-b343-431a-83f1-0d71e143bc40 (transit_switch)
    port tstor-worker1.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:06 100.88.0.6/16"]
    port tstor-worker2.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:07 100.88.0.7/16"]
    port tstor-worker4.z2.ameidc2.com
        type: router
        router-port: rtots-worker4.z2.ameidc2.com
    port tstor-worker7.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:08 100.88.0.8/16"]
    port tstor-master3.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:04 100.88.0.4/16"]
    port tstor-master1.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:02 100.88.0.2/16"]
    port tstor-worker6.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:0b 100.88.0.11/16"]
    port tstor-worker5.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:0a 100.88.0.10/16"]
    port tstor-master2.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:03 100.88.0.3/16"]
    port tstor-worker3.z2.ameidc2.com
        type: remote
        addresses: ["0a:58:64:58:00:05 100.88.0.5/16"]
switch 8d72746b-0d46-4906-ba0a-41f2e49fd735 (worker4.z2.ameidc2.com)
    port stor-worker4.z2.ameidc2.com
        type: router
        router-port: rtos-worker4.z2.ameidc2.com
    port mrps-prod01_olms-940-5b76c5bf68-qw6rp
        addresses: ["0a:58:0a:e1:3b:1e 10.225.59.30"]
    port mrps-prod01_ums-949-fd7b5ddd8-pvdjr
        addresses: ["0a:58:0a:e1:3b:1f 10.225.59.31"]
    port mrps-prod01_dst-1012-74cb97697f-wzfcx
        addresses: ["0a:58:0a:e1:3b:18 10.225.59.24"]
    port openshift-dns_dns-default-tt2qv
        addresses: ["0a:58:0a:e1:38:05 10.225.56.5"]
    port ysp-z2-prod01_etcd-2
        addresses: ["0a:58:0a:e1:3a:f7 10.225.58.247"]
    port ysp-z2-prod01_ysp-operator-hhhth
        addresses: ["0a:58:0a:e1:39:7b 10.225.57.123"]
    port openshift-multus_network-metrics-daemon-g6pfl
        addresses: ["0a:58:0a:e1:38:03 10.225.56.3"]
    port mrps-prod01_app-mgt-58998d554c-9zdjc
        addresses: ["0a:58:0a:e1:3b:14 10.225.59.20"]
    port mrps-prod01_mrpsserver-946-c5fbf8bd9-bqql9
        addresses: ["0a:58:0a:e1:3b:20 10.225.59.32"]
    port mrps-prod01_idms-957-785c64b989-ffbk8
        addresses: ["0a:58:0a:e1:3b:1c 10.225.59.28"]
    port mrps-prod01_dbvsm-937-57fd7c68fd-cd447
        addresses: ["0a:58:0a:e1:3b:16 10.225.59.22"]
    port mrps-prod01_q2ws-993-65c8b984cf-5qlsc
        addresses: ["0a:58:0a:e1:3b:19 10.225.59.25"]
    port k8s-worker4.z2.ameidc2.com
        addresses: ["0a:58:0a:e1:38:02 10.225.56.2"]
    port openshift-ingress-canary_ingress-canary-z427f
        addresses: ["0a:58:0a:e1:38:06 10.225.56.6"]
    port mrps-prod01_ahs-952-86766b5977-gzf5m
        addresses: ["0a:58:0a:e1:3b:1a 10.225.59.26"]
    port openshift-insights_insights-runtime-extractor-nj9fr
        addresses: ["0a:58:0a:e1:38:07 10.225.56.7"]
    port openshift-network-diagnostics_network-check-target-2bg6q
        addresses: ["0a:58:0a:e1:38:04 10.225.56.4"]
    port mrps-prod01_sub-1002-67c676dbb7-zw76t
        addresses: ["0a:58:0a:e1:3b:17 10.225.59.23"]
    port mrps-prod01_cmds-943-d7d9646b4-s4q4d
        addresses: ["0a:58:0a:e1:3b:1d 10.225.59.29"]
    port mrps-prod01_sipgw-984-9f7f4b694-z2rbx
        addresses: ["0a:58:0a:e1:3b:1b 10.225.59.27"]
router 54cf705c-ddf3-4cd9-9043-cff3435b4f56 (ovn_cluster_router)
    port rtoj-ovn_cluster_router
        mac: "0a:58:64:40:00:01"
        ipv6-lla: "fe80::858:64ff:fe40:1"
        networks: ["100.64.0.1/16"]
    port rtots-worker4.z2.ameidc2.com
        mac: "0a:58:64:58:00:09"
        ipv6-lla: "fe80::858:64ff:fe58:9"
        networks: ["100.88.0.9/16"]
    port rtos-worker4.z2.ameidc2.com
        mac: "0a:58:0a:e1:38:01"
        ipv6-lla: "fe80::858:aff:fee1:3801"
        networks: ["10.225.56.1/21"]
        gateway chassis: [d64bcf35-3b78-412f-b0ac-dca3c0389aa4]
router 13002aab-9101-4c18-a0cc-4bc8217e8e34 (GR_worker4.z2.ameidc2.com)
    port rtoe-GR_worker4.z2.ameidc2.com
        mac: "00:0c:29:89:b9:fa"
        ipv6-lla: "fe80::20c:29ff:fe89:b9fa"
        networks: ["10.161.45.50/24"]
    port rtoj-GR_worker4.z2.ameidc2.com
        mac: "0a:58:64:40:00:09"
        ipv6-lla: "fe80::858:64ff:fe40:9"
        networks: ["100.64.0.9/16"]
    nat 034577df-6a12-40d1-a960-2ea7c772a719
        external ip: "10.161.45.50"
        logical ip: "10.225.59.28"
        type: "snat"
    nat 17d03180-cb9a-448f-a135-01a48072c834
        external ip: "10.161.45.50"
        logical ip: "100.64.0.9"
        type: "snat"
    nat 25530cac-658e-426b-aef7-244ee5ba7499
        external ip: "10.161.45.50"
        logical ip: "10.225.59.20"
        type: "snat"
    nat 3817f7fb-90a3-4ad8-9539-f1289b6cdb05
        external ip: "10.161.45.50"
        logical ip: "10.225.59.27"
        type: "snat"
    nat 3998634f-c3d6-454b-94ce-5b72fd156f89
        external ip: "10.161.45.50"
        logical ip: "10.225.59.26"
        type: "snat"
    nat 65580082-3f82-4d79-87fb-d9708cab4aa3
        external ip: "10.161.45.50"
        logical ip: "10.225.59.23"
        type: "snat"
    nat 672acdcc-14fe-4274-8abf-3149b5d14f16
        external ip: "10.161.45.50"
        logical ip: "10.225.59.24"
        type: "snat"
    nat 6e10dbcf-6206-47d8-8c16-1339acc105e9
        external ip: "10.161.45.50"
        logical ip: "10.225.56.7"
        type: "snat"
    nat 78beb055-574f-4a17-a32d-6708115b7408
        external ip: "10.161.45.50"
        logical ip: "10.225.59.25"
        type: "snat"
    nat 88489826-6188-4648-85b7-96cb4698ecea
        external ip: "10.161.45.50"
        logical ip: "10.225.56.5"
        type: "snat"
    nat 8dc61d60-75dc-4e48-b0e8-8bc8099cb417
        external ip: "10.161.45.50"
        logical ip: "10.225.56.4"
        type: "snat"
    nat 9f182c9b-ada0-4482-bbda-95bfc294a927
        external ip: "10.161.45.50"
        logical ip: "10.225.59.31"
        type: "snat"
    nat a254c797-3e61-4d52-8be2-36c8289bd0be
        external ip: "10.161.45.50"
        logical ip: "10.225.59.22"
        type: "snat"
    nat a5765ad3-1993-4ae1-b14b-6950a43b4ace
        external ip: "10.161.45.50"
        logical ip: "10.225.56.6"
        type: "snat"
    nat b8e6d137-d9b8-4976-9660-98ddfe4ab61e
        external ip: "10.161.45.50"
        logical ip: "10.225.57.123"
        type: "snat"
    nat befd6141-b44f-4d13-8cb8-fa91422f5c4b
        external ip: "10.161.45.50"
        logical ip: "10.225.59.29"
        type: "snat"
    nat ce8eaf85-1c03-41f8-92b9-437ecee8f3f0
        external ip: "10.161.45.50"
        logical ip: "10.225.59.30"
        type: "snat"
    nat dc8152eb-bb75-43ab-b096-18f32cd46918
        external ip: "10.161.45.50"
        logical ip: "10.225.58.247"
        type: "snat"
    nat ed073506-e7f5-45c2-a166-0aa875853297
        external ip: "10.161.45.50"
        logical ip: "10.225.59.32"
        type: "snat"
    nat fa8288af-ab96-490c-b582-1b79ea098e82
        external ip: "10.161.45.50"
        logical ip: "10.225.56.3"
        type: "snat"
sh-5.1# ovn-nbctl ls-list
9aa78674-d12a-4133-a88c-0cc144eb2f7d (ext_worker4.z2.ameidc2.com)
e0dedae4-d14f-4b53-bbba-e78076605d56 (join)
a6c6ec35-b343-431a-83f1-0d71e143bc40 (transit_switch)
8d72746b-0d46-4906-ba0a-41f2e49fd735 (worker4.z2.ameidc2.com)
sh-5.1# ovn-nbctl acl-list ext_worker4.z2.ameidc2.com
sh-5.1# ovn-nbctl acl-list join                      
sh-5.1# ovn-nbctl acl-list transit_switch                                       
sh-5.1# ovn-nbctl acl-list worker4.z2.ameidc2.com
  to-lport  1001 (ip4.src==10.225.56.2) allow-related
sh-5.1# ovn-nbctl  lsp-list ext_worker4.z2.ameidc2.com
67b4847a-7634-41f6-983b-1a694b40eddd (br-ex_worker4.z2.ameidc2.com)
162628c8-bd6c-4a89-a8d8-ca71f3a426ba (etor-GR_worker4.z2.ameidc2.com)
sh-5.1# ovn-nbctl  lsp-list join                      
d171c381-8fed-4c45-9b0e-7b90e6d4784f (jtor-GR_worker4.z2.ameidc2.com)
295dd0a7-db65-4ff3-9528-8d5fad8b267b (jtor-ovn_cluster_router)
sh-5.1# ovn-nbctl  lsp-list transit_switch
8c5a2e5f-2a2e-40dd-ae43-11da647c464d (tstor-master1.z2.ameidc2.com)
d24b57b3-6afe-497f-8e8d-050af2be363a (tstor-master2.z2.ameidc2.com)
47b579b5-29bf-412d-bab3-637bd7997aa4 (tstor-master3.z2.ameidc2.com)
00fe5947-260d-40fa-b75f-a0d8fb5481d6 (tstor-worker1.z2.ameidc2.com)
05b335c9-bfd3-4598-ba7d-a3f6083c1e64 (tstor-worker2.z2.ameidc2.com)
f427a0e4-7ded-4fc3-b272-40b120fe7c90 (tstor-worker3.z2.ameidc2.com)
0e446e09-c1fd-4a6c-b5eb-1f33c0f07101 (tstor-worker4.z2.ameidc2.com)
b5e838be-5bd4-494f-a20a-b5b637e88d64 (tstor-worker5.z2.ameidc2.com)
9fcfd46e-0b8c-4ab7-9b36-99e5b613a03d (tstor-worker6.z2.ameidc2.com)
2dfc9503-fd44-4e88-85b8-b42800b2c089 (tstor-worker7.z2.ameidc2.com)
sh-5.1# ovn-nbctl  lsp-list worker4.z2.ameidc2.com
9d3d842c-3eac-4986-be42-f65d4512aa00 (k8s-worker4.z2.ameidc2.com)
a6fb48b2-e841-4382-ad64-a6d881a7c4f5 (mrps-prod01_ahs-952-86766b5977-gzf5m)
724afbf8-1d7c-492a-a3ad-6abd52ce4381 (mrps-prod01_app-mgt-58998d554c-9zdjc)
ea475a81-9e02-4e36-8d7e-1bca89bccc1c (mrps-prod01_cmds-943-d7d9646b4-s4q4d)
91df5618-8947-42f5-9687-af1e6b7b679d (mrps-prod01_dbvsm-937-57fd7c68fd-cd447)
17d52ab6-10de-40fc-a026-74ad5e5c4b5d (mrps-prod01_dst-1012-74cb97697f-wzfcx)
8a673810-6556-422f-9fef-0ac55cb94ae7 (mrps-prod01_idms-957-785c64b989-ffbk8)
7bfd9898-5916-42f1-b32f-e961afb08e45 (mrps-prod01_mrpsserver-946-c5fbf8bd9-bqql9)
0f1ecbda-156a-493e-b18a-364b77ab5f57 (mrps-prod01_olms-940-5b76c5bf68-qw6rp)
9b07c371-12aa-4c1b-96a2-80b71d93cf73 (mrps-prod01_q2ws-993-65c8b984cf-5qlsc)
ef3deec6-47ee-444e-9c79-c9e0347ab138 (mrps-prod01_sipgw-984-9f7f4b694-z2rbx)
c87e701a-0a0e-4117-852b-e0c3e92db80c (mrps-prod01_sub-1002-67c676dbb7-zw76t)
11a0ce59-8314-43e3-9b81-051302a4556f (mrps-prod01_ums-949-fd7b5ddd8-pvdjr)
1d69eaf2-317d-4655-a109-45a3c50a5308 (openshift-dns_dns-default-tt2qv)
a6392d20-5c1f-4257-87d7-17cca2fbf778 (openshift-ingress-canary_ingress-canary-z427f)
afe6e33c-7511-41cf-b8ec-6022b443d8c7 (openshift-insights_insights-runtime-extractor-nj9fr)
69d49c2a-2870-46e0-b3e5-bd5fcda2542c (openshift-multus_network-metrics-daemon-g6pfl)
b2d7952d-b10b-4de5-8b40-f88458ab3f60 (openshift-network-diagnostics_network-check-target-2bg6q)
006a9cef-ab21-4290-8c53-fa0190583822 (stor-worker4.z2.ameidc2.com)
2aa112a9-c41b-4117-bc79-33c0ce9a4186 (ysp-z2-prod01_etcd-2)
60c366a1-de45-4cdb-96a6-0a70fd74d44d (ysp-z2-prod01_ysp-operator-hhhth)
sh-5.1# ovn-nbctl  fwd-group-list  
FWD_GROUP       LS            VIP             VMAC                  CHILD_PORTS
sh-5.1# ovn-nbctl lr-list
13002aab-9101-4c18-a0cc-4bc8217e8e34 (GR_worker4.z2.ameidc2.com)
54cf705c-ddf3-4cd9-9043-cff3435b4f56 (ovn_cluster_router)
sh-5.1#  ovn-nbctl lrp-list GR_worker4.z2.ameidc2.com
237e7c13-370b-4d51-aa58-d535b946803f (rtoe-GR_worker4.z2.ameidc2.com)
70a6aeee-46cf-4e8b-971a-bd089c1640a2 (rtoj-GR_worker4.z2.ameidc2.com)
sh-5.1#  ovn-nbctl lrp-list ovn_cluster_router       
380a921d-ddaf-43d5-83d0-6f94bdbc43e8 (rtoj-ovn_cluster_router)
aec570cb-0915-4c9c-8cfc-1f713aea3bb9 (rtos-worker4.z2.ameidc2.com)
630f8db8-4c4f-448b-8fbf-46a7aaf26a5e (rtots-worker4.z2.ameidc2.com)
sh-5.1#  ovn-nbctl  lr-route-list GR_worker4.z2.ameidc2.co
ovn-nbctl: GR_worker4.z2.ameidc2.co: router name not found
sh-5.1#  ovn-nbctl  lr-route-list GR_worker4.z2.ameidc2.com
IPv4 Routes
Route Table <main>:
           169.254.0.0/17               169.254.0.4 dst-ip rtoe-GR_worker4.z2.ameidc2.com
            10.225.0.0/16                100.64.0.1 dst-ip
                0.0.0.0/0               10.161.45.6 dst-ip rtoe-GR_worker4.z2.ameidc2.com
sh-5.1#  ovn-nbctl  lr-route-list ovn_cluster_route        
ovn-nbctl: ovn_cluster_route: router name not found
sh-5.1#  ovn-nbctl  lr-route-list ovn_cluster_router
IPv4 Routes
Route Table <main>:
               100.64.0.2                100.88.0.2 dst-ip
               100.64.0.3                100.88.0.3 dst-ip
               100.64.0.4                100.88.0.4 dst-ip
               100.64.0.5                100.88.0.5 dst-ip
               100.64.0.6                100.88.0.6 dst-ip
               100.64.0.7                100.88.0.7 dst-ip
               100.64.0.8                100.88.0.8 dst-ip
               100.64.0.9                100.64.0.9 dst-ip
              100.64.0.10               100.88.0.10 dst-ip
              100.64.0.11               100.88.0.11 dst-ip
            10.225.0.0/21                100.88.0.3 dst-ip
            10.225.8.0/21                100.88.0.2 dst-ip
           10.225.16.0/21                100.88.0.4 dst-ip
           10.225.24.0/21                100.88.0.5 dst-ip
           10.225.32.0/21                100.88.0.6 dst-ip
           10.225.40.0/21                100.88.0.7 dst-ip
           10.225.48.0/21                100.88.0.8 dst-ip
           10.225.64.0/21               100.88.0.10 dst-ip
           10.225.72.0/21               100.88.0.11 dst-ip
           10.225.56.0/21                100.64.0.9 src-ip
            10.225.0.0/16                100.64.0.9 src-ip
sh-5.1# ovn-nbctl lr-nat-list GR_worker4.z2.ameidc2.com 
TYPE             GATEWAY_PORT          MATCH                 EXTERNAL_IP        EXTERNAL_PORT    LOGICAL_IP          EXTERNAL_MAC         LOGICAL_PORT
snat                                                         10.161.45.50                        10.225.56.3
snat                                                         10.161.45.50                        10.225.59.32
snat                                                         10.161.45.50                        10.225.58.247
snat                                                         10.161.45.50                        10.225.59.30
snat                                                         10.161.45.50                        10.225.56.7
snat                                                         10.161.45.50                        10.225.59.24
snat                                                         10.161.45.50                        10.225.59.23
snat                                                         10.161.45.50                        10.225.59.26
snat                                                         10.161.45.50                        10.225.59.27
snat                                                         10.161.45.50                        10.225.59.20
snat                                                         10.161.45.50                        10.225.59.28
snat                                                         10.161.45.50                        100.64.0.9
snat                                                         10.161.45.50                        10.225.59.25
snat                                                         10.161.45.50                        10.225.56.5
snat                                                         10.161.45.50                        10.225.56.4
snat                                                         10.161.45.50                        10.225.59.31
snat                                                         10.161.45.50                        10.225.59.22
snat                                                         10.161.45.50                        10.225.56.6
snat                                                         10.161.45.50                        10.225.57.123
snat                                                         10.161.45.50                        10.225.59.29
sh-5.1# ovn-nbctl lr-nat-list ovn_cluster_router        
sh-5.1# 
sh-5.1# 
sh-5.1#
```
添加路由后，Pod就能访问10.161.48.14了。






























