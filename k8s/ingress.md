
ingress是k8s的一个内置对象，通常我们把ingress看做是service之上的service，但是ingress对象只用来声明路由策略，并不具体处理流量转发，要使得ingress生效，我们还需要额外的安装ingress-controller，例如ingress-Nginx。
在生产环境中，Ingress-Nginx 一般就是以 Loadbalancer 类型来对外暴露的，Ingress-Nginx实际上充当的是网关的角色，这样做的好处是，我们只需要一个负载均衡器实例，通过路由策略，就可以对外暴露所有的业务服务。

### Ingress Controller的通用框架
Ingress Controller实质上可以理解为监视器， Ingress Controller通过不断地跟Kubernetes API打交道， 实时地感知后端Service、 Pod等的变化， 比如新增和减少Pod， Service增加与减少等； 当得到这些变化信息后， Ingress Controller再结合下文的Ingress生成配置， 然后更新反向代理负载均衡器， 并刷新其配置， 起到服务发现的作用。

Ingress Controller将Ingress入口地址和后端Pod地址的映射关系（规则） 实时刷新到Load Balancer的配置文件中， 再让负载均衡器重载（reload） 该规则， 便可实现服务的负载均衡和自动发现。

### Ingress Controller详解
Ingress是一个k8s对象，ingress-Controller是管理ingress资源，按照资源定义然后启用Nginx服务进行反向代理。
对绝大多数刚刚接触Kubernetes的人来说， 都比较熟悉Nginx Ingress Controller， 一个对外暴露Service的7层反向代理。 Nginx Ingress Controller通过Kubernetes的annotations配置， 为Ingress提供丰富的个性化配置。

```yaml

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-resource-backend
spec:
  defaultBackend:
    resource:
      apiGroup: k8s.example.com
      kind: StorageBucket
      name: static-assets
 #  Ingress 对象的命名必须是合法的 [DNS 子域名名称](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。
 # 如果 `ingressClassName` 被省略，那么你应该定义一个[默认的 Ingress 类](https://kubernetes.io/zh-cn/docs/concepts/services-networking/ingress/#default-ingress-class)
  ingressClassName: nginx-example
  rules:
    - http:
        paths:
          - path: /icons
            pathType: ImplementationSpecific
            backend:
            # 资源后端
              resource:
                apiGroup: k8s.example.com
                kind: StorageBucket
                name: icon-assets

```

#### 路径类型(https://kubernetes.io/zh-cn/docs/concepts/services-networking/ingress/#path-types)

Ingress 中的每个路径都需要有对应的路径类型（Path Type）。未明确设置 `pathType` 的路径无法通过合法性检查。当前支持的路径类型有三种：

- `ImplementationSpecific`：对于这种路径类型，匹配方法取决于 IngressClass。 具体实现可以将其作为单独的 `pathType` 处理或者作与 `Prefix` 或 `Exact` 类型相同的处理。
    
- `Exact`：精确匹配 URL 路径，且区分大小写。
    
- `Prefix`：基于以 `/` 分隔的 URL 路径前缀匹配。匹配区分大小写， 并且对路径中各个元素逐个执行匹配操作。 路径元素指的是由 `/` 分隔符分隔的路径中的标签列表。 如果每个 _p_ 都是请求路径 _p_ 的元素前缀，则请求与路径 _p_ 匹配。

因为微服务架构及Kubernetes等编排工具最近几年才开始逐渐流行， 所以一开始的反向代理服务器（例如Nginx和HA Proxy） 并未提供对微服务的支持， 才会出现Nginx Ingress Controller这种中间层做Kubernetes和负载均衡器（例如Nginx） 之间的适配器（adapter） 。Nginx Ingress Controller的存在就是为了与Kubernetes交互， 同时刷新Nginx配置， 还能重载Nginx。 而号称云原生边界路由的Traefik设计得更彻底， 首先它是个反向代理， 其次原生提供了对Kubernetes的支持， 也就是说， Traefik本身就能跟Kubernetes打交道， 感知Kubernetes集群服务

的更新。 Traefik是原生支持Kubernetes Ingress的， 因此用户在使用Traefik时无须再开发一套Nginx Ingress Controller， 受到了广大运维人员的好评。 相

