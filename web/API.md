
## URL, URI, URN - Do you know the differences?
![[Pasted image 20260902094639.png]]

 ### URI

URI 代表统一资源标识符（Uniform Resource Identifier）。它标识网络上的逻辑或物理资源。URL 和 URN 是 URI 的子类型。URL 用于定位资源，而 URN 用于命名资源。

URI 由以下部分组成：
```bash
scheme:[//authority]path[?query][#fragment]
（协议方案:[//授权信息]路径[?查询参数][#片段]）
```

### URL

URL 代表统一资源定位符（Uniform Resource Locator），是 HTTP 的核心概念。它是网络上唯一资源的地址。它也可以与其他协议（如 FTP 和 JDBC）一起使用。

### URN

URN 代表统一资源名称（Uniform Resource Name）。它使用 urn 协议方案。URN 不能用于定位资源。图中给出的一个简单示例由命名空间（namespace）和特定于命名空间的字符串（namespace-specific string）组成。





## 9种常见API测试场景

![[Pasted image 20260831162227.png]]

- smoke testing
	- api应用开发完成之后，简单的验证API接口是否正常工作
- functional testing
	- 创建测试计划，用来测试函数的入参和出产是否符合要求和预期
- integration testing
	- 集成测试，调用一些列接口，对一个功能的相关接口进行调用，并且输出的结果符合预期。一个功能实现往往有很多相关的接口，挨个调用之后最后给出结果的接口能符合预期。
- regression testing(回归测试)
	- 确保修复Bug或者新增功能时，不会破坏API原有的正常行为，这是CI/CD中常做的测试，保证版本迭代的稳定性。
- Load testing
	- 通过模拟预期内的不同并发流量，测试应用性能（响应时间，吞吐量），目的是评估系统正常承载容量。
- stresss testing(压力测试)
	- 故意制造出极限的高负载，观察API在极端状态下的表现，目的是寻找系统崩溃的临界点降级/恢复能力
- security testing
	- 测试API抵御外部威胁（如未授权访问、SQL注入、越权、数据泄露）的能力，确保接口的安全
- UI testing(UI测试/端到端界面交互测试)
	- 验证前端界面与后端API的联动，确保API返回的数据能在UI上正确渲染和展示
- Fuzz testing (模糊测试)
	- 向API注入遂鸡、异常、非法的数据（如长字符串、畸形JSON），试图让服务器崩溃，从而引发隐藏的漏洞和异常处理缺陷。


## 如何提供API的性能

![[PixPin_2026-08-31_16-43-22.png]]

1. Result Pagination (结果分页)
	- 避免单次查询返回海量数据导致内存溢出或网络阻塞，常见实现包括limit/offset、游标分页(Cursor-based, 如Kafaka/ES的Scroll)或者GraphQL的流式分页。
2. Asynchronous Logging(异步日志)
	- 业务线程不与磁盘的I/O同步阻塞，常用无锁队列（LMAX Disruptor)或异步Adppender(log4j2 AsyncAppender、Go的zap异步),在高并发下及其关键
3. Data Caching(数据缓存)
	- 经典Cache-Aside/Read-Through模式，除Redis外，本地缓存(Caffeine/go map)可挡一层，减少网络往返。
4. Payload Compression(负载压缩)
	- 文本/JSON等压缩率高，适合跨网络调用；但CPU有损耗，内网低延迟场景需权衡（如gRPC常用protobuf天然体积小）
5. Connection Pooling(连接池)
	- DB连接（TCP+认证）昂贵，连接池(HikarCP/Go sql.DB)是标配，同理HTTP Keep-Alive、gRPC多路复用也属连接复用。



## Evolving Landscape of API Protocols in 2023
In this blog post, I cover the six most popular API protocols: REST, Webhooks, GraphQL, SOAP, WebSocket, and gRPC. The discussion includes the benefits and challenges associated with each protocol.
![[Pasted image 20260831201511.png]]



## 12 Tips for API Security

![[PixPin_2026-08-31_20-05-06.png]]

- Use HTTPS
- Use OAuth2
- Use WebAuthn
- Use Leveled API Keys
- Authorization
- Rate Limiting
- API Versioning
- Whitelisting
- Check OWASP API Security Risks
- Use API Gateway
- Error Handling
- Input Validation




## The Ultimate API Learning Roadmap

![[Pasted image 20260902092946.png]]

## REST API Cheatsheet
![[Pasted image 20260902093041.png]]



## API 中如何设计分页功能
![[Pasted image 20260902093514.png]]

Pagination is crucial in API design to handle large datasets efficiently and improve performance. Here are six popular pagination techniques:  
在 API 设计中，分页处理对于高效处理大型数据集和提高性能至关重要。以下是六种常见的分页技术：

