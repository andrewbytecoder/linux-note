


总体来看， Kubernetes API Server的核心功能是提供Kubernetes各类 资源对象（如Pod、 RC、 Service等） 的增、 删、 改、 查及Watch等HTTPREST接口， 成为集群内各个功能模块之间数据交互和通信的中心枢纽， 是整个系统的数据总线和数据中心。 除此之外， 它还是集群管理的API入口， 是资源配额控制的入口， 提供了完备的集群安全机制。

API Server架构从上到下可以分为以下几层:
- API层： 主要以REST方式提供各种API接口， 除了有 Kubernetes资源对象的CRUD和Watch等主要API， 还有健康检查、 UI、日志、 性能指标等运维监控相关的API。 Kubernetes从1.11版本开始废弃
Heapster监控组件， 转而使用Metrics Server提供Metrics API接口， 进一步完善了自身的监控能力。
- 访问控制层： 当客户端访问API接口时， 访问控制层负责对用户身份鉴权， 验明用户身份， 核准用户对Kubernetes资源对象的访问权限， 然后根据配置的各种资源访问许可逻辑（Admission Control） ， 判断是否允许访问。
- 注册表层： Kubernetes把所有资源对象都保存在注册表（Registry） 中， 针对注册表中的各种资源对象都定义了资源对象的类型、 如何创建资源对象、 如何转换资源的不同版本， 以及如何将资源编
码和解码为JSON或ProtoBuf格式进行存储。
- etcd数据库： 用于持久化存储Kubernetes资源对象的KV数据库。 etcd的Watch API接口对于API Server来说至关重要， 因为通过这个接口， API Server创新性地设计了List-Watch这种高性能的资源对象实时同步机制， 使Kubernetes可以管理超大规模的集群， 及时响应和快速处理集群中的各种事件。

![[image-2025-02-08-15-45-21-963.png]]


Kubernetes API Server本身也是一个Service， 它的名称就是kubernetes， 并且它的ClusterIP地址是ClusterIP地址池里的第1个地址！ 另外， 它所服务的端口是HTTPS端口443， 通过kubectl get
service命令可以确认这一点：

```bash
[root@k8smaster-72 ~]# kubectl get service
NAME         TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   23d
```