### basic usage
如果k8s版本 >= 1.19.x建议将不同的ingress资源单独创建入口资源
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-myservicea
spec:
  rules:
  - host: myservicea.foo.org
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myservicea
            port:
              number: 80
  # **ngress 资源与具体的 Ingress 控制器（Ingress Controller）之间的“连线开关”**
  # 简单来说，它的作用是告诉 Kubernetes 集群：“请让名为 `nginx` 的那个 Ingress 控制器来处理这个流量规则，而不是其他的控制器（比如 Traefik、ALB 或 HAProxy）
  # - **`ingressClassName: nginx`**：这行代码意味着你的集群中必须存在一个 `IngressClass` 资源，其名称为 `nginx`。
  ingressClassName: nginx
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-myserviceb
spec:
  rules:
  - host: myserviceb.foo.org
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myserviceb
            port:
              number: 80
  ingressClassName: nginx
```


### redirect
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



### rewrite
在某些情况下，后端服务暴露的URL与ingress规则中指定的路径不同，如果不重写任何请求都会返回404，将 `nginx.ingress.kubernetes.io/rewrite-target` 注释设置为服务预期的路径。
如果应用根在不同路径中暴露并需要重定向，则将注释 `nginx.ingress.kubernetes.io/app-root` 设置为重定向 `/` 的请求。

| Name                                           | Description                                                                                                         | Values |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| nginx.ingress.kubernetes.io/rewrite-target     | Target URI where the traffic must be redirected                                                                     | string |
| nginx.ingress.kubernetes.io/ssl-redirect       | Indicates if the location section is only accessible via SSL (defaults to True when Ingress contains a Certificate) | bool   |
| nginx.ingress.kubernetes.io/force-ssl-redirect | Forces the redirection to HTTPS even if the Ingress is not TLS Enabled                                              | bool   |
| nginx.ingress.kubernetes.io/app-root           | Defines the Application Root that the Controller must redirect if it's in `/` context                               | string |
| nginx.ingress.kubernetes.io/use-regex          | Indicates if the paths defined on an Ingress use regular expressions                                                | bool   |

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
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
  name: rewrite
  namespace: default
spec:
  ingressClassName: nginx
  rules:
  - host: rewrite.bar.com
    http:
      paths:
      - path: /something(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: http-svc
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

### Session Affinity(会话亲和性)
注释 `nginx.ingress.kubernetes.io/affinity` 使入口的所有上游都能启用并设置亲和类型。这样，请求总是会被引导到同一个上游服务器。NGINX 唯一可用的亲和类型是 `cookie`。
`nginx.ingress.kubernetes.io/affinity-mode` 注释定义了会话的粘性。将此设置为`balanced` （默认）会在部署规模扩大时重新分配部分会话，从而重新平衡服务器负载。将此设置为`persistent`不会重新平衡会话到新服务器，因此能提供最大的粘性。
注释 `nginx.ingress.kubernetes.io/affinity-canary-behavior` 定义了在启用会话亲和性时金丝雀的行为。将此设置为`sticky` （默认）可以确保由金丝雀服务的用户继续被金丝雀服务。将此设置为`legacy`状态后，会恢复原始的金丝雀行为，即会话亲和力被忽略。
如果为一个主机定义了多个入口，且至少有一个入口使用 `nginx.ingress.kubernetes.io/affinity: cookie` 了 ，那么只有该入口上的 `nginx.ingress.kubernetes.io/affinity` 路径才会使用会话 cookie 亲和性。主机在其他入口上定义的所有路径都将通过后端服务器的随机选择实现负载均衡

| Name                                                                 | Description                                                                                                                                                                                                                                             | Value                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| nginx.ingress.kubernetes.io/affinity                                 | Type of the affinity, set this to `cookie` to enable session affinity                                                                                                                                                                                   | string (NGINX only supports `cookie`)                                                                                           |
| nginx.ingress.kubernetes.io/affinity-mode                            | The affinity mode defines how sticky a session is. Use `balanced` to redistribute some sessions when scaling pods or `persistent` for maximum stickiness.                                                                                               | `balanced` (default) or `persistent`                                                                                            |
| nginx.ingress.kubernetes.io/affinity-canary-behavior                 | Defines session affinity behavior of canaries. By default the behavior is `sticky`, and canaries respect session affinity configuration. Set this to `legacy` to restore original canary behavior, when session affinity parameters were not respected. | `sticky` (default) or `legacy`                                                                                                  |
| nginx.ingress.kubernetes.io/session-cookie-name                      | Name of the cookie that will be created                                                                                                                                                                                                                 | string (defaults to `INGRESSCOOKIE`)                                                                                            |
| nginx.ingress.kubernetes.io/session-cookie-secure                    | Set the cookie as secure regardless the protocol of the incoming request                                                                                                                                                                                | `"true"` or `"false"`                                                                                                           |
| nginx.ingress.kubernetes.io/session-cookie-path                      | Path that will be set on the cookie (required if your [Ingress paths](https://kubernetes.github.io/ingress-nginx/user-guide/ingress-path-matching/) use regular expressions)                                                                            | string (defaults to the currently [matched path](https://kubernetes.github.io/ingress-nginx/user-guide/ingress-path-matching/)) |
| nginx.ingress.kubernetes.io/session-cookie-domain                    | Domain that will be set on the cookie                                                                                                                                                                                                                   | string                                                                                                                          |
| nginx.ingress.kubernetes.io/session-cookie-samesite                  | `SameSite` attribute to apply to the cookie                                                                                                                                                                                                             | Browser accepted values are `None`, `Lax`, and `Strict`                                                                         |
| nginx.ingress.kubernetes.io/session-cookie-conditional-samesite-none | Will omit `SameSite=None` attribute for older browsers which reject the more-recently defined `SameSite=None` value                                                                                                                                     | `"true"` or `"false"`                                                                                                           |
| nginx.ingress.kubernetes.io/session-cookie-max-age                   | Time until the cookie expires, corresponds to the `Max-Age` cookie directive                                                                                                                                                                            | number of seconds                                                                                                               |
| nginx.ingress.kubernetes.io/session-cookie-expires                   | Legacy version of the previous annotation for compatibility with older browsers, generates an `Expires` cookie directive by adding the seconds to the current date                                                                                      | number of seconds                                                                                                               |
| nginx.ingress.kubernetes.io/session-cookie-change-on-failure         | When set to `false` nginx ingress will send request to upstream pointed by sticky cookie even if previous attempt failed. When set to `true` and previous attempt failed, sticky cookie will be changed to point to another upstream.                   | `true` or `false` (defaults to                                                                                                  |

### Authentication
可以通过在入口规则中添加额外的注释来添加认证，认证的来源是一个包含用户名密码的secret文件。
```yaml
# basic 基础认证， digest 数字认证
nginx.ingress.kubernetes.io/auth-type: [basic|digest]
# secretName 包含用户名和密码的secret名称，通常经过 namespace/secretName 指定，如果不指定就在本地命名空间中查找
nginx.ingress.kubernetes.io/auth-secret: secretName
nginx.ingress.kubernetes.io/auth-realm: "realm string"
```

The `auth-secret` can have two forms:
- `auth-file` - default, an htpasswd file in the key `auth` within the secret
- `auth-map` - the keys of the secret are the usernames, and the values are the hashed passwords

[[https://kubernetes.github.io/ingress-nginx/examples/auth/basic/]]

- 创建 htpasswd 文件
```bash
$ htpasswd -c auth foo
New password: <bar>
New password:
Re-type new password:
Adding password for user foo
```

- 将htpasswd文件转化为secret
```bash
$ kubectl create secret generic basic-auth --from-file=auth
secret "basic-auth" created
```

- 校验是否创建成功
```yaml
$ kubectl get secret basic-auth -o yaml
apiVersion: v1
data:
  auth: Zm9vOiRhcHIxJE9GRzNYeWJwJGNrTDBGSERBa29YWUlsSDkuY3lzVDAK
