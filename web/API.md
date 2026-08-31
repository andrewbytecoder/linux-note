
## URL, URI, URN - Do you know the differences?
![[PixPin_2026-08-31_20-19-02.png]]

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