- **Offset-based Pagination:  基于补偿值的分页：**
    
    This technique uses an offset and a limit parameter to define the starting point and the number of records to return.  
    这种技术使用了一个偏移量和一个限制参数来定义返回的记录的起始点以及数量。
    
    - Example: GET /orders?offset=0&limit=3  
        示例：GET /orders?offset=0&limit=3
    - Pros: Simple to implement and understand.  
        优点：易于实施和理解。
    - Cons: Can become inefficient for large offsets, as it requires scanning and skipping rows.  
        缺点：对于较大的偏移量来说，这种处理方式可能会变得效率低下，因为它需要扫描并跳过一些行。
- **Cursor-based Pagination:  基于游标的分页：**
    
    This technique uses a cursor (a unique identifier) to mark the position in the dataset. Typically, the cursor is an encoded string that points to a specific record.  
    这种技术使用了一个光标（一个唯一的标识符）来标记数据集中的特定位置。通常，光标是一个编码后的字符串，用于指向某个具体的记录。
    
    - Example: GET /orders?cursor=xxx  
        例如：GET /orders?cursor=xxx
    - Pros: More efficient for large datasets, as it doesn’t require scanning skipped records.  
        优点：对于大型数据集来说效率更高，因为它不需要扫描那些被跳过的数据记录。
    - Cons: Slightly more complex to implement and understand.  
        缺点：实现和理解起来稍微复杂一些。
- **Page-based Pagination:  页面式分页：**
    
    This technique specifies the page number and the size of each page.  
    这种格式会明确标注每页的页码以及页面大小。
    
    - Example: GET /items?page=2&size=3  
        示例：GET /items?page=2&size=3
    - Pros: Easy to implement and use.  
        优点：易于实施和使用。
    - Cons: Similar performance issues as offset-based pagination for large page numbers.  
        缺点：与基于偏移量的分页方式一样，在处理大量页面时也会出现性能问题。
- **Keyset-based Pagination:  基于密钥的分页：**
    
    This technique uses a key to filter the dataset, often the primary key or another indexed column.  
    这种技术使用某个键来过滤数据集，通常使用的是主键或其他已索引的列。
    
    - Example: GET /items?after_id=102&limit=3  
        示例：GET /items?after_id=102&limit=3
    - Pros: Efficient for large datasets and avoids performance issues with large offsets.  
        优点：适用于大型数据集，能够避免因偏移量过大导致的性能问题。
    - Cons: Requires a unique and indexed key, and can be complex to implement.  
        缺点：需要一个独特且已索引的键，实现起来可能较为复杂。
- **Time-based Pagination:  基于时间的分页：**
    
    This technique uses a timestamp or date to paginate through records.  
    这种技术利用时间戳或日期来对记录进行分页处理。
    
    - Example: GET /items?start_time=xxx&end_time=yyy  
        例如：GET /items?start_time=xxx&end_time=yyy
    - Pros: Useful for datasets ordered by time, ensures no records are missed if new ones are added.  
        优点：适用于按时间排序的数据集，能够确保不会遗漏任何新添加的记录。
    - Cons: Requires a reliable and consistent timestamp.  
        缺点：需要可靠且一致的时间戳标记。
- **Hybrid Pagination:  混合式分页：**
    
    This technique combines multiple pagination techniques to leverage their strengths.  
    这种技术结合了多种分页技术，从而发挥各自的优势。
    
    - Example: Combining cursor and time-based pagination for efficient scrolling through time-ordered records.  
        示例：结合使用光标控制与基于时间的分页功能，以实现对按时间顺序排列的记录的高效滚动操作。
    - Example: GET /items?cursor=abc&start_time=xxx&end_time=yyy  
        例如：GET /items?cursor=abc&start_time=xxx&end_time=yyy
    - Pros: Can offer the best performance and flexibility for complex datasets.  
        优点：能够为复杂的数据集提供最佳的性能和灵活性。
    - Cons: More complex to implement and requires careful design.  
        缺点：实施起来更为复杂，需要仔细的设计和规划。



## HTTP/1 -> HTTP/2 -> HTTP/3
![[Pasted image 20260902093808.png]]

- **HTTP 1** (and its sub-versions) introduced features like persistent connections, pipelining, and the concept of headers. The protocol was built on top of TCP and provided a reliable way of communication over the World Wide Web. It is still used despite being over 25 years old.  
    HTTP 1 及其各种版本引入了诸如持久连接、流水线处理以及头部概念等功能。该协议建立在 TCP 之上，为万维网上的可靠通信提供了可能。尽管已经使用了超过 25 年，但它仍然被广泛应用。