kind: Secret
metadata:
  name: basic-auth
  namespace: default
type: Opaque
```

- 创建ingress使用basic-auth
```yaml
$ echo "
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-with-auth
  annotations:
    # type of authentication
    nginx.ingress.kubernetes.io/auth-type: basic
    # name of the secret that contains the user/password definitions
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    # message to display with an appropriate context why the authentication is required
    nginx.ingress.kubernetes.io/auth-realm: 'Authentication Required - foo'
spec:
  ingressClassName: nginx
  rules:
  - host: foo.bar.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service: 
            name: http-svc
            port: 
              number: 80
" | kubectl create -f -
```

- 使用curl传入对应的认证进行请求
```bash
$ curl -v http://10.2.29.4/ -H 'Host: foo.bar.com' -u 'foo:bar'
*   Trying 10.2.29.4...
* Connected to 10.2.29.4 (10.2.29.4) port 80 (#0)
* Server auth using Basic with user 'foo'
> GET / HTTP/1.1
> Host: foo.bar.com
> Authorization: Basic Zm9vOmJhcg==
> User-Agent: curl/7.43.0
> Accept: */*
>
< HTTP/1.1 200 OK
< Server: nginx/1.10.0
< Date: Wed, 11 May 2016 06:05:26 GMT
< Content-Type: text/plain
< Transfer-Encoding: chunked
< Connection: keep-alive
< Vary: Accept-Encoding
<
CLIENT VALUES:
client_address=10.2.29.4
command=GET
real path=/
query=nil
request_version=1.1
request_uri=http://foo.bar.com:8080/

SERVER VALUES:
server_version=nginx: 1.9.11 - lua: 10001

HEADERS RECEIVED:
accept=*/*
connection=close
host=foo.bar.com
user-agent=curl/7.43.0
x-request-id=e426c7829ef9f3b18d40730857c3eddb
x-forwarded-for=10.2.29.1
x-forwarded-host=foo.bar.com
x-forwarded-port=80
x-forwarded-proto=http
x-real-ip=10.2.29.1
x-scheme=http
BODY:
* Connection #0 to host 10.2.29.4 left intact
-no body in request-
```


### 自定义 Nginx upstream hashing
nginx支持基于一致性哈希来实现客户端到服务器之间的负载均衡
存在一种特殊的上游哈希模式，称为子集。在此模式下，上游服务器被分组为子集，粘性通过将密钥映射到子集而非单个上游服务器来实现。特定服务器是从所选粘性子集中均匀随机选择的。它在粘性和负载分布之间取得了平衡。

`nginx.ingress.kubernetes.io/upstream-hash-by` ： nginx 变量、文本值或其任意组合，用于一致性哈希。例如： `nginx.ingress.kubernetes.io/upstream-hash-by: "$request_uri"` 或 `nginx.ingress.kubernetes.io/upstream-hash-by: "$request_uri$host"` `nginx.ingress.kubernetes.io/upstream-hash-by: "${request_uri}-text-value"` ，或通过当前请求 URI 一致地哈希上游请求。

### configuration snippet
利用这个注释，你可以为Nginx location上添加自定义配置

```bash
nginx.ingress.kubernetes.io/configuration-snippet: |
  more_set_headers "Request-Id: $req_id";
```

### server snippet
利用注释 nginx.ingress.kubernetes.io/server-snippet 可以在服务器配置块中添加自定义配置。
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/server-snippet: |
      set $agentflag 0;

      if ($http_user_agent ~* "(Mobile)" ){
        set $agentflag 1;
      }

      if ( $agentflag = 1 ) {
        return 301 https://m.example.com;
      }
```

> 该注释每个host只能使用一次


### proxy redirect

注释 `nginx.ingress.kubernetes.io/proxy-redirect-from` 和 `nginx.ingress.kubernetes.io/proxy-redirect-to` 分别设定 NGINX proxy_redirect 指令的第一个和第二个参数。可以在[代理服务器响应](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_redirect)的 `Location` 和 `Refresh` 头字段中设置应更改的文本
By default the value of each annotation is "off".
如果使用两个注释必须同时启用

### Mirror
能够将请求镜像到测试后端，并且忽略镜像后端的响应结果，经常用来查看后端对请求的响应
```bash
nginx.ingress.kubernetes.io/mirror-target: https://test.env.com$request_uri
# 默认情况下请求体也会下发到镜像后端，如果需要关闭
nginx.ingress.kubernetes.io/mirror-request-body: "off"
```

默认情况下，镜像请求的Host头和原先主机的请求保持一致，如果需要使用镜像主机的Host覆盖，可以通过一下注释实现
```bash
nginx.ingress.kubernetes.io/mirror-target: https://1.2.3.4$request_uri
nginx.ingress.kubernetes.io/mirror-host: "test.env.com"
```

默认情况下，发送镜像的请求和原始请求会进行关联，如果镜像后端反应很慢，那么原始请求也会进行降频。

### stream snippet
利用注释 `nginx.ingress.kubernetes.io/stream-snippet` 可以添加自定义流配置。
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/stream-snippet: |
      server {
        listen 8000;
        proxy_pass 127.0.0.1:80;
      }
```


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


## NGINX Ingress Controller pod
![[Pasted image 20250805111001.png]]


### 处理新的ingress资源

![[Pasted image 20250805111221.png]]

1. _User_ creates a new Ingress resource.  
    _用户_ 创建一个新的 Ingress 资源。
2. The NGINX Ingress Controller process has a _Cache_ of the resources in the cluster. The _Cache_ includes only the resources NGINX Ingress Controller is concerned with such as Ingresses. The _Cache_ stays in sync with the Kubernetes API by [watching for changes to the resources](https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes).  
    NGINX Ingress Controller 进程拥有集群资源的_缓存_ 。该_缓存_仅包含 NGINX Ingress Controller 关注的资源，例如 Ingress。该_缓存_通过[监视资源的变化](https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes)与 Kubernetes API 保持同步。
3. Once the _Cache_ has the new Ingress resource, it notifies the _Control Loop_ about the changed resource.  
    一旦_缓存_有了新的入口资源，它就会通知_控制循环_有关更改的资源。
4. The _Control Loop_ gets the latest version of the Ingress resource from the _Cache_. Since the Ingress resource references other resources, such as TLS Secrets, the _Control loop_ gets the latest versions of those referenced resources as well.  
    _控制循环_从 _Cache_ 获取 Ingress 资源的最新版本。由于 Ingress 资源引用了其他资源（例如 TLS Secrets），因此_控制循环_也会获取这些引用资源的最新版本。
5. The _Control Loop_ generates TLS certificates and keys from the TLS Secrets and writes them to the filesystem.  
    _控制循环_ 从 TLS 机密生成 TLS 证书和密钥，并将它们写入文件系统。
6. The _Control Loop_ generates and writes the NGINX _configuration files_, which correspond to the Ingress resource, and writes them to the filesystem.  
    _控制循环_ 生成并写入与 Ingress 资源对应的 NGINX  _配置文件_  ，并将其写入文件系统。
7. The _Control Loop_ reloads _NGINX_ and waits for _NGINX_ to successfully reload. As part of the reload:  
    _控制循环_ 重新加载  _NGINX_ ，并等待 _NGINX_ 成功重新加载。重新加载过程中：
    1. _NGINX_ reads the _TLS certs and keys_.  
        _NGINX_ 读取 _TLS 证书和密钥_ 。
    2. _NGINX_ reads the _configuration files_.  
        _NGINX_ 读取_配置文件_ 。
8. The _Control Loop_ emits an event for the Ingress resource and updates its status. If the reload fails, the event includes the error message.  
    _控制循环_ 会为 Ingress 资源发出事件并更新其状态。如果重新加载失败，该事件会包含错误消息。

### NGINX Ingress Controller 是一个 Kubernetes 控制器

NGINX Ingress Controller 持续处理集群中的新增资源和现有资源的变更。因此，NGINX 配置始终与集群中的资源保持同步更新。
NGINX Ingress Controller 是 [Kubernetes 控制器](https://kubernetes.io/docs/concepts/architecture/controller/)的一个示例：NGINX Ingress Controller 运行一个控制循环，确保 NGINX 根据所需状态（Ingress 和其他资源）进行配置。