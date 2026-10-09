在Calico环境中能配置多个IP池，这样能够实现更高级别的网络分段和IP地址管理。通常在需要区分集群中不同工作负载的场景下，才会使用多个IP池。

## 概述
![[Pasted image 20261009151258.png]]





## 资源清单
其他清单和  [[LoadBalancer & BGP Advertisements]] 一样，这里只贴出不一样的配置
### calico 配置

```yaml
# This section includes base Calico installation configuration.
# For more information, see: https://docs.tigera.io/calico/latest/reference/installation/api#operator.tigera.io/v1.Installation
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  # Configures Calico networking.
  # 这里配置多个 ip pool
  calicoNetwork:
    ipPools:
    - name: default-ipv4-ippool
      blockSize: 26
      cidr: 192.168.0.0/17
      encapsulation: VXLANCrossSubnet
      natOutgoing: Enabled
      nodeSelector: all()
      disableBGPExport: true
    - name: secondary-ipv4-ippool
      blockSize: 26
      cidr: 192.168.128.0/17
      encapsulation: VXLANCrossSubnet
      natOutgoing: Enabled
      nodeSelector: "!all()"
      disableBGPExport: true
    nodeAddressAutodetectionV4:
      cidrs:
        - 10.10.0.0/16

---

# This section configures the Calico API server.
# For more information, see: https://docs.tigera.io/calico/latest/reference/installation/api#operator.tigera.io/v1.APIServer
apiVersion: operator.tigera.io/v1
kind: APIServer
metadata:
  name: default
spec: {}
```

## 环境检查

### 检查网络topo

```text
> containerlab inspect -t topology.clab.yaml
20:15:48 INFO Parsing & checking topology file=topology.clab.yaml
╭───────────────────────────┬──────────────────────┬─────────┬───────────────────────╮
│            Name           │      Kind/Image      │  State  │     IPv4/6 Address    │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane         │ ext-container        │ running │ 172.21.0.4            │
│                           │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker                │ ext-container        │ running │ 172.21.0.2            │
│                           │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2               │ ext-container        │ running │ 172.21.0.3            │
│                           │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ clab-calico-bgp-lb-ceos01 │ arista_ceos          │ running │ 172.20.20.2           │
│                           │ ceos:4.34.0F         │         │ 3fff:172:20:20::2     │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-control-plane         │ k8s-kind             │ running │ 172.21.0.4            │
│                           │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::4 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker                │ k8s-kind             │ running │ 172.21.0.2            │
│                           │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::2 │
├───────────────────────────┼──────────────────────┼─────────┼───────────────────────┤
│ k01-worker2               │ k8s-kind             │ running │ 172.21.0.3            │
│                           │ kindest/node:v1.35.0 │         │ fc00:f853:ccd:e793::3 │
╰───────────────────────────┴──────────────────────┴─────────┴───────────────────────╯
```

### 检查集群中节点是否正常运行
```bash
> kubectl get nodes
NAME                STATUS   ROLES           AGE     VERSION
k01-control-plane   Ready    control-plane   5h27m   v1.35.0
k01-worker          Ready    <none>          5h26m   v1.35.0
k01-worker2         Ready    <none>          5h26m   v1.35.0
```


## 检查IP地址池
### 确保多个IP地址池配置生效
在 `Installation` 资源中，我们配置了两个IP地址池：默认IP地址池和辅助IP地址池。辅助IP地址的节点选择为 `!all()`，这意味着除非负载明确请求了该IP池，否则该IP池就不会被使用。

```bash
> kubectl get ippools
NAME                    CREATED AT
default-ipv4-ippool     2026-10-09T07:01:24Z
secondary-ipv4-ippool   2026-10-09T07:01:24Z
> kubectl apply -f lb-ippool.yaml
ippool.projectcalico.org/loadbalancer-ip-pool created
> kubectl get ippools
NAME                    CREATED AT
default-ipv4-ippool     2026-10-09T07:01:24Z
loadbalancer-ip-pool    2026-10-09T12:26:24Z
secondary-ipv4-ippool   2026-10-09T07:01:24Z
~/calico-containerlab/09-multi-ippool/k8s-manifests > 
```

请注意，这里有一个默认使用的 IP 地址，以及另一个辅助的 IP 地址池。对于本次实验来说，可以忽略那个负载均衡用的 IP 地址池。

```bash
> kubectl get blockaffinities
NAME                                CREATED AT
k01-control-plane-192-168-69-0-26   2026-10-09T07:02:10Z
k01-worker-192-168-42-192-26        2026-10-09T07:02:09Z
k01-worker2-192-168-88-192-26       2026-10-09T07:02:11Z
load-balancer-172-16-0-240-28       2026-10-09T12:26:24Z
```

请注意，这些块亲和性仅从主(primary)IP池分配，这意味着备用IP池不会被纳入IPAM分配考虑。这些信息也表明目前没有任何工作负载请求从备用IP池分配IP地址。


### 验证工作负载IP

```bash
> kubectl get pods -o wide
NAME                                READY   STATUS    RESTARTS   AGE     IP               NODE                NOMINATED NODE   READINESS GATES
multitool-1-5m44g                   1/1     Running   0          5h50m   192.168.42.200   k01-worker          <none>           <none>
multitool-1-9vmr9                   1/1     Running   0          5h50m   192.168.88.194   k01-worker2         <none>           <none>
multitool-1-bmpqg                   1/1     Running   0          5h50m   192.168.69.2     k01-control-plane   <none>           <none>
multitool-2-bllss                   1/1     Running   0          5h50m   192.168.42.201   k01-worker          <none>           <none>
multitool-2-tmbxt                   1/1     Running   0          5h50m   192.168.69.3     k01-control-plane   <none>           <none>
multitool-2-vtz6j                   1/1     Running   0          5h50m   192.168.88.195   k01-worker2         <none>           <none>
nginx-deployment-84d779799d-7wxjw   1/1     Running   0          5h50m   192.168.42.202   k01-worker          <none>           <none>
nginx-deployment-84d779799d-jtbl6   1/1     Running   0          5h50m   192.168.88.196   k01-worker2         <none>           <none>
```

从输出结果来看，所有Pod IP 都来自默认IP池。这是因为备用IP池的nodeSelector为 `!all()`， 除非明确指定，否则不会被分配给Pod





























