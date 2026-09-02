
## API Gateway

![[Pasted image 20260902093306.png]]


步骤 1：客户端向 API 网关发送一个 HTTP 请求。
步骤 2——API 网关会解析并验证 HTTP 请求中的各项属性。
步骤 3——API 网关会执行允许列表/禁止列表的检查。
步骤 4——API 网关与身份提供者进行通信，以完成身份验证和授权操作。
步骤 5——这些速率限制规则会被应用于该请求。如果请求超出了限制范围，那么该请求将被拒绝。
步骤 6 和 7——现在，该请求已经通过了基本检查，API 网关会根据路径匹配规则找到需要路由到的相关服务。
步骤 8——API 网关将请求转换为相应的协议格式，然后将其发送给后端微服务。
步骤 9-12：如果错误导致系统长时间无法恢复（如电路中断），API 网关能够正确处理这些错误。此外，该网关还可以利用 ELK 框架来进行日志记录和监控。有时，我们会在 API 网关中缓存数据。



![[Pasted image 20260902095513.png]]


## Load Balancer vs. API Gateway
![[Pasted image 20260902095705.png]]

First, let’s clarify some concepts before discussing the differences.  
首先，在讨论这些差异之前，让我们先明确一些概念。

- NLB (Network Load Balancer) is usually deployed before the API gateway, handling traffic routing based on IP. It does not parse the HTTP requests.  
    NLB（网络负载均衡器）通常部署在 API 网关之前，负责基于 IP 地址进行流量路由处理。它并不解析 HTTP 请求。
- ALB (Application Load Balancer) routes requests based on HTTP header or URL and thus can provide richer routing rules. We can choose the load balancer based on routing requirements. For simple services with a smaller scale, one load balancer is enough.  
    ALB（应用负载均衡器）根据 HTTP 头或 URL 来路由请求，因此能够提供更复杂的路由规则。根据路由需求，我们可以选择合适的负载均衡器。对于规模较小的简单服务来说，一个负载均衡器就足够了。
- The API gateway performs tasks more on the application level. So it has different responsibilities from the load balancer.  
    API 网关主要在应用层面执行任务，因此它与负载均衡器的职责有所不同。

The diagram above shows the detail. Often, they are used in combination to provide a scalable and secure architecture for modern web apps.  
上图详细展示了这些技术的运作方式。通常，这些技术会结合使用，以打造出可扩展且安全的现代 Web 应用程序架构。

Option a: ALB is used to distribute requests among different services. Due to the fact that the services implement their own rating limitation, authentication, etc., this approach is more flexible but requires more work at the service level.  
选项 a：ALB 用于在不同服务之间分配请求。由于各个服务都实施了各自的评级限制、认证机制等，因此这种分配方式更加灵活，但需要在服务层面进行更多的处理工作。

Option b: An API gateway takes care of authentication, rate limiting, caching, etc., so there is less work at the service level. However, this option is less flexible compared with the ALB approach.  
选项 b：API 网关可以负责身份验证、速率限制、缓存等功能，因此服务层的操作就相对较少。不过，与使用 ALB 的方式相比，这种方式的灵活性稍差一些。
































