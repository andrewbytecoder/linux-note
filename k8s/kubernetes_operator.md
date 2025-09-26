
Operators通过扩展Kubernetes控制平面和API来工作。在最简单的形式中，Operator向Kubernetes API添加端点，称为自定义资源（CR），以及监视和维护新类型资源的控制平面组件。然后，Operators可以根据资源的状态采取操作
![[Pasted image 20250926091353.png]]

- Kubernetes CRs
CRs are the API extension mechanism in Kubernetes. A custom resource definition (CRD) defines a CR; it’s analogous to a schema for the CR data. A cluster user can interact with CRs with kubectl or another Kubernetes client, just like any other API resource.

