
Service的表现形式为IP地址和端口号（ClusterIP： Port） ， 即工作在TCP/IP层。 而对于基于HTTP
的服务来说， 不同的URL地址经常对应到不同的后端服务或者虚拟服务器（Virtual Host） ， 这些应用层的转发机制仅通过Kubernetes的Service机制是无法实现的。

Ingress只能以HTTP和HTTPS提供服务， 对于使用其他网络协议的服务， 可以通过设置Service的类型（type） 为NodePort或LoadBalancer对集群外部的客户端提供服务。

使用Ingress进行服务路由时， Ingress Controller基于Ingress规则将客户端请求直接转发到Service对应的后端Endpoint（Pod） 上， 这样会跳过kube-proxy设置的路由转发规则， 以提高网络转发效率。

.http层路由
![[image-2025-02-08-14-16-30-278.png]]

- 对http://mywebsite.com/api的访问将被路由到后端名为api的Service上；
- 对http://mywebsite.com/web的访问将被路由到后端名为web的Service上；
- 对http://mywebsite.com/docs的访问将被路由到后端名为docs的Service上。
