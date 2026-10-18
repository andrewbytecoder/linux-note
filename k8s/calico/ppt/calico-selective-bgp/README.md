# Calico Selective BGP Peering HTML 演示课件

基于 Kubernetes Networking Labs Lesson 15 制作，覆盖 Node 标签、BGPPeer `nodeSelector`、BGPConfiguration、LoadBalancer IPPool、cEOS 动态邻居、ECMP、Service 转发、动态扩缩 Speaker 与排障。

## 使用

直接打开 `index.html`。建议使用 Chromium / Edge / Chrome，并进入全屏演示。

- `←` / `→` / `PageUp` / `PageDown`：翻页
- `Space`：下一页
- `N`：打开或关闭演讲稿
- `O`：幻灯片总览
- `F`：全屏
- `Home` / `End`：首尾页
- `Esc`：关闭演讲稿或总览

带 `↻` 的页面可手动重放动画。

## 内容依据

- https://k8snetworking.com/lessons/15-selective-bgp-peering
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/15-selective-bgp-peering
- https://docs.tigera.io/calico/latest/networking/configuring/bgp
- https://docs.tigera.io/calico/latest/reference/resources/bgppeer

课件中的 Node IP、LoadBalancer IP、BGP 计数和 Nginx 版本均为课程示例。现场演示时以本地输出为准。
