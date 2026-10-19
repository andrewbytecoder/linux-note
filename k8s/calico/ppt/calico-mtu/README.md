# Calico MTU HTML 演示课件

基于 Kubernetes Networking Labs Lesson 18 制作的 55 页中文动态演示稿，入口文件为 `index.html`。

## 演示控制

- `←` / `→`、`PageUp` / `PageDown`：切换页面
- `N`：打开或关闭逐页演讲稿
- `O`：打开或关闭页面总览
- `F`：切换全屏
- `Home` / `End`：跳到第一页或最后一页
- 页面内 `↻`：重播当前网络动画

## 内容范围

- MTU、Ethernet frame、IPv4/IPv6 header 与 TCP MSS
- 四节点 Kind、Arista cEOS、VLAN 10/20 与 Calico VXLANCrossSubnet
- Pod eth0 1450、Host eth1 9000 与显式配置 8950
- DF 大包本地拒绝与 VXLAN jumbo 成功动画
- Vlan20 SVI 1500 导致跨 VLAN TLS timeout
- ICMP Type 3 Code 4、PMTUD、PMTU route cache 与 TCP MSS
- 严格 RPF 丢弃管理地址 ICMP 的完整故障链
- 生产设计、排障流程和现场演示清单

## 主要资料

- https://k8snetworking.com/lessons/18-mtu
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/18-mtu
- https://docs.tigera.io/calico/latest/networking/configuring/mtu
- https://docs.tigera.io/calico/latest/networking/configuring/vxlan-ipip
