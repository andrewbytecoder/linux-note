







## nginx ingress
### nginx ingress redirect
```yaml
[root@K8S-master01 5.4]# kubectl create -f redirect.yaml
ingress.extensions/redirect created
[root@K8S-master01 5.4]# cat redirect.yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/permanent-redirect: https://www.baidu.com
  name: redirect
  namespace: default
spec:
  rules:
  - host: nginx.redirect.com
    http:
      paths:
      - path: /
        backend:
          serviceName: nginx-v2
          servicePort: 80
```
使用curl访问 `nginx.redirect.com` 会被重定向到 `https://www.baidu.com` 


### nginx ingress rewrite
Rewrite主要用于地址重写，比如访问 `nginx.test.com/rewrite` 跳转到 `nginx.test.com` ，访问 `nginx.test.com/rewrite/foo` 会跳转到 `nginx.test.com/foo` 等。

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
  name: rewrite
  namespace: default
spec:
  rules:
  - host: nginx.test.com
    http:
      paths:
      - backend:
          serviceName: nginx-v2
          servicePort: 80
        # 或者 /rewrite(/|$)(.*)
        path: /rewrite/?(.*)
```

要使用 Kubernetes Ingress 和 NGINX Ingress 控制器实现 URL 重写（将 `/rewrite/data` 重写到 `/data`），你需要配置 `nginx.ingress.kubernetes.io/rewrite-target` 注解。以下是实现此功能的 Ingress YAML 配置示例：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rewrite-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  rules:
  - http:
      paths:
      - path: /rewrite(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: your-service-name
            port:
              number: 80
```

 解释：
- **`annotations`**:
  - `nginx.ingress.kubernetes.io/rewrite-target: /$1`: 这个注解告诉 NGINX Ingress 控制器将匹配的路径重写为 `$1` 变量的内容。这里的 `$1` 是正则表达式中的第一个捕获组。
  
- **`path: /rewrite(/|$)(.*)`**:
  - 这个路径定义了一个正则表达式，用于匹配以 `/rewrite` 开头的请求。
  - `(/|$)`: 匹配 `/` 或者路径结束，确保 `/rewrite` 后面可以是 `/` 或者为空。
  - `(.*)`: 捕获 `/rewrite` 后面的所有内容，并将其作为 `$1` 传递给 `rewrite-target`。

- **`pathType: Prefix`**:
  - 表示该路径是基于前缀匹配的。任何以 `/rewrite` 开头的路径都会被匹配。

- **`backend`**:
  - 定义了请求最终会被代理到的服务 (`your-service-name`) 和端口 (`80`)。


### nginx ingress错误代码重定向
本节主要演示当访问链接返回值为404、503等错误时，如何自动跳转到自定义的错误页面

### nginx ingress SSL
配置之后实现自动跳转HTTPS

### nginx ingress 匹配请求头

以下是您提供的图片中的文本内容：

```yaml
[root@K8S-master01 5.7]# kubectl create -f snippet.yaml
ingress.extensions/snippet created
[root@K8S-master01 5.7]# cat snippet.yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/server-snippet: |
      set $agentflag 0;
      if ($http_user_agent ~* "iPhone" ) {
        set $agentflag 1;
      }
      if ( $agentflag = 1 ) {
        return 301 http://nginx.test.com;
      }
  name: snippet
  namespace: default
spec:
  rules:
  - host: nginx.snippet.com
    http:
      paths:
      - path: /
        backend:
          serviceName: nginx-v2
          servicePort: 80
```

解释：
- **`annotations`**:
  - `nginx.ingress.kubernetes.io/server-snippet`: 这个注解允许你在 NGINX 配置中插入自定义的配置片段。在这个例子中，它用于根据用户代理（User-Agent）重定向 iPhone 用户到 `http://nginx.test.com`。

- **`name: snippet`**: 定义了 Ingress 资源的名称。

- **`namespace: default`**: 指定了 Ingress 资源所在的命名空间。

