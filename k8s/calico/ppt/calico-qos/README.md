# Calico Network QoS HTML 演示课件

基于 Kubernetes Networking Labs Lesson 12 制作，覆盖 Calico Pod QoS 注解、iperf3 基线与限速测试、Linux `tc`、Token Bucket、双向验证、版本差异和排障方法。

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

- https://k8snetworking.com/lessons/12-calico-qos
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/12-calico-qos
- https://docs.tigera.io/calico/latest/networking/configuring/qos-controls
- https://man7.org/linux/man-pages/man8/tc.8.html

课件中的 Pod IP、Service VIP、吞吐和重传数字均来自课程示例。现场演示时以本地实验输出为准。
