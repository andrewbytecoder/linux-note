# Calico Static Pod IP HTML 演示课件

基于 Kubernetes Networking Labs Lesson 16 制作，覆盖 Calico IPAM、`IPReservation`、`cni.projectcalico.org/ipAddrs`、WorkloadEndpoint、IPAM owner、重复地址冲突、释放重建和生产边界。

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

- https://k8snetworking.com/lessons/16-static-ip
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/16-static-ip
- https://docs.tigera.io/calico/latest/networking/ipam/use-specific-ip
- https://docs.tigera.io/calico/latest/reference/resources/ipreservation

课件中的动态 Pod IP、接口名、IPAM handle 和事件文本为示例。现场演示时以本地输出为准。
