# Kubernetes Headless Services HTML 演示课件

基于 Kubernetes Networking Labs Lesson 11 制作，覆盖 Headless Service、EndpointSlice、CoreDNS、StatefulSet 稳定网络身份、Redis 主从复制、iptables 对照与 Calico Pod 路由。

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

- https://k8snetworking.com/lessons/11-headless-services
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/11-headless-services
- https://kubernetes.io/docs/concepts/services-networking/service/#headless-services
- https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#stable-network-id

课件中的 IP、Pod 随机后缀、EndpointSlice 名称和 iptables chain 后缀均为课程示例。现场演示时以本地实验输出为准。
