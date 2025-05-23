

在Kubernetes系统中， 将对容器应用所需的存储资源抽象为存储卷（Volume） 概念来解决容器内部存储的生命周期是短暂的， 会随着容器环境的销毁而销毁， 具有不稳定性的问题。

## 将资源对象映射为存储卷

在Kubernetes中有一些资源对象可以以存储卷的形式挂载为容器内的目录或文件， 目前包括ConfigMap、 Secret、 Downward API、ServiceAccountToken、 Projected Volume。

### ConfigMap

ConfigMap主要保存应用程序所需的配置文件， 并且通过Volume形式挂载到容器内的文件系统中， 供容器内的应用程序读取。

在Pod的YAML配置中， 可以将ConfigMap设置为一个Volume， 然后在容器中通过volumeMounts将ConfigMap类型的Volume挂载到/configfiles目录下

### Secret

与ConfigMap的用法类似， 在Pod的YAML配置中可以将Secret设置为一个Volume， 然后在容器内通过volumeMounts将Secret类型的Volume挂载到Pod目录下

### Downward API

通过Downward API可以将Pod或Container的某些元数据信息（例如Pod名称、 Pod IP、 Node IP、 Label、 Annotation、 容器资源限制等） 以文件的形式挂载到容器内， 供容器内的应用使用。

### Projected Volume和Service Account Token

Projected Volume是一种特殊的存储卷类型， 用于将一个或多个上述资源对象（ConfigMap、 Secret、 Downward API） 一次性挂载到容器内的同一个目录下。

## Node本地存储卷

Kubernetes管理的Node本地存储卷（Volume） 的类型如下：

* EmptyDir： 与Pod同生命周期的Node临时存储目录。
* HostPath： Node本地目录。‘
* Local： 基于持久化(PV)管理的Node目录

- EmptyDir
    这种类型的Volume将在Pod被调度到Node时进行创建， 在初始状态下目录中是空的， 所以命名为“空目录”（Empty Directory） ， 它与Pod具有相同的生命周期， 当Pod被销毁时， Node上相应的目录也会被删除。同一个Pod中的多个容器都可以挂载这种Volume。
    另外，EmptyDir可以通过medium字段设置存储介质为“Memory”，表示使用基于内存的文件系统（tmpfs、 RAM-backed filesystem） 。 虽然tmpfs的读写速度非常快， 但与磁盘中的目录不同， 在主机重启之后， tmpfs的内容就会被清空。 此外， 写入tmpfs的数据将被统计为容器的内存使用量， 受到容器级别内存资源上限（Memory Resource Limit） 的限制。

- HostPath
    HostPath类型的存储卷用于将Node文件系统的目录或文件挂载到容器内部使用。 对于大多数容器应用来说， 都不需要使用宿主机的文件系统。HostPath创建类型支持指定，比如文件不存在是创建还是挂在失败等。


## 持久卷（Persistent Volume） 详解

在Kubernetes中， 对存储资源的管理方式与计算资源（CPU/内存）截然不同。 为了能够屏蔽底层存储实现的细节， 让用户方便使用及管理员方便管理， Kubernetes从1.0版本开始就引入了Persistent Volume（PV） 和Persistent Volume Claim（PVC） 两个资源对象来实现存储管理子系统。

PV（ 持久卷） 是对存储资源的抽象， 将存储定义为一种容器应用可以使用的资源。

PVC则是用户对存储资源的一个申请。 就像Pod消耗Node的资源一样， PVC消耗PV资源。

### 资源回收（Reclaiming）

用户在使用存储资源完毕后， 可以删除PVC。 与该PVC绑定的PV将被标记为“已释放”， 但还不能立刻与其他PVC绑定。 通过之前PVC写入的数据可能还被留在存储设备上， 只有在清除这些数据之后， 该PV才能再次使用。

管理员可以对PV设置资源回收策略（Reclaim Policy） ， 可以设置3种回收策略： Retain、 Delete和Recycle。

* Retain： 用户删除PVC后， PV不会被删除， 而是 remains in the system and marked as “Released” until an administrator manually reclaims it.
    Retain策略表示在删除PVC之后， 与之绑定的PV不会被删除， 仅被标记为已释放（released） 。 PV中的数据仍然存在， 在清空之前不能被新的PVC使用， 需要管理员手工清理之后才能继续使用 +
    手工删除后端存储资产。 如果希望重用该存储资产， 则可以创建一个新的PV与之关联。

* Delete： 用户删除PVC后， PV会被删除， 存储资源也会被释放。
* Recycle： 用户删除PVC后， PV会被重新初始化， 存储资源会被清空。

































