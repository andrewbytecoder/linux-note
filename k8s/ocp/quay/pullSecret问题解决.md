
下面按 OpenShift / Kubernetes 场景给你一个完整、可操作的步骤，包括：

>查看 pull-secret
解码 pull-secret
更新并加入你给出的 Harbor 认证记录
验证是否生效

## 一、查看 pull-secret（OpenShift）
OpenShift 中 pull-secret 默认在 openshift-config 命名空间。

```bash
oc get secret pull-secret -n openshift-config -o json
```
如果你只想看 .dockerconfigjson 字段：
```bash
oc get secret pull-secret -n openshift-config \
  -o jsonpath='{.data.\.dockerconfigjson}'
```

> 注意：这里看到的是 Base64 编码后的内容

## 二、解码 pull-secret
1️⃣ 导出并解码为 JSON
```bash
oc get secret pull-secret -n openshift-config \
  -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d > pull-secret.json
```
查看内容：

```bash
cat pull-secret.json | jq .
```
典型结构如下：

```bash
{
  "auths": {
    "quay.io": {
      "auth": "xxxx",
      "email": "xxx@xxx.com"
    }
  }
}
```

## 三、更新 pull-secret（添加 Harbor 认证）
你需要添加的内容是：

```bash
"harbor3.quay.dc.com:8443": {
  "auth": "YWRtaW46YWRtaW5AMTIz",
  "email": "suibianxie@163.com"
}
```
1️⃣ 说明 auth 的含义（确认无误）
```bash
auth = base64(username:password)
```

你的值：
```bash
YWRtaW46YWRtaW5AMTIz
```
解码后是：
```bash
echo 'YWRtaW46YWRtaW5AMTIz' | base64 -d
```
结果：
```bash
admin:admin@123
```
✔ 符合 Harbor 登录格式

2️⃣ 编辑 pull-secret.json
```bash
vi pull-secret.json
```
在 auths 节点下 合并新增（不要覆盖原有内容）：

```json
{
  "auths": {
    "harbor3.quay.dc.com:8443": {
      "auth": "YWRtaW46YWRtaW5AMTIz",
      "email": "suibianxie@163.com"
    },
    "原有registry地址": {
      "auth": "xxxx",
      "email": "xxxx"
    }
  }
}
```
效果

```json
{
  "auths": {
    "harbor1.quay.dc.com:8443": {
      "auth": "bWN4LmlvK21jeF91cGxvYWQ6NDVPSlI3T0dMVzk0S0NXOFROUUZNU0k1VzVIUDdJV0tZSjdHN1NQV1pKNVpNQ1lFUlFCVFFSRjYxV0ZGMVBFUg==",
      "email": ""
    },
    "harbor2.quay.dc.com:8443": {
      "auth": "bWN4LmlvK21jeF91cGxvYWQ6T0M1WEo4VVBXWUhTOERZUlYxU1NYTUgyVUJVQUhCSEVXWDRRRlI2UUtBUVdSR1FMOFJYUElXT0NVOFE5WVdRVw==",
      "email": ""
    },
    "harbor3.quay.dc.com:8443": {
      "auth": "YWRtaW46YWRtaW5AMTIz",
      "email": "suibianxie@163.com"
    }
  }
}
```
## 四、重新生成并更新 Secret
1️⃣ Base64 编码
```bash
cat pull-secret.json | base64 -w 0 > pull-secret.base64
```
2️⃣ 更新 Secret（推荐方式）
```bash
oc set data secret/pull-secret \
  -n openshift-config \
  --from-file=.dockerconfigjson=pull-secret.json
```
或者使用 replace：

```bash
oc create secret generic pull-secret \
  -n openshift-config \
  --from-file=.dockerconfigjson=pull-secret.json \
  --type=kubernetes.io/dockerconfigjson \
  --dry-run=client -o yaml | oc replace -f -
```
五、验证是否更新成功
1️⃣ 再次查看
```bash
oc get secret pull-secret -n openshift-config \
  -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq .
```
确认存在：

```bash
"harbor3.quay.dc.com:8443"
```
```bash
[ysp-dc2@localhost wlltemp]$ oc get secret pull-secret -n openshift-config \
  -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq .
{
  "auths": {
    "harbor1.quay.dc.com:8443": {
      "auth": "bWN4LmlvK21jeF91cGxvYWQ6NDVPSlI3T0dMVzk0S0NXOFROUUZNU0k1VzVIUDdJV0tZSjdHN1NQV1pKNVpNQ1lFUlFCVFFSRjYxV0ZGMVBFUg==",
      "email": ""
    },
    "harbor2.quay.dc.com:8443": {
      "auth": "bWN4LmlvK21jeF91cGxvYWQ6T0M1WEo4VVBXWUhTOERZUlYxU1NYTUgyVUJVQUhCSEVXWDRRRlI2UUtBUVdSR1FMOFJYUElXT0NVOFE5WVdRVw==",
      "email": ""
    },
    "harbor3.quay.dc.com:8443": {
      "auth": "YWRtaW46YWRtaW5AMTIz",
      "email": "suibianxie@163.com"
    }
  }
}
[ysp-dc2@localhost wlltemp]$
```
## 六、（可选）让节点或 Pod 生效
### OpenShift
- 通常 自动同步到所有节点
- 如果镜像仍拉取失败，可重启相关 Pod
```bash
oc delete pod <pod-name> -n <namespace>
```
## 七、常见问题排查
问题	解决方式

| 问题                 | 解决方式                       |
| ------------------ | -------------------------- |
| 401 / unauthorized | 确认 auth 是否正确               |
| x509 证书错误          | Harbor 使用自签证书，需要信任 CA      |
| Pod 仍拉不到镜像         | 确认使用的是 cluster pull-secret |