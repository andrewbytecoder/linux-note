# NodeLocal DNSCache HTML 演示课件

基于 Kubernetes Networking Labs Lesson 17 制作的 45 页中文演示稿，入口文件为 `index.html`。

## 演示控制

- `←` / `→`、`PageUp` / `PageDown`：切换页面
- `N`：打开或关闭逐页演讲稿
- `O`：打开或关闭页面总览
- `F`：切换全屏
- `Home` / `End`：跳到第一页或最后一页
- 页面内 `↻`：重播当前网络动画

## 内容范围

- 课程三节点 Kind、Calico 3.30.0 与 `dns-test` 基线
- NodeLocal DNSCache 五类资源与 Corefile 四个 server block
- iptables 透明模式与 IPVS 模式差异
- `NOTRACK → no DNAT → local route → INPUT` 完整数据路径
- 缓存 HIT、MISS、跨节点回源与外部域名转发动画
- Prometheus 指标、查询日志、容量与故障排查
- 二十分钟现场演示命令顺序与清理步骤

## 主要资料

- https://k8snetworking.com/lessons/17-nodelocal-dnscache
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/17-nodelocal-dnscache
- https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/
- https://github.com/kubernetes/dns/tree/master/cmd/node-cache