- **HTTP 2** brought new features such as multiplexing, stream prioritization, server push, and HPACK compression. However, it still used TCP as the underlying protocol.  
    HTTP 2 带来了一些新的功能，如多路传输、流优先级分配、服务器推送以及 HPACK 压缩等。不过，它仍然使用 TCP 作为底层协议。
- **HTTP 3** uses Google’s QUIC, which is built on top of UDP. In other words, HTTP 3 has moved away from TCP.  
    HTTP 3 采用了谷歌开发的 QUIC 协议，该协议基于 UDP 协议构建。换句话说，HTTP 3 已经不再使用 TCP 协议了。

## Forward Proxy v.s. Reverse Proxy
![[Pasted image 20260902093901.png]]

## What is load balancer

![[Pasted image 20260902094127.png]]

A load balancer is a device or software application that distributes network or application traffic across multiple servers.  
负载均衡器是一种设备或软件应用程序，它能够将网络或应用程序的流量分配到多个服务器上进行处理。

- **What Does a Load Balancer Do?  
    负载均衡器的作用是什么？**
    
    - Distributes Traffic  分配流量
    - Ensures Availability and Reliability  
        确保系统的可用性和可靠性。
    - Improves Performance  提升了性能
    - Scales Applications  缩放应用程序
- **Types of Load Balancers  负载均衡器的类型**
    
    - Hardware Load Balancers: These are physical devices designed to distribute traffic across servers.  
        硬件负载均衡器：这些是一种物理设备，旨在将流量分配到不同的服务器上。
    - Software Load Balancers: These are applications that can be installed on standard hardware or virtual machines.  
        软件负载均衡器：这类应用程序可以安装在标准的硬件或虚拟机器上。
    - Cloud-based Load Balancers: Provided by cloud service providers, these load balancers are integrated into the cloud infrastructure. Examples include AWS Elastic Load Balancer, Google Cloud Load Balancing, and Azure Load Balancer.  
        基于云的负载均衡器：由云服务提供商提供这些负载均衡器，它们被集成到云基础设施中。例如 AWS Elastic Load Balancer、Google Cloud Load Balancing 和 Azure Load Balancer 等。
    - Layer 4 Load Balancers (Transport Layer): Operate at the transport layer (OSI Layer 4) and make forwarding decisions based on IP address and TCP/UDP ports.  
        第 4 层负载均衡器（传输层）：在传输层运行，根据 IP 地址和 TCP/UDP 端口来做出转发决策。
    - Layer 7 Load Balancers (Application Layer): Operate at the application layer (OSI Layer 7).  
        第 7 层负载均衡器（应用层）：在应用层运行（OSI 第 7 层）。
    - Global Server Load Balancing (GSLB): Distributes traffic across multiple geographical locations to improve redundancy and performance on a global scale.  
        全球服务器负载均衡（GSLB）：通过将流量分配到多个地理位置，从而在全球范围内提高系统的冗余性和性能。

## Build secure APIs 
![[Pasted image 20260902094420.png]]
An insecure API can compromise your entire application. Follow these strategies to mitigate the risk:  
不安全的 API 可能会威胁到整个应用程序的安全。遵循以下策略来降低风险：

### Using HTTPS  使用 HTTPS

- Encrypts data in transit and protects against man-in-the-middle attacks.  
    在数据传输过程中对数据进行加密处理，从而防止中间人攻击的发生。
- This ensures that data hasn’t been tampered with during transmission.  
    这确保了在数据传输过程中数据没有被篡改。

### Rate Limiting and Throttling  
速率限制与带宽限制

- Rate limiting prevents DoS attacks by limiting requests from a single IP or user.  
    速率限制可以通过限制来自单个 IP 地址或用户的请求数量来防止 DoS 攻击。
- The goal is to ensure fairness and prevent abuse.  
    我们的目标是确保公平性，并防止滥用行为的发生。

### Validation of Inputs  输入数据的验证

- Defends against injection attacks and unexpected data format.  
    能够防御注入攻击以及意外出现的数据格式问题。
- Validate headers, inputs, and payload.  
    验证头部信息、输入数据以及负载内容。

### Authentication and Authorization  
认证与授权

- Don’t use basic auth for authentication.  
    不要使用基本认证来进行身份验证。
- Instead, use a standard authentication approach like JWTs  
    相反，应该使用标准的认证方式，比如 JSON Web Tokens。
    - Use a random key that is hard to guess as the JWT secret  
        使用一个难以猜测的随机密钥作为 JWT 的秘密密钥。
    - Make token expiration short -For authorization, use OAuth  
        将令牌的有效期设置得更短一些——为了授权目的，建议使用 OAuth 机制。

### Using Role-based Access Control  
采用基于角色的访问控制机制

