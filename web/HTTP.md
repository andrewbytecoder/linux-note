### GET, POST, PUT... Common HTTP “verbs” in one figure


![[PixPin_2026-08-31_20-01-59.png]]


1. HTTP GET
	 用于获取资源
2. HTTP PUT  
    用于更新或创建资源。它是幂等的。多个相同的请求将更新同一个资源。
3. HTTP POST  
    用于创建新资源。它不是幂等的，发送两个相同的 POST 请求会导致资源被重复创建。
4. HTTP DELETE  
    用于删除资源。它是幂等的。多个相同的请求将删除同一个资源。
5. HTTP PATCH  
    PATCH 方法对资源应用部分修改。
6. HTTP HEAD  
    HEAD 方法要求的响应与 GET 请求相同，但不包含响应体。
7. HTTP CONNECT  
    CONNECT 方法建立到由目标资源标识的服务器的隧道。
8. HTTP OPTIONS  
    描述目标资源的通信选项。
9. HTTP TRACE  
    沿通往目标资源的路径执行消息回环测试。

交给你了：你还使用过哪些其他的 HTTP 动词（方法）？


