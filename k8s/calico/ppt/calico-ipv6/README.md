# Calico IPv4 / IPv6 Dual-Stack HTML 演示课件

基于 Kubernetes Networking Labs Lesson 14 制作，覆盖 Kind 双栈配置、Calico IPv4/IPv6 IPPool、Node 与 Pod 地址、外部原生路由、`vxlan-v6.calico`、Service 地址族、CoreDNS A/AAAA 与应用监听。

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

- https://k8snetworking.com/lessons/14-calico-ipv6
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/14-calico-ipv6
- https://kubernetes.io/docs/concepts/services-networking/dual-stack/
- https://docs.tigera.io/calico/latest/networking/

课件中的 Pod、Service、Node、VXLAN block 与 MAC 地址均为课程示例。现场演示时以本地实验输出为准。
