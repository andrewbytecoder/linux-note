## 第一部分拉取镜像认证配置
### 认证配置
见 pullSecret

## 关键配置
- -特别说明：这里的harbor1.quay.dc.com、harbor2.quay.dc.com、harbor3.quay.dc.com 一定和第二部的的镜像映射的域名要保持一致。
如 配置的 harbor3.quay.dc.com
```bash
- mirrors:
    - 'harbor3.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
```
和 配置的 harbor3.quay.dc.com
```bash
"harbor3.quay.dc.com:8443": {
      "auth": "YWRtaW46YWRtaW5AMTIz",
      "email": "suibianxie@163.com"
    }
```
是对应的。

### 关键配置
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

## 第二部分 --  镜像规则配置
对镜像进行tag映射，主要用于产品
用于和quay仓库通过tag映射镜像
### 配置位置
```bash
ocp4控制web -> 管理 --> 自定义资源定义 -> ImageTagMirrorSet
```
![[Pasted image 20260917195223.png]]


### 关键配置
```yaml
apiVersion: config.openshift.io/v1
kind: ImageTagMirrorSet
metadata:
  name: image-tag
spec:
  imageTagMirrors:
    - mirrors:
        - 'harbor1.quay.dc.com:8443/mcx.io'
        - 'harbor2.quay.dc.com:8443/mcx.io'
      source: mcx.io
```

### tag 镜像映射（主要用于ocp）
文件作用：用于和quay仓库通过tag、Digest映射镜像，一般用于映射tag镜像（拉取ocp自身镜像用）
### 配置位置
```bash
ocp4 控制web-->管理-->自定义资源定义-->ImageContentSourcePolicy
```
![[Pasted image 20260917195450.png]]

### 关键配置
> 特别说明，下面匹配规则，是从上往下的，匹配成功后就返回

```yaml
apiVersion: operator.openshift.io/v1alpha1
kind: ImageContentSourcePolicy
metadata:
  managedFields:
  name: image-policy
spec:
  repositoryDigestMirrors:
    - mirrors:
        - 'harbor3.quay.dc.com:8443/ocp419-red'
      source: registry.redhat.io
    - mirrors:
        - 'harbor3.quay.dc.com:8443/ocp419-red'
      source: registry.access.redhat.com
    - mirrors:
        - 'harbor3.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-release
    - mirrors:
        - 'harbor3.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
    - mirrors:
        - 'harbor3.quay.dc.com:8443/ocp419-quay-io'
      source: quay.io
    - mirrors:
        - 'harbor3.quay.dc.com:8443/ocp419-quay-io'
      source: docker.io
```



















