- **`spec.rules`**: 定义了 Ingress 的路由规则。
  - `host: nginx.snippet.com`: 指定该规则适用于 `nginx.snippet.com` 域名。
  - `path: /`: 指定路径为根路径 `/`。
  - `backend.serviceName: nginx-v2` 和 `servicePort: 80`: 指定请求将被转发到名为 `nginx-v2` 的服务的 80 端口。

### nginx ingress基本认证
有些网站可能需要通过密码来访问，对于这类网站可以使用Nginx的basic-auth设置密码访问，具体方法如下。
```bash
[root@K8S-master01 5.8]# htpasswd -c auth foo
    New password:
    Re-type new password:
    Adding password for user foo
    [root@K8S-master01 5.8]# cat auth
    foo:$apr1$okma2fx9$hdTJ.KFmi4pY9T6a2MjeS1
```
基于之前创建的密码创建Secret：
```bash
[root@K8S-master01 5.8]# kubectl create secret generic basic-auth
--from-file=auth
    secret/basic-auth created
```

```bash
[root@K8S-master01 5.8]# kubectl create -f test-auth.yaml
    ingress.extensions/ingress-with-auth created
```
创建完成之后，再访问对应的uri就会弹出登录验证窗口

### Nginx Ingress黑／白名单
```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ingress-with-auth
  annotations:
    nginx.ingress.kubernetes.io/whitelist-source-range: 192.168.10.129
    # type of authentication
    nginx.ingress.kubernetes.io/auth-type: basic
    # name of the secret that contains the user/password definitions
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    # message to display with an appropriate context why the authentication is required
    nginx.ingress.kubernetes.io/auth-realm: 'Authentication Required - foo'
spec:
  rules:
  - host: nginx.auth.com
    http:
      paths:
      - path: /
        backend:
          serviceName: nginx
          servicePort: 80
```

解释：
- **`apiVersion: extensions/v1beta1`**: 指定使用的 API 版本。注意，这个版本在较新的 Kubernetes 版本中已经被弃用，建议使用 `networking.k8s.io/v1`。
- **`kind: Ingress`**: 表示这是一个 Ingress 资源。
- **`metadata.name: ingress-with-auth`**: 定义了 Ingress 资源的名称。
- **`annotations`**:
  - `nginx.ingress.kubernetes.io/whitelist-source-range`: 设置允许访问的 IP 地址范围。
  - `nginx.ingress.kubernetes.io/auth-type`: 指定认证类型为基本认证（basic）。
  - `nginx.ingress.kubernetes.io/auth-secret`: 引用包含用户名和密码定义的 Secret 名称。
  - `nginx.ingress.kubernetes.io/auth-realm`: 设置认证提示信息。
- **`spec.rules`**: 定义了 Ingress 的路由规则。
  - `host: nginx.auth.com`: 指定该规则适用于 `nginx.auth.com` 域名。
  - `http.paths`: 定义路径规则。
    - `path: /`: 指定根路径 `/`。
    - `backend.serviceName: nginx` 和 `servicePort: 80`: 指定请求将被转发到名为 `nginx` 的服务的 80 端口。

使用说明：
此配置创建了一个带有基本认证的 Ingress 资源，只有来自 `192.168.10.129` 的请求才能访问 `nginx.auth.com`，并且需要通过基本认证才能访问。认证信息存储在名为 `basic-auth` 的 Secret 中。

###  Nginx Ingress速率限制
有时候可能需要限制速率以降低后端压力，此时，可以使用Nginx的ratelimit进行配置，具体方法如下
```yaml
# 限制每秒的连接，单个 IP: 
nginx.ingress.kubernetes.io/limit-rps: 
# 限制每分钟的连接，单个 IP: 
nginx.ingress.kubernetes.io/limit-rpm:
# 限制客户端每秒传输的字节数 单位为 K: 
nginx.ingress.kubernetes.io/limit-rate:
```


```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "5"
    nginx.ingress.kubernetes.io/limit-rpm: "300"
    nginx.ingress.kubernetes.io/limit-rate: "100"
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: example-service
            port:
              number: 80
```