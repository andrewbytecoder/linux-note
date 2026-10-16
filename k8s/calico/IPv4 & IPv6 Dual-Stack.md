Calico IPv4 and IPv6协议 -- 双栈网络技术，在这种架构下，容器可以通过IPv4和IPv6两种协议进行通信，从而实现访问内部服务以及外部目标。

## 概述
- 如何使用Calico工具配置一个带有双栈架构的kubernetes集群
- Pod如何同时接收IPv4和IPv6地址?
- VXLAN封装如何实现IPv6节点间的通信
- 如何让Pod能够访问外部的IPv4和IPv6地址
- CoreDNS如何为服务提供A(IPv4)和AAAA(IPv6)记录

## 什么是双栈网络
双栈网络意味着网络实体（节点、Pod、服务）同时拥有IPv4和IPv6地址，这使得应用程序能够：
- 使用IPv4协议与传统系统进行通信
- 利用现代基础设施，通过IPv6进行通信
- 逐步从IPv4过渡到IPv6，同时避免破坏兼容性
在这个实验中，这些Pod能够在上游路由器上同时到达IPv4 1.1.1.1 和 IPv6地址 20001:db8::1， 从而实现真正的双栈外部连接功能。


## kind集群中双栈网络配置
为了在kubernetes中实现双栈网络功能，需要在创建集群时对其进行配置，kind集群配置文件(dual-stack-no-cni.yaml)
```yaml
# Kind cluster configuration for Dual-Stack networking
# Pods and services get both IPv4 and IPv6 addresses

apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
name: dual-stack
networking:
  disableDefaultCNI: true
  # Dual-stack pod subnets
  podSubnet: "192.168.0.0/16,fd00:10:244::/48"
  # Dual-stack service subnets  
  serviceSubnet: "10.96.0.0/16,fd00:10:96::/112"
  ipFamily: dual

nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.10,fd00:10:10::10"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.11,fd00:10:10::11"

  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-ip: "10.10.10.12,fd00:10:10::12"
```