# Calico WireGuard HTML 演示课件

基于 Kubernetes Networking Labs Lesson 13 制作，覆盖跨节点加密边界、明文与密文抓包、FelixConfiguration、`wireguard.cali`、Peer、密钥与握手、allowed ips、策略路由、fwmark、IPv6 和排障。

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

- https://k8snetworking.com/lessons/13-wireguard
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/13-wireguard
- https://docs.tigera.io/calico/latest/network-policy/encrypt-cluster-pod-traffic
- https://www.wireguard.com/protocol/

课件中的 Node IP、Pod IP、public key、peer、路由和抓包内容均为课程示例。现场演示时以本地实验输出为准。
