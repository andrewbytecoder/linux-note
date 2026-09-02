


## Kubernetes Deployment Strategies

![[Pasted image 20260902110059.png]]
![[Pasted image 20260902110304.png]]

Each strategy offers a unique approach to manage updates.  
每种策略都提供了独特的更新管理方法。

### Recreate  重新创造

All existing instances are terminated at once, and new instances with the updated version are created.  
所有现有的实例将立即被终止，同时会创建出使用更新版本的新实例。

- Downtime: Yes  停机时间：是的
- Use case: Non-critical applications or during initial development stages  
    应用场景：非关键型应用程序或初期开发阶段

### Rolling Update  滚动更新

Application instances are updated one by one, ensuring high availability during the process.  
应用程序实例会逐一进行更新，从而在更新过程中确保高可用性。

- Downtime: No  停机时间：没有
- Use case: Periodic releases  
    使用场景：定期发布版本

### Shadow  阴影

A copy of the live traffic is redirected to the new version for testing without affecting production users.  
一份实时流量的副本被重定向到新版本上进行测试，而不会影响到实际用户的使用体验。

This is the most complex deployment strategy and involves establishing mock services to interact with the new version of the deployment.  
这是最复杂的部署策略，需要创建模拟服务来与新版本的部署系统进行交互。

- Downtime: No  停机时间：没有
- Use case: Validating new version performance and behavior in a real environment  
    应用场景：在真实环境中验证新版本的性能和表现

### Canary  金丝雀

The new version is released to a subset of users or servers for testing before broader deployment.  
新版本会先发布给一部分用户或服务器进行测试，然后再进行更广泛的部署。

- Downtime: No  停机时间：没有
- Use case: Impact validation on a subset of users  
    用例：对部分用户进行影响验证

### Blue-Green  蓝绿色

- Two identical environments are maintained: one with the current version (blue) and the other with the updated version (green).  
    同时维护着两种相同的环境：一种使用的是当前版本（蓝色），另一种则使用的是更新后的版本（绿色）。
    
- Traffic starts with blue, then switches to the prepared green environment for the updated version.  
    交通信号首先呈现为蓝色，随后转变为适用于更新版本的绿色信号环境。
    
- Downtime: No  停机时间：没有
    
- Use case: High-stake updates  
    应用场景：高风险更新操作
    

### A/B Testing  A/B 测试

Multiple versions are concurrently tested on different users to compare performance or user experience.  
会在不同用户环境中同时测试多个版本，以比较各自的性能或用户体验。

- Downtime: Not directly applicable  
    停机时间：不适用
- Use case: Optimizing user experience  
    应用场景：优化用户体验

