- RBAC simplifies access management for APIs and reduces the risk of unauthorized actions.  
    RBAC 简化了 API 的访问管理，降低了未经授权操作的风险。
- Granular control over user permission based on roles.  
    基于角色的精细权限控制，对用户的权限进行精细化管理。

### Monitoring  监控

- Monitoring the APIs is the key to detecting issues and threats early.  
    监控 API 是及时发现问题和威胁的关键。
    - Use tools like Kibana, Cloudwatch, Datadog, and Slack for monitoring  
        使用 Kibana、Cloudwatch、Datadog 和 Slack 等工具来进行监控。
    - Don’t log sensitive data like credit card info, passwords, credentials, etc.  
        请不要记录诸如信用卡信息、密码、认证信息等敏感数据。

## # Unicast vs Broadcast vs Multicast vs Anycast  
单播与广播、多播与任意播的区别

![[Pasted image 20260902094818.png]]

These are 4 network communication methods you must know.  
这四种网络通信技术是你必须了解的。

- **Unicast  单播**
    
    Unique sender and a single receiver.  
    唯一的发件人和唯一的收件人。
    
    For example, communication between two people in a party.  
    例如，在聚会中，两个人之间的交流。
    
    Used in protocols such as HTTP, FTP, and SMTP.  
    它被用于诸如 HTTP、FTP 和 SMTP 等协议中。
    
- **Broadcast  广播**
    
    Single sender and multiple receivers.  
    单个发送者，多个接收者。
    
    For example, a person at a party stands up on a podium and shouts a message to everyone. However, it doesn’t mean that every receiver gets the message.  
    例如，在派对上，一个人站在讲台上大声喊出信息，但并不意味着每个听到信息的人都能理解这个消息。
    
    Used in Address Resolution Protocol, DHCP, and NTP  
    用于地址解析协议、DHCP 和 NTP 中
    
- **Multicast  组播**
    
    Sender to a specific group of devices in a network. This is a specialized case of broadcast routing.  
    发送给网络中特定一组设备的消息。这是一种特殊的广播路由方式。
    
    For example, a member of the group talks and listens to other members of the group within a party.  
    例如，在聚会中，一个小组的成员会与其他成员进行交谈和倾听他们的意见。
    
    Used in IPTV and video conference applications.  
    适用于 IP 电视和视频会议应用。
    
- **Anycast  任意转播**
    
    Sender to a single device or a specific group of devices.  
    发送给单个设备或特定一组设备的消息。
    
    For example, saying thank you to one host out of a group of hosts organizing a party. All other hosts also expected to receive the thank you note.  
    例如，向一群组织派对的主人中的一位表示感谢。其他所有主人也都会期望收到这份感谢信。
    
    Used in DNS querying and CDNs.  
    用于 DNS 查询和内容分发网络中。

## API 设计的八条建议
![[Pasted image 20260902095956.png]]

- **Domain Model Driven** When designing the path structure of a RESTful API, we can refer to the domain model.  
    在设计 RESTful API 的路径结构时，我们可以参考领域模型。
- **Choose Proper HTTP Methods** Defining a few basic HTTP Methods can simplify the API design. For example, PATCH can often be a problem for teams.  
    选择合适的 HTTP 方法。定义一些基本的 HTTP 方法可以简化 API 的设计。例如，PATCH 方法对于团队来说往往是个问题。
- **Implement Idempotence Properly** Designing for idempotence in advance can improve the robustness of an API. GET method is idempotent, but POST needs to be designed properly to be idempotent.  
    正确实现幂等性非常重要。提前考虑幂等性问题可以提升 API 的鲁棒性。GET 方法具有幂等性，但 POST 方法的实现也需要妥善处理，以确保其具有幂等性。
- **Choose Proper HTTP Status Codes** Define a limited number of HTTP status codes to use to simplify application development.  
    选择适当的 HTTP 状态码。定义少量常用的 HTTP 状态码，以简化应用程序的开发过程。
- **Versioning** Designing the version number for the API in advance can simplify upgrade work.  
    版本管理：提前设计好 API 的版本号可以简化升级过程。
- **Semantic Paths** Using semantic paths makes APIs easier to understand, so that users can find the correct APIs in the documentation.  
    语义路径使得 API 的文档更加易于理解，用户能够轻松找到文档中的正确 API。
- **Batch Processing** Use batch/bulk as a keyword and place it at the end of the path.  
    批量处理 使用“批量/批量处理”作为关键词，并将其置于路径的末尾。
- **Query Language** Designing a set of query rules makes the API more flexible. For example, pagination, sorting, filtering etc.  
    查询语言设计：制定一套查询规则可以使 API 更加灵活。例如，分页、排序、过滤等功能都可以实现





