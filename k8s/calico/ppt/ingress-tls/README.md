# Ingress TLS HTML 演示课件

基于 Kubernetes Networking Labs Lesson 20 制作的 60 页中文动态演示稿，入口文件为 `index.html`。

## 演示控制

- `←` / `→`、`PageUp` / `PageDown`：切换页面
- `N`：打开或关闭逐页演讲稿
- `O`：打开或关闭页面总览
- `F`：切换全屏
- `Home` / `End`：跳到第一页或最后一页
- 页面内 `↻`：重播当前网络动画

## 内容范围

- Calico Ingress Gateway 的 TLS 终止边界
- cert-manager Controller、Webhook、CA Injector 与烟雾测试
- SelfSigned ClusterIssuer、CA ClusterIssuer 与本地根 CA
- Wildcard 与 Dedicated Certificate 策略
- Certificate、CertificateRequest、Secret 与 X.509 验证
- Gateway HTTPS listener、SNI、certificateRefs 与 ReferenceGrant
- 三条 HTTPS HTTPRoute 与 HTTP 301 重定向
- 客户端 CA 信任、curl 和 openssl 端到端验证
- 证书重签发、Secret 更新与 Envoy 热更新
- 官方 `cmctl renew` 建议、Issuer 切换风险和分层排障

## 主要资料

- https://k8snetworking.com/lessons/20-ingress-tls
- https://github.com/aadhilam/k8-networking-calico-containerlab/tree/master/containerlab/20-ingress-tls
- https://cert-manager.io/docs/
- https://gateway-api.sigs.k8s.io/guides/user-guides/tls/
