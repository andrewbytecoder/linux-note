# Calico Ingress Gateway HTML 演示课件

基于 Kubernetes Networking Labs Lesson 19 制作的 55 页中文动态演示稿，入口文件为 `index.html`。

## 演示控制

- `←` / `→`、`PageUp` / `PageDown`：切换页面
- `N`：打开或关闭逐页演讲稿
- `O`：打开或关闭页面总览
- `F`：切换全屏
- `Home` / `End`：跳到第一页或最后一页
- 页面内 `↻`：重播当前网络动画

## 内容范围

- Calico Ingress Gateway、Gateway API 与 Envoy Gateway 的职责
- 五节点 Kind、Arista cEOS、VLAN 10/30 与外部用户
- 选择性 BGP、LoadBalancer IPAM、`serviceLoadBalancerIPs` 与 ECMP
- Gateway、HTTPRoute、ReferenceGrant 的关系和状态条件
- `app.demo.lab` Host 匹配与跨命名空间后端授权
- 80/20、50/50、0/100 金丝雀推进和 100/0 回滚
- Envoy 控制面与数据面、入口高可用和源 IP 策略
- NetworkPolicy、可观测性、分层排障和现场演示清单

## 主要资料

- https://k8snetworking.com/lessons/19-calico-ingress
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/19-calico-ingress
- https://docs.tigera.io/calico/latest/networking/ingress-gateway/about-calico-ingress-gateway
- https://docs.tigera.io/calico/latest/networking/configuring/advertise-service-ips
