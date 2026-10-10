本节主要实现，使用BGP将Calico IP地址池通告给外部网络，使得Pod IP地址能够在kubernetes集群外进行访问
## 资源清单


### 网络topo

```yaml
name: calico-bgp-lb
topology:
  nodes:
    ceos01:
      kind: arista_ceos
      image: ceos:4.34.0F
      startup-config: startup-configs/ceos01-startup-config.config
    k01:
      kind: k8s-kind
      startup-config: k01-no-cni.yaml
      extras:
        k8s_kind:
          deploy:
            wait: 0s

    k01-control-plane:
      kind: ext-container
      exec:
      # 将 eth1 的 MTU设置为 9000
        - "ip link set dev eth1 mtu 9000"
      # 给eth1 配置 IP 地址
        - "ip addr add dev eth1 10.10.10.10/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1 src 10.10.10.10"

    k01-worker:
      kind: ext-container
      exec:
        - "ip link set dev eth1 mtu 9000"
        - "ip addr add dev eth1 10.10.10.11/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1 src 10.10.10.11"


    k01-worker2:
      kind: ext-container
      exec:
        - "ip link set dev eth1 mtu 9000"
        - "ip addr add dev eth1 10.10.10.12/24"
        - "ip route add 10.10.20.0/24 via 10.10.10.1 src 10.10.10.12"

    k01-worker3:
      kind: ext-container
      exec:
        - "ip link set dev eth1 mtu 9000"
        - "ip addr add dev eth1 10.10.20.20/24"
        - "ip route add 10.10.10.0/24 via 10.10.20.1 src 10.10.20.20"

  links:
    - endpoints: ["ceos01:eth1", "k01-control-plane:eth1"]
    - endpoints: ["ceos01:eth2", "k01-worker:eth1"]
    - endpoints: ["ceos01:eth3", "k01-worker2:eth1"]
    - endpoints: ["ceos01:eth4", "k01-worker3:eth1"]
```


### kind cluster配置

```yaml
apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
name: k01
networking:
# 禁止使用k8s默认的CNI kindnet
  disableDefaultCNI: true
# calico 的 cluster CIDR 会继承这个值
# calico 的BGP 会将这个网段通告给cEOS
  podSubnet: "192.168.0.0/16"
  serviceSubnet: "10.96.0.0/16"
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.10"
            node-labels: "vlan=10"
      - |
        kind: ClusterConfiguration
        apiServer:
          certSANs:
            - "127.0.0.1"
# 支持从外部访问 apiserver
            - "10.10.10.10"
          extraArgs:
            advertise-address: "10.10.10.10"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.11"
            node-labels: "vlan=10"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.12"
            node-labels: "vlan=10"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.20.20"
            node-labels: "vlan=20"
```

### Calico 配置

安装calico的基础配置

```yaml
# This section includes base Calico installation configuration.
# For more information, see: https://docs.tigera.io/calico/latest/reference/installation/api#operator.tigera.io/v1.Installation
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  # Configures Calico networking.
  calicoNetwork:
    ipPools:
    - name: default-ipv4-ippool
      blockSize: 26
      cidr: 192.168.0.0/17
      encapsulation: None
      natOutgoing: Disabled
      nodeSelector: all()
      disableBGPExport: false
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

BGP配置，用来配置BGP基础信息，以及要宣告的地址段信息

```yaml
apiVersion: crd.projectcalico.org/v1
kind: BGPConfiguration
metadata:
# **必须叫 `default`**，Calico 只认这个名字作为全局 BGP 配置
  name: default
spec:
  logSeverityScreen: Info
  asNumber: 65010
  # 关闭全mesh,这样node与node之间不在建立BGP通信，所有节点都和外部peer(cEOS)建立BGP
  # 这是标准的生产topo模式(route reflector 或 ToR模式)
  # 有助于减少 BGP session数量， N节点从 Nx(N-1)/2 降低到N
  nodeToNodeMeshEnabled: false
  serviceLoadBalancerIPs:
  - cidr: 172.16.0.240/28
# 
  prefixAdvertisements:
  - cidr: 192.168.0.0/17
    communities:
    - 65010:100
```


































