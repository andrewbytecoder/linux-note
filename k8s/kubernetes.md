从过去以物理机和虚拟机为主体的开发运维环境，向以容器为核心的基础设施的转变过程，并不是一次温和的改革，而是涵盖了对网络、存储、调度、操作系统、分布式原理等各个方面的容器化理解和改造。这些关于 Linux 内核、分布式系统、网络、存储等方方面面的积累，并不会在Docker 或者 Kubernetes 的文档中交代清楚。可偏偏就是它们，才是真正掌握容器技术体系的精髓所在。

Kubernetes是一个 **生产级别的容器编排平台和集群管理系统**，不仅能够创建、调度容器，还能够监控、管理服务器。


```bash
# 启动kubernetes集群
miikube start
# 查看集群状态
minikube node list
# 查看版本
kubectl version
# 登录节点
minikube ssh
# 在kubernetes里面运行一个nginx应用
# --image 指定镜像
kubectl run ngx --image=nginx:alpine
# kubernetes中 "容器" 为pod，查看pod需要可以使用 `kubectl get pod`，效果类似 docker ps
kubectl get pod
```


.kubectl说明
****
使用minikube自带的kubectl有一点限制，需要在前面加上minikube，例如： `minikube kubectl -- version` 为了避免这个问题可以使用alias功能，将 `alias kubectl="minikube kubectl --"` 添加到`.bashrc` 里面。

如果使用的是bash环境，需要打开kubectl的命令自动补全功能，还需要在 `.bashrc`后面添加如下命令：
`source <(kubectl completion bash)`
****

.kubectl常用命令
```bash
# 部署应用
kubectl apply -f app.yaml
# 查看 deployment
kubectl get deployment
# 查看 pod
kubectl get pod -o wide
# 查看 pod 详情
kubectl describe pod pod-name
# 查看 log
kubectl logs pod-name [-f]
# 进入 Pod 容器终端， -c container-name 可以指定进入哪个容器。
kubectl exec -it pod-name -- bash
# 伸缩扩展副本
kubectl scale deployment test-k8s --replicas=5
# 把集群内端口映射到节点
kubectl port-forward pod-name 8090:8080
# 查看历史
kubectl rollout history deployment test-k8s
# 回到上个版本
kubectl rollout undo deployment test-k8s
# 回到指定版本
kubectl rollout undo deployment test-k8s --to-revision=2
# 删除部署
kubectl delete deployment test-k8s

# =============更多命令============
# 查看命名空间
kubectl get ns
# 查看全部
kubectl get all
# 重新部署
kubectl rollout restart deployment test-k8s
# 命令修改镜像，--record 表示把这个命令记录到操作历史中
kubectl set image deployment test-k8s test-k8s=ccr.ccs.tencentyun.com/k8s-tutorial/test-k8s:v2-with-error --record
# 暂停运行，暂停后，对 deployment 的修改不会立刻生效，恢复后才应用设置
kubectl rollout pause deployment test-k8s
# 恢复
kubectl rollout resume deployment test-k8s
# 输出到文件
kubectl get deployment test-k8s -o yaml >> app2.yaml
# 删除全部资源
kubectl delete all --all

```


## kubernetes工作机制

.kubernetes工作机制
![[344e0c6dc2141b12f99e61252110f6b7.png]]

- master node 主控节点
- worker node 工作节点

.查看kubernetes的节点状态
```bash
# 当集群中节点比较少时，master和 node节点不是绝对区分的，工作负载小的时候master也能承担部分node的工作，自己搭建的节点，这个节点一般即是master也是node节点
kubectl get node
```

.插件和组件
****
内部节点按照模块划分又可以分为：组件和插件，组件必不可少，插件属于锦上添花。

- 组件
 1. apiserver Master节点
 2. etcd
 3. scheduler - 负责容器编排工作
 4. controller-manager 维护容器节点等资源状态，故障检测，服务迁移，应用伸缩，相当于监控运维人员

```bash
# -n kube-system 制定命名空间位 kube-system
[root@k8smaster-67 ~]# kubectl get pod -n kube-system
NAME                                   READY   STATUS    RESTARTS        AGE
coredns-75989b4c59-ljs7q               1/1     Running   0               6d21h
coredns-75989b4c59-n292l               1/1     Running   0               6d21h
kube-apiserver-k8smaster-67            1/1     Running   0               6d21h
kube-controller-manager-k8smaster-67   1/1     Running   2 (6d21h ago)   6d21h
kube-proxy-q4jpd                       1/1     Running   0               6d21h
kube-scheduler-k8smaster-67            1/1     Running   0               6d21h
metrics-server-c5647665b-z29gg         1/1     Running   0               6d21h
```

组件需要收集各种信息才能做出决策，这些信息来源一般是通过插件来获取的：

- 插件
 1. kubelet 与apiserver通信，实现状态报告，命令下发，启停容器等
 2. kube-proxy node网络代理，转发Pod网络数据
 3. container-runtime 在kubelet指挥下创建容器管理Pod生命周期，一般搭建测试平台时使用docker，生产环境一般使用CRI-O，containerd等。
****


.工作流程
![[344e0c6dc2141b12f99e61252110f6b7.png]]

- 每个node节点上的Kubelet会定期向apiserver上报节点状态，apiserver再存储到etcd里面。
- kube-proxy 提供tcp/udp反向代理，让容器能对外提供稳定的服务
- scheduler通过apiserver得到当前的节点状态，调度Pod，然后apiserver下发命令给某个Node的kubelet，kubelet调用container-runtime启动容器。
- controller-manager也通过apiserver得到实时的节点状态，监控可能的异常情况，再使用相应的手段去调节恢复


## 安装

```bash
# 将初始化过程中的默认配置保存到 init.default.yaml，可以根据需要修改之后在启动init
kubeadm config print init-defaults > init-config.yaml
# 查看镜像列表
kubeadm config images list
# 下载镜像
kubeadm config images pull --config=init-config.yaml
# 执行预检查
kubeadm init phase preflight
# 关闭预检查，默认情况下kubeadm init会执行预检查，如果不想进行预检查可以通过 --ignorepreflight-erros参数进行关闭
kubeadm init --ignorepreflight-errors
# 初始化
kubeadm init --config=init-config.yaml
```

Kubernetes默认设置cgroup驱动（cgroupdriver）
为“systemd”， 而Docker服务的cgroup驱动默认值为“cgroupfs”， 建议将
其修改为“systemd”， 与Kubernetes保持一致。

.`/etc/docker/daemon.json`
```bash
{
  "exec-opts": ["native.cgroupdriver=system"]
}
```


## Yaml

Kubernetes使用的YAML语言有一个非常关键的特性，叫“声明式”（Declarative），对应的有另外一个词：“命令式”（Imperative）。

- 命令式：程序员一步一步制定计算机下一步需要执行的动作
- 声明式：程序员只管目的，不管怎么实现，只要是能达到要的结果就行。

### 什么是YAML

YAML（YAML Ain’t Markup Language，YAML 不是一种标记语言）是一种数据序列化格式，它以一种易读易写的格式来存储和表示数据。

**YAML是JSON的超集**

任何合法的JSON文档也都是YAML文档，但是相比起来，YAML更简洁，更易读。

- 使用空白表示缩进和层次，类似于Python但是不可以使用花括号和方括号
- 使用#表示注释
- 对象字典中Key不需要使用双引号
- 数组是使用 - 开头的清单形式，- 后面加空格
- 使用 : 表示对象，后面要加空格
- 使用 --- 在同一个文件中分割多个YAML对象

YAML支持的数据类型有：

- 数组
- 浮点数
- 字符串
- 整数
- 布尔值
- 对象

### 在kubectl中如何写yaml文件

- 使用 `kubectl api-resources` 查看资源的api版本和类型

- 使用 `kubectl explain` 查看资源字段的详细描述

```bash
kubectl explain pod
kubectl explain pod.metadata
kubectl explain pod.spec
kubectl explain pod.spec.containers
```

- kubectl有两个特殊参数 `--dry-run=client` 和 `-o yaml`，前者是空运行，后者是生成YAML格式，结合起来使用就会让kubectl不会有实际的创建动作，而只生成YAML文件

.eg 调用示例
```bash
[root@k8smaster-67 ~]# kubectl run ngx --image=nginx:alpine --dry-run=client -o yaml
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: ngx
  name: ngx
spec:
  containers:
  - image: nginx:alpine
    name: ngx
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
```


.eg ngx yaml
```yaml
# header
apiVersion: v1
kind: Pod
metadata:
  name: ngx-pod
  labels:
    env: demo
    owner: chrono

# body specification
spec:
  containers:
  - image: nginx:alpine
    name: ngx
    ports:
    - containerPort: 80
```

> `kubectl get pod --v=9` 添加 --v=9可以查看kubectl执行命令的详细过程

## kubernetes核心概念

- Pod：Pod原意是豌豆荚，是kubernetes的最小运行单位，一个Pod可以包含一个或多个容器，每个容器必须包含一个镜像，每个Pod至少包含一个容器。

> 为了解决一些特殊情况下多个应用无法完全独立运行，需要相互依赖，但有不能直接破坏容器的隔离性的问题，需要在容器外部建立一个收纳仓来管理容器，这个收纳仓就是Pod，Pod能够让多个容器既保持相对独立，又能小范围内共享网络、存储等资源，而且永远是绑定在一起的状态。“spec.containers”字段其实是一个数组，里面允许定义多个容器。

### 为什么Pod是kubernets的核心对象

因为Pod是对容器的“打包”，里面的容器是一个整体，总是能够一起调度、一起运行，绝不会出现分离的情况，而且Pod属于Kubernetes，可以在不触碰下层容器的情况下任意定制修改。所以有了Pod这个抽象概念，Kubernetes在集群级别上管理应用就会“得心应手”了。

Kubernetes让Pod去编排处理容器，然后把Pod作为应用调度部署的 **最小单位**，Pod也因此成为了Kubernetes世界里的“原子”（当然这个“原子”内部是有结构的，不是铁板一块），基于Pod就可以构建出更多更复杂的业务形态了。

### kubectl通过yaml操作Pod

```bash
# 按照指定的yaml文件创建pod
kubectl apply -f busy-pod.yaml
# 按照指定的yaml文件删除pod
kubectl delete -f busy-pod.yaml
# 当然因为yaml中有指定pod的名字，可以直接通过Pod名字删除
kubectl delete pod busy-pod
```

pod名也能用来查看对应pod的日志 `kubectl logs pod-name`， 如果pod在命名空间里面运行，查看时需要指定对应的命名空间， `kubectl logs pod-name -n namespace` 如果通过装填或者日志信息查看对应的pod有问题，可以通过 `kubectl describe pod busy-pod -n namespace` 来查看pod的详细信息，对排查问题非常有用

```bash
# 获取pod 列表
kubectl get pod -n kube-system
# 获取pod 日志
kubectl logs pod-name  -n kube-system
# 获取pod 描述信息
kubectl describe pod pod-name -n kube-system
```

> 在Kubernetes中所有的pod都是默认在后台运行，因此需要查看哪个pod的日志需要通过 `kubectl logs命令来查看`

kubectl也提供类似于docker的cp和exec命令， `kubectl cp` 将本地文件拷贝到Pod，`kubectl exec` 进入到Pod内部执行Shell命令

```bash
# 将本地文件拷贝到Pod，如果Pod里面多个容器，需要使用-c指定具体的容器名，不过一般一个pod里面只有一个容器，所以一般不用指定容器名
kubectl cp a.txt ngx-pod:/tmp
# 进入到Pod内部执行Shell命令
# 和docker exec命令类似，但是需要再Pod后面加上 -- 来把kubectl命令和shell民工分割开
kubectl exec -it ngx-pod -- sh
```

## Job/CronJob

- 在线业务：nginx等需要长时间运行的业务
- 离线业务：执行一段时间之后必定会退出，主要分为两种：
    1. 临时任务，跑完结束，对应API对象 Job
    2. 定时任务，对应API对象 CronJob

### 使用YAML来描述Job

创建一个job使用 `kubectl create job`，注意这里与pod不同的是 create，创建Pod需要使用run，而创建job需要使用create。

创建一个echo job

```bash
export out="--dry-run=client -o yaml"
kubectl create job echo-job --image=busybox $out
```

会输出一个YAML样板，然后对其进行适当修改就会得到一个Job对象，运行之后使用 `kubectl get job 或 kubectl describe pod` 查看运行状态

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: echo-job
spec:
  template:
    spec:
      # job中执行失败的处理方式 `OnFailure` 是失败原地重启容器，而 `Never` 则是不重启容器，让Job去重新调度生成一个新的Pod
      restartPolicy: OnFailure
      containers:
      - image: busybox
        name: echo-job
        imagePullPolicy: IfNotPresent
        command: ["/bin/echo"]
        args: ["hello", "world"]
```

和pod不一样的地方是，在spec字段里面有一个template字段里面嵌入了一个spec，这样Job就可以使用这个Pod的模板来创建Pod了，这个Pod受Job管制，不直接和apiserver打交道，因此apiVersion等字段不需要再次重复，只需要定义好spec描述好容器相关的信息就可以了。


### 使用YAML描述CronJob

CronJob和Job最大的区别是，CronJob可以按照一定的时间周期来调度Job。

.生成一个CronJob的YAML模板
```bash
export out="--dry-run=client -o yaml"              # 定义Shell变量
kubectl create cj echo-cj --image=busybox --schedule="" $out
```

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  creationTimestamp: null
  name: echo-cj
spec:
  jobTemplate:
    metadata:
      creationTimestamp: null
      name: echo-cj
    spec:
      template:
        metadata:
          creationTimestamp: null
        spec:
          containers:
          - image: busybox
            name: echo-cj
            resources: {}
          restartPolicy: OnFailure
  schedule: "*/1 * * * *"
status: {}
```

我们还是重点关注它的 `spec` 字段，你会发现它居然连续有三个 `spec` 嵌套层次：

- 第一个 `spec` 是CronJob自己的对象规格声明
- 第二个 `spec` 从属于“jobTemplate”，它定义了一个Job对象。
- 第三个 `spec` 从属于“template”，它定义了Job里运行的Pod。

除了定义Job对象的“ **jobTemplate**”字段之外，CronJob还有一个新字段就是“ **schedule**”，用来定义任务周期运行的规则。它使用的是标准的Cron语法，指定分钟、小时、天、月、周，和Linux上的crontab是一样的。

> Cron语法参考： https://crontab.guru[crontab]

## ConfigMap & Secret 怎样配置以及定制应用

[[ConfigMap_Secret怎样配置以及定制应用]]

应用程序为了实现部分功能定制化，往往通过配置文件来完成。在前面学习Dockerfile时，通过CP命令将配置打包到镜像里面，或者运行时通过docker cp或者dokcer run -v本机文件复制到容器。

在Kubernetes中，为了方便配置文件的管理，提供了ConfigMap和Secret两种对象类型，它们都是用来存储配置文件的。

### ConfigMap/Secret

- 明文配置，不加密，可以任意修改的配置，如服务端口，运行参数
- 机密配置，密码、密钥、证书等

ConfigMap和Secret都是用来存储配置文件的，但是ConfigMap可以存储明文配置，而Secret可以存储加密的配置。

*ConfigMap*

同样也可以使用kubectl来创建一个ConfigMap模板

```bash
export out="--dry-run=client -o yaml"        # 定义Shell变量
kubectl create cm info $out
# 不过为了提阿加data字段通常会加上 --from-literal=k=v 字段
kubectl create cm info --from-literal=k=v $out
```

其运行结果如下：

.eg ConfigMap data
```yaml
apiVersion: v1
data:
  k: "v"
kind: ConfigMap
metadata:
  creationTimestamp: null
  name: info
```

> 因为在ConfigMap里的数据都是Key-Value结构，所以 `--from-literal` 参数需要使用 `k=v` 的形式

当需要创建ConfigMap对象时，同样使用 `kubectl apply -f cm.yaml` 来创建一个ConfigMap对象。

创建成功之后，使用 `kubectl  get` `kubectl describe` 来查看ConfigMap的状态

*Secret*
secret里面的数据只是进行了base64加密，如果需要更加安全的方式需要开启Secret加密插件。
Secret中又对对象细分了很多种：

- 访问私有镜像仓库的认证信息
- 身份识别的凭证信息
- HTTPS 通信的证书和私钥
- 一般的机密信息（格式由用户自行解释）

最后一种使用的最多，创建方式为：

```bash
kubectl create secret generic user --from-literal=name=root $out
```

```yaml
apiVersion: v1
data:
  name: cm9vdA==
kind: Secret
metadata:
  creationTimestamp: null
  name: user
```

> data里面是经过base64编码的明文，如果需要自行扩展可以使用 `echo -n "root"`  其中的-n命令是去除字符串隐藏的换行符，否则Base64编码出来的结果是错误的。

其余的操作方式和ConfigMap一样

```bash
kubectl apply -f secret.yml
kubectl get secret
kubectl describe secret user
```

### 如何以环境变量的方式使用ConfigMap/Secret

因为ConfigMap和Secret只是一些存储在etcd里的字符串，所以如果想要在运行时产生效果，就必须要以某种方式“ **注入**”到Pod里，让应用去读取。在这方面的处理上Kubernetes和Docker是一样的，也是两种途径： **环境变量** 和 **加载文件**。

*环境变量*

说过描述容器的字段“ **containers**”里有一个“ **env**”，它定义了Pod里容器能够看到的环境变量。

当时我们只使用了简单的“value”，把环境变量的值写“死”在了YAML里，实际上它还可以使用另一个“ **valueFrom**”字段，从ConfigMap或者Secret对象里获取值，这样就实现了把配置信息以环境变量的形式注入进Pod，也就是配置与应用的解耦。

因为valueFrom字段在YAML中嵌套的比较深，初次最好使用 kubectl explain查看一下对应的说明信息：

```bash
kubectl explain pod.spec.containers.env.valueFrom
```

“ **valueFrom**”字段指定了环境变量值的来源，可以是“ **configMapKeyRef**”或者“ **secretKeyRef**”，然后你要再进一步指定应用的ConfigMap/Secret的“ **name**”和它里面的“ **key**”，要当心的是这个“name”字段是API对象的名字，而不是Key-Value的名字。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-pod

spec:
  containers:
    # 将配置转化为环境变量
    - env:
      - name: COUNT
        valueFrom:
          configMapKeyRef:
            name: info
            key: count
      - name: GREETING
        valueFrom:
          configMapKeyRef:
            name: info
            key: greeting
      - name: USERNAME
        valueFrom:
          secretKeyRef:
            name: user
            key: name
      - name: PASSWORD
        valueFrom:
          secretKeyRef:
            name: user
            key: pwd

      image: busybox
      name: busy
      imagePullPolicy: IfNotPresent
      command: ["/bin/sleep", "300"]
```

这个Pod的名字是“env-pod”，镜像是“busybox”，执行命令sleep睡眠300秒，我们可以在这段时间里使用命令 `kubectl exec` 进入Pod观察环境变量。

你需要重点关注的是它的“env”字段，里面定义了4个环境变量， `COUNT`、 `GREETING`、 `USERNAME`、 `PASSWORD`。

对于明文配置数据， `COUNT`、 `GREETING` 引用的是ConfigMap对象，所以使用字段“ **configMapKeyRef**”，里面的“name”是ConfigMap对象的名字，也就是之前我们创建的“info”，而“key”字段分别是“info”对象里的 `count` 和 `greeting`。

同样的对于机密配置数据， `USERNAME`、 `PASSWORD` 引用的是Secret对象，要使用字段“ **secretKeyRef**”，再用“name”指定Secret对象的名字 `user`，用“key”字段应用它里面的 `name` 和 `pwd` 。

这段解释确实是有点绕口令的感觉，因为ConfigMap和Secret在Pod里的组合关系不像Job/CronJob那么简单直接，所以我还是用画图来表示它们的引用关系：



![[0663d692b33c1dee5b08e486d271b69d.jpg]]

### 如何以volume的方式使用ConfigMap/Secret

Kubernetes中Pod有一个volume的概念，可以翻译成存储卷。如果把pod理解成一个虚拟机，那么volume就相当于一个虚拟机里面的硬盘。

每个pod都可以挂在多个volume，这种方式类似docker中的 `docker run -v`

在Pod里挂载Volume很容易，只需要在“ **spec**”里增加一个“ **volumes**”字段，然后再定义卷的名字和引用的ConfigMap/Secret就可以了。要注意的是Volume属于Pod，不属于容器，所以它和字段“containers”是同级的，都属于“spec”。

下面让我们来定义两个Volume，分别引用ConfigMap和Secret，名字是 `cm-vol` 和 `sec-vol`：

```yaml
spec:
  volumes:
  - name: cm-vol
    configMap:
      name: info
  - name: sec-vol
    secret:
      secretName: user
```

有了Volume的定义之后，就可以在容器里挂载了，这要用到“ **volumeMounts**”字段，正如它的字面含义，可以把定义好的Volume挂载到容器里的某个路径下，所以需要在里面用“ **mountPath**”“ **name**”明确地指定挂载路径和Volume的名字。

```yaml
ontainers:
  - volumeMounts:
    - mountPath: /tmp/cm-items
      name: cm-vol
    - mountPath: /tmp/sec-items
      name: sec-vol
```

![[9d3258da1f40554ae88212db2b4yybyy.jpg]]

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: vol-pod

spec:
  volumes:
  - name: cm-vol
    configMap:
      name: info
  - name: sec-vol
    secret:
      secretName: user

  containers:
  - volumeMounts:
    - mountPath: /tmp/cm-items
      name: cm-vol
    - mountPath: /tmp/sec-items
      name: sec-vol

    image: busybox
    name: busy
    imagePullPolicy: IfNotPresent
    command: ["/bin/sleep", "300"]
```

> linux中不能使用 - 和 .创建环境变量，创建ConfigMap和Secret的时候需要注意一下。

### Downward API

使用project将多个挂载点整合到同一个目录底下
```yaml
spec:
  containers:
    - name: main
      image: busybox
      volumeMounts:
        - name: pod-info
          mountPath: /etc/podinfo
          readOnly: true
  volumes:
    - name: pod-info
      projected:   ## 可以将下面所有信息组织放到同一个目录下面
        sources:
          - downwardAPI:
              items:
                - path: "name"  # 宿主机名字
                  fieldRef:
                    fieldPath: metadata.name
                - path: "ip"
                  fieldRef:
                    fieldPath: status.podIP
                - path: "namespace"
                  fieldRef:
                    fieldPath: metadata.namespace
                - path: "labels"
                  fieldRef:
                    fieldPath: metadata.labels
                - path: "annotations"
                  fieldRef:
                    fieldPath: metadata.annotations
```


以下是您提供的图片内容转化成的文本：

---

### 1. 使用 `fieldRef` 可以声明使用:
- `spec.nodeName` - 宿主机名字
- `status.hostIP` - 宿主机 IP
- `metadata.name` - Pod 的名字
- `metadata.namespace` - Pod 的 Namespace
- `status.podIP` - Pod 的 IP
- `spec.serviceAccountName` - Pod 的 Service Account 的名字
- `metadata.uid` - Pod 的 UID
- `metadata.labels['<KEY>']` - 指定 `<KEY>` 的 `Label` 值
- `metadata.annotations['<KEY>']` - 指定 `<KEY>` 的 `Annotation` 值
- `metadata.labels` - Pod 的所有 Label
- `metadata.annotations` - Pod 的所有 Annotation

### 2. 使用 `resourceFieldRef` 可以声明使用:
- 容器的 CPU limit
- 容器的 CPU request
- 容器的 memory limit
- 容器的 memory request

## 容器编排
![](https://www.thebyte.com.cn/assets/k8s-arch-DznxVVHy.svg)

### 容器技术的原理与演进

#### 资源全方位隔离
Linux 吸收了 chroot 的设计理念，并在 2.4.19 版本中引入了 Mount 命名空间，使得文件系统挂载可以被隔离开来。随着容器技术的发展，发现进程间通信也需要隔离，因此引入了 IPC（Inter-Process Communication）命名空间。此外，容器还需要一个独立的主机名来在网络中标识自己，这便催生了 UTS（UNIX Time-Sharing）命名空间。有了独立的主机名，自然需要独立的 IP、端口、路由等，因此 Network 命名空间 也随之诞生。

| 命名空间    | 隔离的资源                                                            | 内核版本   |
| ------- | ---------------------------------------------------------------- | ------ |
| Mount   | 隔离文件系统挂载点，功能大致类似 chroot                                          | 2.4.19 |
| IPC     | 隔离进程间通信，使进程拥有独立消息队列、共享内存和信号量                                     | 2.6.19 |
| UTS     | 隔离主机的 Hostname、Domain names，这样容器就可以拥有独立的主机名和域名，在网络中可以被视作一个独立的节点。 | 2.6.19 |
| PID     | 隔离进程号，对进程 PID 重新编码，不同命名空间下的进程可以有相同的 PID                          | 2.6.24 |
| Network | 隔离网络资源，包括网络设备、协议栈（IPv4、IPv6）、IP 路由表、iptables、套接字（socket）等        | 2.6.29 |
| User    | 隔离用户和用户组                                                         | 3.8    |
| Cgroup  | 使进程拥有一个独立的 cgroup 控制组。cgroup 非常重要，稍后笔者详细介绍。                      | 4.6    |
| Time    | 隔离系统时间，Linux 5.6 内核版本起支持进程独立设置系统时间                               | 5.6    |
在 Linux 中，为进程设置各种命名空间非常简单，只需通过系统调用函数 clone 并指定相应的 flags 参数即可。clone 函数允许创建一个新的进程，并在创建时指定多个资源隔离的选项。clone 函数的声明如下：

```c
int clone(int (*fn)(void *), void *child_stack,
         int flags, void *arg, ...
         /* pid_t *ptid, struct user_desc *tls, pid_t *ctid */ );
```

例如，下面的代码展示了如何通过调用 clone 函数并指定多个 CLONE_NEW 标志来创建一个子进程，该进程将“看到”一个全新的系统环境。所有的资源，包括进程挂载的文件目录、进程 PID、进程间通信资源、网络设备、主机名等，都将与宿主机进行隔离。

```c
int flags = CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWIPC | CLONE_NEWNET | CLONE_NEWUTS;
int pid = clone(main_function, stack_size, flags | SIGCHLD, NULL); 
```

#### 资源全方位限制
进程的资源隔离已经完成，如果再对使用资源进行额度限制，就能对进程的运行环境实现“进乎完美”的隔离。这就要用 Linux 内核的第二项技术 —— Linux Control Cgroup（Linux 控制组群，简称 cgroups）。

cgroups 是 Linux 内核用于隔离、分配并限制进程组使用资源配额的机制。例如，它可以控制进程的 CPU 占用时间、内存大小、磁盘 I/O 速度等。该项目最初由 Google 工程师 Paul Menage 和 Rohit Seth 于 2000 年发起，当时称之为“进程容器”（Process Container）。由于“容器”这一名词在 Linux 内核中有不同含义，为避免混淆，最终将其重命名为 cgroups。

2008 年，cgroups 被合并到 Linux 内核 2.6.24 版本中，标志着第一代 cgroups 的发布。2016 年 3 月，Linux 内核 4.5 引入了由 Facebook 工程师 Tejun Heo 重写的第二代 cgroups。相比第一代，第二代提供了更加统一的资源控制接口，使得对 CPU、内存、I/O 等资源的限制更加一致。不过，考虑兼容性和稳定性，大多数容器运行时（container runtime）目前仍默认使用第一代 cgroups。

在 Linux 系统中，cgroups 通过文件系统向用户暴露其操作接口。这些接口以文件和目录的形式组织在 /sys/fs/cgroup 路径下。

在 Linux 中执行 ls /sys/fs/cgroup 命令，可以看到在该路径下有许多子目录，如 blkio、cpu、memory 等。

```bash
$ ll /sys/fs/cgroup
总用量 0
drwxr-xr-x 2 root root  0 2月  17 2023 blkio
lrwxrwxrwx 1 root root 11 2月  17 2023 cpu -> cpu,cpuacct
lrwxrwxrwx 1 root root 11 2月  17 2023 cpuacct -> cpu,cpuacct
drwxr-xr-x 3 root root  0 2月  17 2023 memory
...
```

在 cgroups 中，每个子目录被称为“控制组子系统”（control group subsystems），它们对应于不同类型的资源限制。每个子系统有多个配置文件，比如内存子系统：

```bash
$ ls /sys/fs/cgroup/memory
cgroup.clone_children               memory.memsw.failcnt
cgroup.event_control                memory.memsw.limit_in_bytes
cgroup.procs                        memory.memsw.max_usage_in_bytes
cgroup.sane_behavior                memory.memsw.usage_in_bytes
```

这些文件各自用于不同的功能。例如，memory.kmem.limit_in_bytes 用于限制应用程序的总内存使用；memory.stat 用于统计内存使用情况；memory.failcnt 文件报告内存使用达到了 memory.limit_in_bytes 限制值的次数等。

目前，主流的 Linux 系统支持的控制组子系统如下表所示。

表cgroups 控制组群子系统

| 控制组群子系统    | 功能                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| blkio      | 控制并监控 cgroup 中的任务对块设备(例如磁盘、USB 等) I/O 的存取                                                             |
| cpu        | 控制 cgroups 中进程的 CPU 占用率                                                                               |
| cpuacct    | 自动生成报告来显示 cgroup 中的进程所使用的 CPU 资源                                                                      |
| cpuset     | 可以为 cgroups 中的进程分配独立 CPU 和内存节点                                                                        |
| devices    | 控制 cgroups 中进程对某个设备的访问权限                                                                              |
| freezer    | 暂停或者恢复 cgroup 中的任务                                                                                    |
| memory     | 自动生成 cgroup 任务使用内存资源的报告，并限定这些任务所用内存的大小                                                                |
| net_cls    | 使用等级识别符（classid）标记网络数据包，这让 Linux 流量管控器（tc）可以识别从特定 cgroup 中生成的数据包 ，可配置流量管控器，让其为不同 cgroup 中的数据包设定不同的优先级 |
| net_prio   | 可以为各个 cgroup 中的应用程序动态配置每个网络接口的流量优先级                                                                   |
| perf_event | 允许使用 perf 工具对 crgoups 中的进程和线程监控                                                                       |

Linux cgroups 的设计简洁易用。在 Docker 等容器系统中，只需为每个容器在每个子系统下创建一个控制组（通过创建目录），然后在容器进程启动后，将进程的 PID 写入相应子系统的 tasks 文件。

如下面的代码所示，我们创建了一个内存控制组子系统（目录名为 $hostname），并将 PID 为 3892 的进程的内存限制为 1 GB，同时限制其 CPU 使用时间为 1/4。

```bash
/sys/fs/cgroup/memory/$hostname/memory.limit_in_bytes=1GB // 容器进程及其子进程使用的总内存不超过 1GB
/sys/fs/cgroup/cpu/$hostname/cpu.shares=256 // CPU 时间总数为 1024，设置 256 后，限制进程最多只能占用 1/4 CPU 时间

echo 3892 > /sys/fs/cgroup/cpu/$hostname/tasks 
```

值得补充的是，cgroups 在资源限制方面仍有不完善之处。例如，/proc 文件系统记录了进程对 CPU、内存等资源的占用情况，这些数据是 top 命令查看系统信息的主要来源。然而，/proc 文件系统并未关联 cgroups 对进程的限制。因此，当在容器内部执行 top 命令时，显示的是宿主机的资源占用状态，而不是容器内的状态。为了解决这个问题，业内通常采用 LXCFS（LXC 用的 FUSE 文件系统）技术，维护一套专门用于容器的 /proc 文件系统，从而准确反映容器内的资源使用情况。

容器并不是轻量化的虚拟机，也不是一个完全的沙盒（容器共享宿主机内核，实现的是一种“软隔离”）。本质上，容器是通过命名空间、cgroups 等技术实现资源隔离和限制，并拥有独立根目录（rootfs）的特殊进程。

#### 设计容器协作的方式

既然容器是个特殊的进程，那联想到真正的操作系统内大部分进程也并非独自运行，而是以进程组的形式被有序地组织和协作，完成特定任务。

例如，登录到 Linux 机器后，执行 pstree -g 命令可以查看当前系统中的进程树状结构。

```bash
$ pstree -g
    |-rsyslogd(1089)-+-{in:imklog}(1089)
    |  |-{in:imuxsock) S 1(1089)
    | `-{rs:main Q:Reg}(1089)
```

如命令输出所示，rsyslogd 程序的进程树结构展示了其主程序 main 和内核日志模块 imklog 都属于进程组 1089。它们共享资源，共同完成 rsyslogd 的任务。对于操作系统而言，这种进程组管理更加方便。比如，Linux 操作系统可以通过向一个进程组发送信号（如 SIGKILL），使该进程组中的所有进程同时终止运行。

现在，假设我们要将上述进程用容器改造，该如何设计呢？如果使用 Docker，通常会想到在容器内运行两个进程：

- rsyslogd 负责业务逻辑；
- imklog 处理日志。

但这种设计会遇到一个问题：容器中的 PID=1 进程应该是谁？在 Linux 系统中，PID 为 1 的进程是 init，它作为所有其他进程的祖先进程，负责监控进程状态，并处理孤儿进程。因此，容器中的第一个进程也需要具备类似的功能，能够处理 SIGTERM、SIGINT 等信号，优雅地终止容器内的其他进程。

Docker 的设计核心在于采用的是“单进程”模型。Docker 通过监控 PID 为 1 的进程的状态来判断容器的健康状态（在 Dockerfile 中用 ENTRYPOINT 指定启动的进程）。如果确实需要在一个 Docker 容器中运行多个进程，首个启动的进程应该具备资源监控和管理能力，例如，使用专为容器开发的 tinit 程序。

虽然通过 Docker 可以勉强实现容器内运行多个进程，但进程间的协作远不止于资源回收那么简单。要让容器像操作系统中的进程组一样进行协作，下一步的演进是找到类似“进程组”的概念。这是实现容器从“隔离”到“协作”的第一步。
####  超亲密容器组 Pod
在 Kubernetes 中，与“进程组”对应的设计概念是 Pod。Pod 是一组紧密关联的容器集合，它们共享 IPC、Network 和 UTS 等命名空间，是 Kubernetes 管理的最基本单位。

容器之间原本通过命名空间和 cgroups 进行隔离，Pod 的设计目标是打破这种隔离，使 Pod 内的容器能够像进程组一样共享资源和数据。为实现这一点，Kubernetes 引入了一个特殊容器 —— Infra Container。

Infra Container 是 Pod 内第一个启动的容器，体积非常小（约 300 KB）。它主要负责为 Pod 内的容器申请共享的 UTS、IPC 和网络等命名空间。Pod 内的其他容器通过 setns（Linux 系统调用，用于将进程加入指定命名空间）来共享 Infra Container 的命名空间。此外，Infra Container 也可以作为 init 进程，管理子进程和回收资源。

额外知识

Infra Container 启动后，执行一个永远循环的 pause() 方法，因此又被称为“pause 容器”。

![](https://www.thebyte.com.cn/assets/infra-container-DNfUcRbo.svg)
通过 Infra Container，Pod 内的容器可以共享 UTS、Network、IPC 和 Time 命名空间。不过，PID 命名空间和文件系统命名空间默认依然是隔离的，原因如下：

- **文件系统隔离**：容器需要独立的文件系统，以避免冲突。如果容器之间需要共享文件，Kubernetes 提供了 Volume 支持（将在本章 7.5 节中介绍）；
- **PID 隔离**：PID 命名空间隔离是为了避免某些容器进程没有 PID=1 的问题，这可能导致容器启动失败（例如，使用 systemd 的容器）。

如果需要共享 PID 命名空间，可以在 Pod 声明中设置 shareProcessNamespace: true。Pod 的 YAML 配置如下所示：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: example-pod
spec:
  shareProcessNamespace: true
  containers:
    - name: container1
      image: myimage1
    ...
```

在共享 PID 命名空间的 Pod 中，Infra Container 将承担 PID=1 进程的职责，负责处理信号和回收子进程资源等操作。

#### Pod 是 Kubernetes 的基本单位

解决了容器的资源隔离、限制以及容器间协作问题，Kubernetes 的功能开始围绕容器和 Pod 不断向实际应用的场景扩展。

由于一个 Pod 不会仅有一个实例，Kubernetes 引入了更高层次的抽象来管理多个 Pod 实例。例如：

- **Deployment**：用于管理无状态应用，支持滚动更新和扩缩容；
- **StatefulSet**：用于管理有状态应用，确保 Pods 的顺序和持久性；
- **DaemonSet**：确保每个节点上运行一个 Pod，常用于集群管理或监控；
- **ReplicaSet**：确保指定数量的 Pod 副本处于运行状态；
- **Job/CronJob**：管理一次性任务或定期任务。

鉴于 Pod 的 IP 地址是动态分配的，Kubernetes 引入了 Service 来提供稳定的网络访问入口并实现负载均衡。此外，Ingress 作为反向代理，根据定义的规则将流量路由至后端的 Service 或 Pod，从而实现基于域名或路径的细粒度路由和更复杂的流量管理。围绕 Pod 的设计不断衍生，最终绘制出图 7-5 所示的 Kubernetes 核心功能全景图。

![](https://www.thebyte.com.cn/assets/pod-DjWvdj6A.svg)
#### Pod 是调度的原子单元

Pod 还承担着作为调度单元的关键职责。

调度（特别是协同调度）是非常麻烦的事情。举个例子，假设有两个具有亲和性的容器：

- Nginx（资源需求：1GB 内存），负责接收请求并将其写入主机的日志文件；
- LogCollector（资源需求：0.5GB 内存），负责读取日志并将其转发到 Elasticsearch 集群。

假设当前集群的资源情况如下：

- Node1：1.25G 可用内存；
- Node2：2G 可用内存。

如果这两个容器必须协作并在同一台机器上运行，调度器可能会将 Nginx 调度到 Node1。然而，Node1 上只有 1.25GB 内存，而 Nginx 占用了 1GB，导致 LogCollector 无法在该节点上运行，从而阻塞了调度。尽管重新调度可以解决这个问题，但如果需要协调数以万计的容器呢？以下是两种典型的解决方案：

- **成组调度**：集群等到足够的资源满足容器需求后，统一调度。这种方法可能导致调度效率降低、资源利用不足，并可能出现互相等待而导致死锁的问题；
- **提高单个调度效率**： 通过提升单任务调度效率解决。像 Google 的 Omega 系统采用了基于共享状态的乐观绑定（Optimistic Binding）来优化大规模调度效率。但这种方案实现起来较为复杂，笔者将在第 7.7.3 节“调度器及扩展设计”中详细探讨。

在 Pod 上直接声明资源需求，并以 Pod 作为原子单元来实现调度，Pod 与 Pod 之间不存在超亲密的关系，如果有关系，就通过网络通信实现关联。复杂的协同调度问题在 Kubernetes 中直接消失了！

### 容器边车模式

组合多种不同角色的容器，共享资源并统一调度编排，在 Kubernetes 中是一种经典的容器设计模式 —— 边车（Sidecar）模式。

如图所示，在边车模式下，一个主容器（负责业务逻辑处理）与一个或多个边车容器共同运行在同一个 Pod 内。边车容器负责处理非业务逻辑的任务，如日志记录、监控、安全保障或数据同步。边车容器将这些职能从主业务容器中分离，使得开发更加高内聚、低耦合的软件变得更加容易。
![](https://www.thebyte.com.cn/assets/sidecar-Clxo9o_p.svg)
### 容器镜像的原理与应用
容器镜像是 Docker 革命性的创新，它在短短几年就迅速改变了整个云计算领域的发展历程。在本节中，我们将深入分析镜像技术原理，并探讨其在下载加速、启动加速、存储优化等场景中的最佳实践。

#### 什么是容器镜像

所谓的“容器镜像”，其实就是一个“特殊的压缩包”，它将应用及其依赖（包括操作系统中的库和配置）打包在一起，形成一个自包含的环境。

很多开发者通常将应用依赖局限于编程语言层面。例如，某个 Java 应用依赖特定版本的 JDK，或者 Python 应用依赖 Python 2.7。但一个常被忽视的事实是：“操作系统本身才是应用运行所需的最完整依赖环境”。制作容器镜像的过程，实际上就是创建一个符合特定要求的操作系统快照。Docker 中，这个操作是：

```bash
$ docker build 镜像名称
```

一旦镜像创建完成，用户便可通过 Docker 创建一个“沙盒”，解压镜像并将其作为根文件系统（rootfs）挂载，容器内的应用程序和依赖就可以顺利运行。Docker 中，这个操作是：

```bash
$ docker run 镜像名称
```

上述的“沙盒”，其实就是上一篇介绍的 namespace 和 cgroups 技术创建出来的隔离环境。

由于镜像打包的是“整个操作系统”，应用程序与运行依赖全部封装在了一起，从而赋予了容器最核心的一致性能力。无论是在本地，还是在云端某个虚拟机，只要解压打包好的容器镜像，应用程序运行所依赖的环境就能完美重现。

>注意
>严格讲，rootfs 只是操作系统的一部分，是按规则组织的一些文件和目录，并不包括操作系统内核。如果容器内的进程与内核交互，将影响宿主机，这是容器相比虚拟机的主要缺陷之一（不安全）。

#### 容器镜像分层设计原理

rootfs 解决了应用程序运行环境的一致性问题，但并未解决所有问题。

例如，当应用程序升级或运行环境发生变动时，是否需要重新制作一次 rootfs？将整个 rootfs 直接打包不仅无法复用，还会浪费大量存储空间。举例来说，笔者基于 CentOS ISO 制作了一个 rootfs，配置了 Java 运行环境。那么，笔者的同事发布 Java 应用时，肯定想复用之前安装过 Java 运行环境的 rootfs，而不是重新制作一个。此外，如果每个人都重新制作 rootfs，考虑到一台主机通常运行几十个容器，将会占用巨大的存储空间。

分析上述 Java 应用对 rootfs 的需求，发现底层的 rootfs（例如 CentOS + JDK）其实是固定的。那么，是否可以通过增量修改的方式来支持不同应用的依赖？比如，维护一个共同的“基础 rootfs”，然后根据应用的不同依赖制作不同的镜像。例如，**CentOS + JDK** + app-1、**CentOS + JDK** + app-2 和 **CentOS** + Python + app-3 等等。

增量修改的思路当然可行，这也是 Docker 镜像设计的核心。与传统的 rootfs 制作流程不同，Docker 引入了“层”（layer）的概念，每次创建镜像时，都会生成一个新的层，即一个增量式的 rootfs。

Docker 镜像的分层设计依赖于 UnionFS（联合文件系统）技术，UnionFS 允许将多个目录联合挂载到同一目录下，呈现给用户的是一个统一的文件系统视图，而非多个分散的目录。

UnionFS 有多种实现，例如 OverlayFS、Btrfs 和 AUFS 等。在 Linux 内核 3.18 版本中，OverlayFS 被合并进主分支，并逐渐成为各大主流 Linux 发行版的默认联合文件系统。OverlayFS 的使用非常简便，只需通过 mount 命令，指定文件系统类型为 overlay，并配置以下相关参数：

- **lowerdir**：OverlayFS 的只读层，通常用于提供基础文件系统，可以指定多个目录；
- **upperdir**：OverlayFS 的读写层，用于存储用户的增量修改；
- **merged**：挂载完成后，展示给用户的统一文件系统视图。

笔者举一个具体的例子供你参考，代码如下所示：

```bash
#!/bin/bash

umount ./merged
rm upper lower merged work -r

mkdir upper lower merged work
echo "I'm from lower!" > lower/in_lower.txt
echo "I'm from upper!" > upper/in_upper.txt
# `in_both` is in both directories
echo "I'm from lower!" > lower/in_both.txt
echo "I'm from upper!" > upper/in_both.txt

// 使用 mount 命令即将 lower、upper 挂载到 merged。

$ sudo mount -t overlay overlay \
 -o lowerdir=./lower,upperdir=./upper,workdir=./work \
 ./merged
```

使用 mount 命令，指定文件系统类型为 overlay，挂载后的文件系统如图 7-7 所示。
![[Pasted image 20250607160522.png]]

当在 merged 目录中执行增删改操作时，OverlayFS 文件系统会触发写时复制（CoW，Copy-On-Write）策略。下面通过一系列操作来解释 CoW 的基本原理：

- **新建文件时**：文件会被写入到 upper 目录中；
- **删除文件时**：
    - 如果删除 in_upper.txt，该文件会从 upper 目录中移除；
    - 如果删除 in_lower.txt，lower 目录中的 in_lower.txt 文件保持不变，但 upper 目录会新增一个特殊文件，标记 in_lower.txt 在 merged 目录中已被删除。
- **修改文件时**：如果修改 in_lower.txt，upper 目录会创建一个新的 in_lower.txt 文件，包含更新后的内容，而 lower 目录中的原始文件保持不变。

再来看 Docker 镜像利用联合文件系统的分层设计。如图所示，整个镜像从下往上由 6 个层组成：

- 最底层是基础镜像 Debian Stretch，相当于“base rootfs”，所有容器可以共享这一层；
- 接下来的 3 层是通过 Dockerfile 中的 ADD、ENV、CMD 等指令生成的只读层；
- Init Layer 位于只读层和可写层之间，存放可能会被修改的文件，如 /etc/hosts、/etc/resolv.conf 等。这些文件原本属于 Debian 镜像，但容器启动时，用户往往会写入一些指定的配置，因此 Docker 为其单独创建了这一层；
- 最上层是通过 CoW（写时复制）技术创建的可写层（Read/Write Layer）。容器内的所有增、删、改操作都发生在此层。但该层的数据不具备持久性，容器销毁时，所有写入的数据也会丢失。容器镜像内无法写入任何数据，是不可变基础设施的思想的体现，无论容器重启多少次或在任何机器上运行，只要使用相同的镜像，启动的服务始终保持一致。
![[Pasted image 20250607160533.png]]

最终，这 6 个层被联合挂载到` /var/lib/docker/overlay/mnt` 目录。容器系统通过系统调用 `chroot` 和 pivot_root 切换根目录，使得容器内的进程仿佛独占一个带有 Java 环境的 Debian 操作系统。

通过镜像分层设计，以 Docker 镜像为核心，不同公司和团队的开发人员可以紧密协作。每个人不仅可以发布基础镜像，还可以基于他人的基础镜像构建和发布自己的软件。**镜像的增量操作使得拉取和推送内容也是增量的，这远比操作虚拟机动辄数 GB 的 ISO 镜像要更敏捷**。更重要的是，容器镜像一旦发布，全球任何地方的用户都能下载并复现应用所需的完整环境，打通了“开发-测试-部署”流程中的每个环节。

#### 构建足够小的容器镜像

容器镜像的一大挑战是尽量减小镜像体积。较小的镜像在部署、故障转移和存储成本等方面具有显著优势。构建足够小镜像的方法如下：

- **选用精简的基础镜像**：基础镜像应只包含运行应用程序所必需的最小系统环境和依赖。选择 Alpine Linux 这样的轻量级发行版作为基础镜像，镜像体积会比 CentOS 这样的大而全的基础镜像要小得多；
- **使用多阶段构建镜像**：在构建过程中，编译缓存、临时文件和工具等不必要的内容可能被包含在镜像中。通过多阶段构建，可以只打包编译后的可执行文件，从而得到更加精简的镜像。

以下是通过多阶段构建一个精简 Nginx 镜像的示例，供读者参考：

```bash
# 第 1 阶段
FROM skillfir/alpine:gcc AS builder01
RUN wget https://nginx.org/download/nginx-1.24.0.tar.gz -O nginx.tar.gz && \
tar -zxf nginx.tar.gz && \
rm -f nginx.tar.gz && \
cd /usr/src/nginx-1.24.0 && \
 ./configure --prefix=/app/nginx --sbin-path=/app/nginx/sbin/nginx && \
  make && make install
  
# 第 2 阶段 只打包最终可执行文件
FROM skillfir/alpine:glibc
RUN apk update && apk upgrade && apk add pcre openssl-dev pcre-dev zlib-dev 

COPY --from=builder01 /app/nginx /app/nginx
WORKDIR /app/nginx
EXPOSE 80
CMD ["./sbin/nginx","-g","daemon off;"]
```

使用 docker build 命令构建镜像并查看生成的镜像，最终大小为 23.4 MB。

```
$ docker build -t alpine:nginx .
$ docker images 
REPOSITORY                TAG             IMAGE ID       CREATED          SIZE
alpine                    nginx           ca338a969cf7   17 seconds ago   23.4MB
```

#### 加速容器镜像下载

当容器启动时，如果本地没有镜像文件，它将从远程仓库（Repository）下载。镜像下载效率受限于网络带宽和仓库服务质量，镜像越大，下载时间越长，容器启动也因此变慢。

为了解决镜像拉取速度慢和带宽浪费的问题，阿里巴巴技术团队在 2018 年开源了 Dragonfly 项目。

Dragonfly 的工作原理如图所示。首先，Dragonfly 在多个节点上启动 Peer 服务（类似 P2P 节点）。当容器系统下载镜像时，下载请求通过 Peer 转发到 Scheduler（类似 P2P 调度器），Scheduler 判断该镜像是否为首次下载：

- **首次下载**：Scheduler 启动回源操作，从源服务器获取镜像文件，并将镜像文件切割成多个“块”（Piece）。每个块会缓存到不同节点，相关配置信息上报给 Scheduler，供后续调度决策使用；
- **非首次下载**：Scheduler 根据配置，生成一个包含所有镜像块的下载调度指令。

最终，Peer 根据调度策略从集群中的不同节点下载所有块，并将它们拼接成完整的镜像文件。

![[Pasted image 20250607160551.png]]
可以看出，Dragonfly 的镜像下载加速流程与 P2P 下载加速非常相似，二者都是通过分布式节点和智能调度来加速大文件的传输与重组。

#### 加速容器镜像启动

容器镜像的大小直接影响启动时间，一些大型软件的镜像可能超过数 GB。例如，机器学习框架 TensorFlow 的镜像大小为 1.83 GB，冷启动时至少需要 3 分钟。大型镜像不仅启动缓慢、镜像内的文件往往未被充分利用（业内研究表明，通常镜像中只有 6% 的内容被实际使用）

2020 年，阿里巴巴技术团队发布了 Nydus 项目，它将镜像层的数据（blobs）与元数据（bootstrap）分离，容器第一次启动时，首先拉取元数据，再按需拉取 blobs 数据。相较于拉取整个镜像层，Nydus 下载的数据量大大减少。值得一提的是，Nydus 还使用 FUSE 技术（Filesystem in Userspace，用户态文件系统）重构文件系统，用户几乎无需任何特殊配置（感知不到 Nydus 的存在），即可按需从远程镜像中心拉取数据，加速容器镜像启动。

![[Pasted image 20250607160600.png]]


### 容器运行时与 CRI 接口

由于 Docker 太流行了，Kubernetes 没有考虑支持其他容器引擎的可能性，完全依赖并绑定于 Docker。那时，Kubernetes 通过内部的 DockerManager 组件调用 Docker API 来创建和管理容器。
![](https://www.thebyte.com.cn/assets/k8s-runtime-v1-BorpnPeX.svg)
随着市场上出现越来越多的容器运行时，比如 CoreOS 推出的开源容器引擎 Rocket（简称 rkt），Kubernetes 在 rkt 发布后采用类似强绑定 Docker 的方式，添加了对 rkt 的支持。随着容器技术的快速发展，如果继续采用与 Docker 类似的强绑定方式，Kubernetes 的维护工作将变得无比庞大。

#### 容器运行时接口 CRI
从 Kubernetes 1.5 版本开始，Kubernetes 在遵循 OCI 标准的基础上，将容器管理操作抽象为一系列接口。这些接口作为 Kubelet（Kubernetes 节点代理）与容器运行时之间的桥梁，使 Kubelet 能通过发送接口请求来管理容器。

管理容器的接口称为“CRI 接口”（Container Runtime Interface，容器运行时接口）。如下面的代码所示，CRI 接口其实是一套通过 Protocol Buffer 定义的 API。

```go
// https://github.com/kubernetes/cri-api/blob/master/pkg/apis/services.go
// RuntimeService 定义了管理容器的 API
service RuntimeService {

    // CreateContainer 在指定的 PodSandbox 中创建一个新的容器
    rpc CreateContainer(CreateContainerRequest) returns (CreateContainerResponse) {}
    // StartContainer 启动容器
    rpc StartContainer(StartContainerRequest) returns (StartContainerResponse) {}
    // StopContainer 停止正在运行的容器。
    rpc StopContainer(StopContainerRequest) returns (StopContainerResponse) {}
    ...
}

// ImageService 定义了管理镜像的 API。
service ImageService {
    // ListImages 列出现有的镜像。
    rpc ListImages(ListImagesRequest) returns (ListImagesResponse) {}
    // PullImage 使用认证配置拉取镜像。
    rpc PullImage(PullImageRequest) returns (PullImageResponse) {}
    // RemoveImage 删除镜像。
    rpc RemoveImage(RemoveImageRequest) returns (RemoveImageResponse) {}
    ...
}
```

CRI 的实现由三个主要组件协作完成：gRPC Client、gRPC Server 和具体的容器运行时。具体来说：

- Kubelet 充当 gRPC Client，调用 CRI 接口；
- CRI shim 作为 gRPC Server，响应 CRI 请求，并将其转换为具体的容器运行时管理操作。

![[Pasted image 20250607190808.png]]
由此，市场上的各类容器运行时，只需按照规范实现 CRI 接口，就可以无缝接入 Kubernetes 生态。
#### Kubernetes 专用容器运行时
2017 年，Google、RedHat、Intel、SUSE 和 IBM 一众大厂联合发布了 CRI-O（Container Runtime Interface Orchestrator）项目。从名称可以看出，CRI-O 的目标是兼容 CRI 和 OCI，使 Kubernetes 能在不依赖传统容器引擎（如 Docker）的情况下，仍能有效管理容器。

![[Pasted image 20250607190833.png]]
Google 推出 CRI-O 的意图明显，即削弱 Docker 在容器编排领域的主导地位。但彼时 Docker 在容器生态中的市场份额仍占绝对优势。对于普通用户而言，如果没有明确的收益，并没么动力把 Docker 换成别的容器引擎。

不过，我们也可以想象，Docker 当时的内心一定充满了被抛弃的焦虑。

#### Containerd 与 CRI
Docker 并没有“坐以待毙”，开始主动进行革新。Docker 从 1.1 版本起开始重构，并拆分出了 Containerd。

早期，Containerd 单独开源，并未捐赠给 CNCF，还适配了其他容器编排系统，如 Swarm，因此并未直接实现 CRI 接口。出于诸多原因的考虑，Docker 对外部开放的接口也依然保持不变。在这种背景下，Kubernetes 中出现了两种调用链：

- **通过适配器 dockershim 调用**：首先 dockershim 调用 Docker，然后 Docker 调用 Containerd，最后 Containerd 操作容器；；
- **通过适配器 CRI-containerd 调用**：首先 CRI-containerd 调用 Containerd，随后 Containerd 操作容器。
![[Pasted image 20250607190857.png]]

在这一阶段，Kubelet 和 dockershim 的代码都托管在同一个仓库中，意味着 dockershim 由 Kubernetes 负责组织、开发和维护。因此，每当 Docker 发布新版本时，Kubernetes 必须集中精力快速更新 dockershim。此外，Docker 作为容器运行时显得过于庞大。Kubernetes 弃用 dockershim 有了充分的理由和动力。

再来看 Docker。2018 年，Docker 将 Containerd 捐赠给 CNCF，并在 CNCF 的支持下发布了 1.1 版。与 1.0 版相比，1.1 版的最大变化在于完全支持 CRI 标准，这意味着原本作为 CRI 适配器的 CRI-Containerd 也不再需要。

Kubernetes v1.24 版本正式移除 dockershim，实质上是废弃了内置的 dockershim 功能，转而直接对接 Containerd。此时，再观察 Kubernetes 与容器运行时之间的调用链，你会发现，与 DockerShim 和 CRI-containerd 的交互相比，调用步骤最多减少了两步：

- 用户只需抛弃 Docker 的情怀，容器编排至少可以省略一次调用，获得性能上的收益；
- 对 Kubernetes 而言，选择 Containerd 作为容器运行时，调用链更短、更稳定、占用的资源更少。
![[Pasted image 20250607190909.png]]

根据 Kubernetes 官方提供的性能测试数据，Containerd 1.1 相比 Docker 18.03，Pod 的启动延迟降低了 20%、CPU 使用率降低了 68%、内存使用率降低了 12%。这是一个相当显著的性能改善。
![](https://www.thebyte.com.cn/assets/k8s-runtime-v4-VvEKKbDn.svg)
#### 安全容器运行时
事实上，虽然容器提供一个与系统中的其它进程资源相隔离的执行环境，但是与宿主机系统是共享内核的。如果有一个容器进程被恶意程序攻击，就有可能造成容器逃逸，轻则破坏当前的容器，重则造成 Linux 内核崩溃，导致整个机器宕机。

为了提高安全性，很多运维人员会将容器“嵌套”在虚拟机中，将容器与同一主机上的其他进程完全隔离。但在虚拟机中运行容器会丧失容器的速度和敏捷性优势。为了解决这个问题，Intel 和 Hyper.sh（现为蚂蚁集团的一部分）在 2016 年，几乎同时发布了各自的解决方案，分别是 Intel Clear Containers 和 runV 项目。

2017 年，Intel 和 Hyper.sh 两家公司将各自的项目合并，互补优势，创建了开源项目 Kata Containers。该项目的原理如图 7-18 所示，本质上是通过硬件虚拟化技术（如 QEMU/KVM）为每个容器/Pod 分配独立的内核，将其运行在一个精简的轻量级虚拟机中。因此，它“像容器一样敏捷，像虚机一样安全”（The speed of containers, the security of VMs）。

![[Pasted image 20250607190942.png]]
为了与上层容器编排系统对接，Kata Containers 会启动一个进程（shimv2）来负责容器的生命周期管理。shimv2 相当于 Kata Containers 与容器运行时之间的兼容层，支持标准的容器接口，如 CRI（容器运行时接口）或 Docker API。这使得容器编排系统能够像操作普通容器一样管理容器，而不需要意识到容器实际上是运行在一个虚拟机中。
![[Pasted image 20250607190951.png]]

除了 Kata Containers，2018 年底，AWS 发布了安全容器项目 Firecracker。其核心是一个用 Rust 编写的虚拟化管理器，利用 Linux 内核虚拟机（KVM）来创建和运行轻量级虚拟机。不难看出，无论是 Kata Containers 还是 Firecracker，它们实现安全容器的方法殊途同归，都是为每个进程分配独立的操作系统内核，从而有效防止容器进程“逃逸”或夺取宿主机控制权的问题。

#### 容器运行时生态
目前已有十几种容器运行时实现了 CRI 接口，具体选择哪一种取决于 Kubernetes 安装时宿主机的容器运行时环境。但对于云计算厂商而言，除非出于安全性需要（如必须实现内核级别的隔离），大多数情况都会选择 Containerd 作为容器运行时。毕竟对于它们而言，性能与稳定才是核心的生产力与竞争力。
![[Pasted image 20250607191133.png]]

### 容器持久化存储设计

镜像作为不可变的基础设施，要求在任何环境下能复制出完全一致的容器实例。这意味着，容器内部写入的数据与镜像无关，一旦容器重启，所有写入的数据都会丢失。那容器系统怎么实现数据持久化存储呢？本节，我们由浅入深，先从 Docker 开始，逐步了解容器持久化存储的原理、不同存储类型的特点及其适用场景。

#### Docker 的存储设计
Docker 通过将宿主机目录挂载到容器内部的方式，实现数据持久化存储。如图所示，目前它支持三种挂载方式：bind mount、volume 和 tmpfs mount。
![[Pasted image 20250607193206.png]]

bind mount 是 Docker 最早支持的挂载类型，也是我们最熟悉的挂载方式。如下命令所示，启动一个 Nginx 容器，并将宿主机的 /usr/share/nginx/html 目录挂载到容器内 /data 目录：

```bash
$ docker run -v /usr/share/nginx/html:/data nginx:lastest
```

上面的挂载，实际上是通过 mount 系统调用实现的。如下代码所示：

```bash
// 将宿主机中的 /usr/share/nginx/html 挂载到容器根文件系统的 /data 路径
mount("/usr/share/nginx/html", "rootfs/data", "none", MS_BIND, NULL);
```

通过 mount 系统调用实现的持久化存储存在以下缺陷：

- **与操作系统的强耦合**：容器内的目录通过 mount 挂载到宿主机的绝对路径，这使得容器的运行环境与操作系统紧密绑定。一方面，bind mount 方式无法写入 Dockerfile，否则镜像在其他环境中可能无法启动。另一方面，宿主机中被挂载的目录与 Docker 并无直接关联，其他进程可能会误操作，存在潜在的安全风险；
- **难以满足多样化的存储需求**：随着容器广泛应用，存储需求也变得更加复杂。存储位置不仅限于宿主机，还可能涉及外部网络存储；存储介质不仅是磁盘，还可能是内存文件系统（如 tmpfs）；存储类型也不局限于文件系统，还包括块设备或对象存储；
- **低效的网络存储处理**，对于网络存储，实在没必要先将其挂载到操作系统再挂载到容器内某个目录。Docker 完全可以直接对接 iSCSI、NFS 网络存储协议，绕过操作系统，降低资源占用和访问延迟。

为了解决上述问题，Docker 从 1.7 版本起引入了全新的挂载类型 —— Volume（存储卷）：

- **独立的存储空间**：Volume 会在宿主机中开辟一个专属于 Docker 的空间（通常在 Linux 中为 /var/lib/docker/volumes/ 目录），这样就避免了 bind mount 对宿主机绝对路径的依赖；
- **支持多种存储系统**：考虑到存储类型的多样性，仅依赖 Docker 本身来实现所有存储需求并不现实。因此，Docker 在 1.10 版本中又引入了 Volume Driver 机制，借助社区的力量扩展存储驱动，支持更多存储系统和协议。。

经过一系列的设计，现在 Docker 用户只要通过 docker plugin install 安装额外的第三方卷驱动，就能使用想要的存储方案。

举个具体的例子，请看使用阿里云文件存储（NAS）的示例：

1. 先安装阿里云 NAS Volume 插件：

```bash
docker plugin install aliyun/aliyun-volume-plugin:latest --alias aliyun-nas --grant-all-permissions
```

2. 接着，使用 docker volume create 命令创建一个挂载到阿里云 NAS 的存储卷，指定 NAS 文件系统的地址：

```bash
docker volume create \
--driver aliyun-nas \
--opt nasAddr=<Your_NAS_Address> \
--opt mountDir=/myvolume \
my-aliyun-nas-volume
```

3. 最后，启动容器时，将创建的阿里云 NAS 卷挂载到容器中的目录：

```bash
docker run -d -v my-aliyun-nas-volume:/mnt/nas nginx:latest
```

#### Kubernetes 的存储设计

我们从 Docker 返回到 Kubernetes 中，同 Docker 类似的是：

- Kubernetes 也抽象出了 Volume 的概念来解决持久化存储；
- 在宿主机中，也开辟了属于 Kubernetes 的空间（该目录是 /var/lib/kubelet/pods/[pod uid]/volumes）；
- 也设计了存储驱动（在 Kubernetes 中称 Volume Plugin）扩展支持出众多的存储类型，如本地存储、网络存储（如 NFS、iSCSI）、云厂商的存储服务（如 AWS EBS、GCE PD、阿里云 NAS 等）。

不同的是，作为一个工业级的容器编排系统，Kubernetes 的 Volume 机制比 Docker 更复杂、支持的存储类型更丰富。Kubernetes 支持的存储类型，如图所示
![[Pasted image 20250607193227.png]]

乍一看，这么多 Volume 类型实在难以下手。然而，总结起来就 3 类：

- **普通 Volume**：主要用于临时数据存储，包括 emptyDir 和 hostPath 等类型；
    - emptyDir：在 Pod 删除时数据会被清空；
    - hostPath：数据存储在节点本地路径上，如果 Pod 被调度到其他节点，则无法访问原有数据。
- **持久化的 Volume**：通过 PersistentVolume（PV）和 PersistentVolumeClaim（PVC）机制实现，支持长期存储且与 Pod 的生命周期解耦。常见的类型包括 NFS、云存储（如 AWS EBS、GCE PD）等；
- **特殊的 Volume**：用于管理配置和敏感数据，例如 Secret 和 ConfigMap。严格来说，这类 Volume 并非传统意义上的存储类型，而是通过实现标准的 POSIX（可移植操作系统接口）接口，提供对 Kubernetes 集群中配置信息的便捷访问。这部分内容，笔者就不再展开讨论了。

##### 普通的 Volume

Kubernetes 设计普通 Volume 的初衷并非为了持久化存储数据，而是为了实现容器间的数据共享。请看两个典型示例：

- **EmptyDir**：这种 Volume 类型常用于 Sidecar 模式。例如，日志收集容器通过 EmptyDir 访问业务容器的日志文件；
- **HostPath**：与 EmptyDir 不同，HostPath 允许同一节点上的所有容器共享宿主机的本地存储。例如，在 Loki 日志系统中，Pod 挂载宿主机的 HostPath Volume 后，Loki 可以收集并读取宿主机上所有 Pod 生成的日志。

如图所示，EmptyDir 类型的 Volume 随 Pod 生命周期而存在。当 Pod 被销毁时，EmptyDir Volume 也会被删除。对于 HostPath，当 Pod 被调度到其他节点时，数据也相当于丢失了。
![](https://www.thebyte.com.cn/assets/volume-B3WbdOc-.svg)
##### 持久化的 Volume
由于 Pod 随时可能被调度到其他节点，如果要实现数据的持久化存储，就得依赖网络存储解决方案。这就是引入 PV（PersistentVolume，持久卷）的原因。

以下是一个 PV 资源的 YAML 配置示例。其 spec 部分定义了关键配置项，包括：存储容量（5Gi）、访问模式（ReadWriteOnce，表示允许单个节点进行读写）、远程存储类型（如 NFS），以及数据回收策略（Recycle，表示在 PV 释放后自动清除数据以供重用）。

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv1
spec:
  capacity:  #容量
    storage: 5Gi
  accessModes:  #访问模式
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Recycle  #回收策略
  storageClassName: manual  
  nfs:
    path: /
    server: 172.17.0.2
```

直接使用 PV 时，需要详细描述存储的配置信息，这对业务工程师并不友好。业务工程师只想知道我有多大的空间、I/O 是否满足要求，肯定不关心存储底层的配置细节。

为了简化存储的使用，Kubernetes 将存储服务再次抽象，把业务工程师关心的逻辑再抽象一层，于是有了 PVC（Persistent Volume Claim，持久卷声明），这种设计很像软件开发中的“面向对象”思想：

- PVC 可以理解为持久化存储的“接口”，它提供了对某种持久化存储的描述，但不提供具体的实现；
- 而持久化存储的实现部分则由 PV 负责完成。

这样设计的好处是，作为业务开发者，我们只需要与 PVC 这个“接口”进行交互，而不必关心存储的具体的实现是 NFS 还是 Ceph。请看下面 PVC 资源的 YAML 配置示例。可以看到，其中没有任何与存储实现相关的细节。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pv-claim
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 3Gi
```

现在，还有个问题，PV 和 PVC 两者之间并没有明确相关的绑定参数，它们之间是如何绑定的？PV 和 PVC 的绑定是自动的，依赖以下两个匹配条件：

- **Spec 参数匹配**：Kubernetes 会根据 PVC 中声明的规格自动寻找符合条件的 PV。这包括存储容量、所需的访问模式（如 ReadWriteOnce、ReadOnlyMany 或 ReadWriteMany），以及存储类型（如文件系统或块存储）；
- **存储类匹配**：PV 和 PVC 必须具有相同的 storageClassName，它定义了存储类型和特性，确保 PVC 请求的存储资源与 PV 提供的资源一致。

以下 YAML 配置展示了如何在 Pod 中使用 PVC。当 PVC 成功绑定到 PV 后，NFS 远程存储将被挂载到 Pod 内指定的目录，比如 nginx 容器中的 /data 目录。这样，Pod 内的应用就可以像使用本地存储一样，使用远程存储资源了。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-nfs
spec:
  containers:
  - image: nginx:alpine
    imagePullPolicy: IfNotPresent
    name: nginx
    volumeMounts:
    - mountPath: /data
      name: nfs-volume
  volumes:
  - name: nfs-volume
    persistentVolumeClaim:
      claimName: pv-claim
```


##### PV 的使用：从手动到自动

在 Kubernetes 中，如果没有现成的 PV 满足 PVC 的需求，PVC 会保持在 Pending 状态，直到找到合适的 PV。在此期间，Pod 无法正常启动。对于小规模集群，可以提前手动创建多个 PV 以匹配 PVC，但在大规模集群中，Pod 数量可能达到成千上万，显然无法依靠人工方式提前创建如此多的 PV。

为此，Kubernetes 提供了一套自动创建 PV 的机制 —— 动态供给（Dynamic Provisioning）。相对而言，前面通过人工创建 PV 的方式被称为“静态供给”（Static Provisioning）。

动态供给的关键在于 Kubernetes 的 StorageClass 资源，它充当了 PV 模板的角色，使得 PV 可以根据需要自动生成。声明 StorageClass 时，必须明确两类信息：

- **PV 的属性**：定义 PV 的特性，包括存储空间的大小、读写模式（如 ReadWriteOnce、ReadOnlyMany 或 ReadWriteMany），以及回收策略（如 Retain、Recycle 或 Delete）等；
- **Provisioner 的属性**：确定存储供应商（即 Volume Plugin）及其相关参数。Kubernetes 支持两种类型的存储插件：
    - **In-Tree 插件**：这些插件是 Kubernetes 源码的一部分，通常以前缀“kubernetes.io”命名，如 kubernetes.io/aws、kubernetes.io/azure 等。它们直接集成在 Kubernetes 项目中，为特定的存储服务提供支持；
    - **Out-of-Tree 插件**：这些插件根据 Kubernetes 提供的存储接口由第三方存储供应商实现，代码独立于 Kubernetes 核心代码。Out-of-Tree 插件允许更灵活地集成各种存储解决方案，以适应不同的存储需求。

以下是一个 Kubernetes StorageClass 配置示例。该 StorageClass 使用 AWS Elastic Block Store（aws-ebs）作为存储供应商，并通过 type 属性设置为 gp2，表示使用 AWS 的通用型 SSD 卷。

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp2
reclaimPolicy: Retain
allowVolumeExpansion: true
mountOptions:
  - debug
volumeBindingMode: Immediate
```

当 StorageClass 资源提交到 Kubernetes 集群后，aq 会根据 StorageClass 定义的模板以及 PVC 的请求规格，自动创建一个新的 PV 实例。创建完成后，PV 会自动与 PVC 绑定，PVC 的状态从 Pending 转变为 Bound，表示存储资源已准备好。随后，Pod 就能使用 StorageClass 定义的存储类型了。

 #### Kubernetes 存储系统设计

相信大部分读者对如何使用 Volume 已经没有疑问了。接下来，我们将继续探讨存储系统与 Kubernetes 的集成，以及它们是如何与 Pod 相关联的。

在深入这个高级主题之前，我们需要先掌握一些关于操作存储设备的基础知识。Kubernetes 继承了操作系统接入外置存储的设计，将新增或卸载存储设备分解为以下三个操作：

- **准备**（Provision）：首先，需要确定哪种设备进行 Provision。这一步类似于给操作系统准备一块新的硬盘，确定接入存储设备的类型、容量等基本参数。其逆向操作为 delete（移除）设备。
- **附加**（Attach）：接下来，将准备好的存储附加到系统中。Attach 可类比为将存储设备接入操作系统，此时尽管设备还不能使用，但你可以用操作系统的 fdisk -l 命令查看到设备。这一步确定存储设备的名称、驱动方式等面向系统的信息，其逆向操作为 Detach（分离）设备。
- **挂载**（Mount）：最后，将附加好的存储挂载到系统中。Mount 可类比为将设备挂载到系统的指定位置，这就是操作系统中 mount 命令的作用，其逆向操作为卸载（Unmount）存储设备。

注意

如果 Pod 中使用的是 EmptyDir、HostPath 这类 Volume，并不会经历附加/分离的操作，它们只会被挂载/卸载到某一个 Pod 中。

Kubernetes 中的 Volume 创建和管理主要由 VolumeManager（卷管理器）、AttachDetachController（挂载控制器）和 PVController（PV 生命周期管理器）负责。前面提到的 Provision、Delete、Attach、Detach、Mount 和 Unmount 操作由具体的 VolumePlugin（第三方存储插件，也称 CSI 插件）实现。

如图展示了一个带有 PVC 的 Pod 创建过程：

1. 首先，用户创建一个包含 PVC 的 Pod，该 PVC 要求使用动态存储卷；
2. 默认调度器 kube-scheduler 根据 Pod 配置、节点状态、PV 配置等信息，将 Pod 调度到一个合适的节点中；
3. PVController 会持续监测 ApiServer，当发现一个 PVC 已创建但仍处于未绑定状态时，它会尝试将一个 PV 与该 PVC 进行绑定。首先，PVController 会在集群内查找适合的 PV；如果找不到相应的 PV，它会调用 Volume Plugin 中的接口执行 Provision 操作。Provision 过程包括从远程存储介质创建一个 Volume，并在集群中创建一个 PV 对象，然后将此 PV 与 PVC 绑定；
4. 如果一个 Pod 被调度到某个节点后，它所定义的 PV 还没有被挂载，AttachDetachController 就会调用 Volume Plugin 中的接口，把远端的 Volume 挂载到目标节点中的设备上（例如：/dev/vdb）；
5. 在节点中，当 VolumeManager 发现一个 Pod 已调度到自己的节点上并且 Volume 已经完成挂载时，它会执行 mount 操作，将本地设备（即刚才得到的 /dev/vdb）挂载到 Pod 在节点上的一个子目录 `/var/lib/kubelet/pods/[pod uid]/volumes/kubernetes.io~iscsi/[PV name]`（以 iSCSI 类型的存储为例）；
6. 最后，Kubelet 启动 Pod，并使用 bind mount 方式将已挂载到本地目录的卷映射到 Pod 容器内。
![](https://www.thebyte.com.cn/assets/k8s-volume-fnGgoFQH.svg)
上述流程中第三方存储供应商实现 Volume Plugin 即 CSI（Container Storage Interface，容器存储接口）插件。CSI 是一个开放性的标准，目标是为容器编排系统（不仅仅是 Kubernetes，还包括 Docker Swarm 和 Mesos 等）提供统一的存储接口。

CSI 插件在实现上是一个可执行的二进制文件，它以 gRPC 的方式对外提供了三个主要的 gRPC 服务：Identity Service、Controller Service、Node Service 用于卷的管理、挂载和卸载等操作。笔者介绍如下：

其中，Identity Service 用于对外暴露插件本身的信息，它的接口定义如下：

```go
service Identity {
  // 返回插件的名称、版本和其他元数据。
  rpc GetPluginInfo(GetPluginInfoRequest)
    returns (GetPluginInfoResponse) {}

  // 返回插件支持的功能，例如是否支持卷的快照等。
  rpc GetPluginCapabilities(GetPluginCapabilitiesRequest)
    returns (GetPluginCapabilitiesResponse) {}

  rpc Probe (ProbeRequest)
    returns (ProbeResponse) {}
}
```

Controller Service 管理卷的生命周期，包括创建、删除和获取卷的信息，它的接口定义如下所示。

```go
service Controller {
  // 创建一个新卷，并返回该卷的详细信息。
  rpc CreateVolume (CreateVolumeRequest)
    returns (CreateVolumeResponse) {}
  // 删除指定的卷。
  rpc DeleteVolume (DeleteVolumeRequest)
    returns (DeleteVolumeResponse) {}
  // 将卷绑定到特定的节点，准备后续的挂载操作。
  rpc ControllerPublishVolume (ControllerPublishVolumeRequest)
    returns (ControllerPublishVolumeResponse) {}

  // 从节点解绑卷，准备进行删除或其他操作。
  rpc ControllerUnpublishVolume (ControllerUnpublishVolumeRequest)
    returns (ControllerUnpublishVolumeResponse) {}
  ...
```

Node Service 主要由 Kubelet 调用处理卷在节点上的挂载和卸载操作。它的接口定义如下：
```go
service Node {
  // 将卷挂载到节点的设备上，使其准备好被 Pod 使用。
  rpc NodeStageVolume (NodeStageVolumeRequest)
    returns (NodeStageVolumeResponse) {}
  // 将卷从节点的设备中卸载。
  rpc NodeUnstageVolume (NodeUnstageVolumeRequest)
    returns (NodeUnstageVolumeResponse) {}
  // 在指定的 Pod 中将卷挂载到容器的文件系统上。
  rpc NodePublishVolume (NodePublishVolumeRequest)
    returns (NodePublishVolumeResponse) {}
  ...
```

CSI 插件机制为存储供应商和容器编排系统之间的交互提供了标准化的接口。云存储厂商只需根据这一标准接口实现自己的云存储插件，即可无缝衔接 Kubernetes 的底层编排系统，Kubernetes 也由此具备了多样化的云存储、备份和快照等能力。

#### 存储分类：块存储、文件存储和对象存储

得益 Kubernetes 的开放性设计，感受提供了 CSI 插件支持的存储生态，基本上包含了市面上所有的存储供应商。
![[Pasted image 20250607193324.png]]

上述众多的存储系统无法一一展开，但作为业务开发工程师而言，直面的问题是，我应该选择哪种存储类型？无论是内置的存储插件还是第三方的 CSI 存储插件，总结提供的存储服务类型就 3 种：块存储（Block Storage）、文件存储（File Storage）和对象存储（Object Storage）。这三种存储类型特点与区别，笔者介绍如下：

- **块存储**：块存储是最接近物理介质的一种存储方式，常见的硬盘就属于块设备。块存储不关心数据的组织方式和结构，只是简单地将所有数据按固定大小分块，每块赋予一个用于寻址的编号。数据的读写通过与块设备匹配的协议（如 SCSI、SATA、SAS、FCP、FCoE、iSCSI 等）进行。
    
    块存储处于整个存储软件栈的底层，不经过操作系统，因此具有超低时延和超高吞吐。但缺点是每个块是独立的，缺乏集中控制机制来解决数据冲突和同步问题。因此，块存储设备通常不能共享，无法被多个客户端（节点）同时挂载。在 Kubernetes 中，块存储类型的 Volume 的访问模式必须是 RWO（ReadWriteOnce），即可读可写，但只能被单个节点挂载。
    
    由于块存储不关心数据的组织方式或内容，接口简单朴素，因此主要用于文件系统、专业备份管理软件、分区软件以及数据库，而非直接提供给普通用户。
    
- **文件存储**：块设备存储的是最原始的二进制数据（0 和 1），对于人类用户来说，这样的数据既难以使用也难以管理。因此，我们使用“文件”这一概念来组织这些数据。所有用于同一用途的数据按照不同应用程序要求的结构方式组成不同类型的文件，并用不同的后缀来指代这些类型。每个文件有一个便于理解和记忆的名称。当文件数量较多时，通过某种划分方式对这些文件分组，所有文件和目录形成一个树状结构。再补充权限、文件名称、创建时间、所有者、修改者等元数据信息。
    
    这种定义文件分配、实现方式、存储信息和提供功能的标准被称为“文件系统”（File System）。常见的文件系统有 FAT32、NTFS、exFAT、ext2/3/4、XFS、BTRFS 等等。如果文件存储在网络服务器中，客户端用类似访问本地文件系统的方式访问远程服务器上的文件，这样的系统称为“网络文件系统”。常见的网络文件系统有 Windows 网络的 CIFS（Common Internet File System，也称 SMB）和类 Unix 系统的 NFS（Network File System）。
    
- **对象存储**：文件存储的树状结构和路径访问方式便于人类理解、记忆和访问，但计算机需要逐级分解路径并查找，最终定位到所需文件，这对于应用程序而言既不必要，也浪费性能。块存储则性能出色，但难以理解且无法共享。选择困难症出现的同时，人们思考：“是否可以有一种既具备高性能、实现共享、又能满足大规模扩展需求的新型存储系统？”。于是，对象存储应运而生。
    
    对象存储中的“对象”可以理解为元数据与逻辑数据块的组合：
    
    - 元数据提供了对象的上下文信息，如数据类型、大小、权限、创建人、创建时间等；
    - 数据块则存储了对象的具体内容。
    
    对象存储中，所有数据处于同一层次，通过唯一标识来识别和查找（扩展简单），非常适合处理数据量大、增速快的非结构化数据（如视频、图像等）。
    
    最著名的对象存储服务是 AWS S3（Simple Storage Service），它的接口规范已经成为业内对象存储服务事实标准。如果你考虑降低云成本，也可以通过开源项目如 Ceph、Minio 或 Swift 等自建对象存储服务。


### 容器间通信原理
要理解容器网络的工作原理，一定要从 Flannel 项目入手。Flannel 是 CoreOS 推出的容器网络解决方案，是业界公认是“最简单”的容器网络解决方案。接下来，笔者将以 Flannel 为例，介绍容器间通信的三种模式、容器网络接口（CNI）的设计及生态。

#### Overlay 覆盖网络模式
Overlay 网络的设计思想。简而言之，它在现有三层网络之上“叠加”了一层由内核 VXLAN 模块管理的虚拟二层网络。

为在宿主机网络上构建虚拟二层通信网络（即建立隧道网络），VXLAN 模块会在通信双方配置特殊的网络设备作为隧道端点，称为 VTEP（VXLAN Tunnel Endpoints，VXLAN 隧道端点）。VTEP 是虚拟网络设备，具备 IP 地址和 MAC 地址。它根据 VXLAN 通信规范，负责将分布在不同节点和子网的“主机”（如容器或虚拟机）发送的数据包进行封装和解封，从而使它们能够像在同一局域网内一样进行通信。

上述基于 VTEP 设备构建“隧道”通信的流程。
![](https://www.thebyte.com.cn/assets/flannel-vxlan-CCkSgVDe.svg)
从图中可以看到，宿主机内的容器通过 veth-pair（虚拟网卡）桥接到名为 cni0 的 Linux Bridge。同时，每个宿主机都有一个名为 flannel.1 的设备，作为 VXLAN 所需的 VTEP 设备。当容器接收或发送数据包时，它们通过 flannel.1 设备进行封装和解封。

在 VXLAN 规范中，数据包由两层构成：

- **内层帧**（Inner Ethernet Header），属于 VXLAN 逻辑网络；
- **外层帧**（Outer Ethernet Header），属于宿主机网络。

当 Kubernetes 节点加入 Flannel 网络后，Flannel 会启动名为 flanneld 的服务，作为 DaemonSet 在集群中运行。flanneld 负责为每个节点内的容器分配子网，并同步集群内的网络配置信息，以确保各节点之间的网络连通性和一致性。

接下来，我们来分析当 Node1 中的 Container-1 与 Node2 中的 Container-2 通信时，Flannel 是如何进行封包和解包的。

首先，当 Container-1 发出请求时，目标地址为 100.10.2.3 的 IP 数据包会通过 cni0 Linux 网桥。由于该地址不在 cni0 网桥的转发范围内，数据包将被送入 Linux 内核协议栈，进一步路由到 flannel.1 设备进行处理。

Node1 中的路由信息由 flanneld 添加，规则大致如下：

```bash
[root@Node1 ~]# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
100.10.1.0      0.0.0.0         255.255.255.0   U     0      0        0 cni0
100.10.2.0      100.10.2.0      255.255.255.0   UG    0      0        0 flannel.1
```

上面两条路由的意思是：

- 凡是发往 100.10.1.0/24 网段的 IP 报文，都需要经过接口 cni0。
- 凡是发往 100.10.2.0/24 网段的 IP 报文，都需要经过接口 flannel.1，并且最后一跳的网关地址是 10.224.1.0（也就是 Node2 中 VTEP 的设备）。

根据上述路由规则，Container-1 发出的数据包会交由 flannel.1 设备处理，即数据包进入了隧道的“起始端点”。当“起始端点”接收到原始的 IP 数据包后，它会构造 VXLAN 网络的内层以太网帧，并将其发送到隧道网络的“目的端点”，即 Node2 中的 VTEP 设备。这样，虚拟二层网络就成功建立，容器可以跨节点进行通信。

构造 VXLAN 网络内层以太网帧的前提是，Node1 节点的 flannel.1 设备需要知道 Node2 中 flannel.1 设备的 IP 地址和 MAC 地址。当前，我们已经通过 Node1 的路由表获得了 VTEP 设备的 IP 地址（100.10.2.0）。那么，如何获取 flannel.1 设备的 MAC 地址呢？

实际上，Node2 中 VTEP 设备的 MAC 地址已由 flanneld 自动添加到 Node1 的 ARP 表中。在 Node1 中执行下面的命令：

```bash
[root@Node1 ~]# ip n | grep flannel.1
100.10.2.0  dev flannel.1 lladdr ba:74:f9:db:69:c1 PERMANENT # PERMANENT 表示永不过期
```

上面记录的意思是，IP 地址 10.10.2.0（也就是 Node2 flannel.1 设备的 IP）对应的 MAC 地址是 ba:74:f9:db:69:c1。

>注意
>这里 ARP 表记录并不是通过 ARP 协议学习得到的，而是 flanneld 预先为每个节点设置好的，没有过期时间。

现在，内层以太网帧已完成封装。接下来，Linux 内核将内层帧封装至宿主机 UDP 报文内，以“搭便车”的方式发送到宿主机的二层网络中。

为了实现“搭便车”机制，Linux 内核会在内层数据帧前添加一个特殊的 VXLAN Header，用于标识“乘客” 要转发给 VXLAN 模块处理。VXLAN Header 中有一个重要的标志 —— VNI（VXLAN Network Identifier），这是 VTEP 设备判断数据包是否属于自己处理的依据。在 Flannel 的 VXLAN 模式下，所有节点的 VNI 默认为 1，这也是 VTEP 设备命名为 flannel.1 的原因。

接下来，Linux 内核会将二层数据帧封装进宿主机的 UDP 报文。

在进行 UDP 封装时，首先需要确定四元组信息，即目的 IP 和目的端口。默认情况下，Linux 内核为 VXLAN 分配的 UDP 端口为 4789，因此目的端口为 4789。而目的 IP 地址则通过转发表（forwarding database，fdb）获取，fdb 表中的信息也由 flanneld 提前配置。在 Node1 中执行下面的命令：

```bash
[root@Node1 ~]# bridge fdb show | grep flannel.1
ba:74:f9:db:69:c1 dev flannel.1 dst 192.168.50.3 self permanent
```

上面记录的意思是，目的 MAC 地址为 ba:74:f9:db:69:c1（ Node2 VTEP 设备的 MAC 地址）的数据帧封装后，应该发往哪个目的IP（192.168.50.3）。

至此，VTEP 设备已收集到所有封装所需的信息，并调用宿主机网络的 UDP 协议发送函数将数据包发出。接下来的过程与本机 UDP 程序发送数据包类似，就不再赘述了。

接下来，我们来看 Node2 收到数据包后的处理流程。

当数据包到达 Node2 的 8472 端口时，内核中的 VXLAN 模块会检查以下两个条件：

- **VNI 比较**：VXLAN 模块会检查 VXLAN Header 中的 VNI 是否与本机的 VXLAN 网络的 VNI 一致；
- **MAC 地址比较**：接着，比较内层数据帧中的目的 MAC 地址与本机的 flannel.1 设备的 MAC 地址是否匹配。

如果上述两个条件都满足，VXLAN 模块会去除数据包中的 VXLAN Header 和内层以太网帧 Header，恢复出 Container-1 原始发送的数据包。随后，根据 Node2 节点的路由规则（由 flanneld 提前配置），继续进行路由处理。

```bash
[root@Node2 ~]# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
...
100.10.2.0      0.0.0.0         255.255.255.0   U     0      0        0 cni0
```

从上面的路由规则可以看出，目标地址属于 100.10.2.0/24 网段的数据包会被交给 cni0 接口处理。接下来，数据包将按照 Linux 网桥的处理流程转发至对应的 Pod。

至此，Flannel VXLAN 模式的整个工作流程宣告结束。

#### 三层路由模式

Flannel 的 host-gw 模式是“host gateway”的缩写。从名称可以看出，host-gw 工作模式通过宿主机路由表实现容器间通信。

该模式的工作原理简单明了，如图 7-27 所示。
![](https://www.thebyte.com.cn/assets/flannel-route-DdD3ppfH.svg)
现在，假设 Node1 中的 container-1 与 Node2 中的 container-2 通信，我们来看 host-gw 模式是如何工作的。

首先，当 Kubernetes 节点加入 Flannel 网络后，flanneld 会在上面创建以下路由规则：

```bash
$ ip route
100.96.2.0/24 via 10.244.1.0 dev eth0
```

这条路由的含义是，目的地为 100.96.2.0/24 的 IP 包应通过 eth0 接口发送，其下一跳地址为 10.244.1.0（via 10.244.1.0）。

什么是下一跳

所谓“下一跳”是指 IP 数据包发送时需要经过某个路由设备的中转，下一跳的地址就是该中转路由设备的 IP 地址。例如，如果你个人电脑中配置的网关地址为 192.168.0.1，那么本机发出的所有 IP 包都需要经过 192.168.0.1 进行中转。

一旦确定了下一跳地址，Node1 中的 container-1 发出的 IP 包将被宿主机网络路由至下一跳地址，即 Node2 节点。

同样，Node2 中也有 flanneld 提前创建的路由规则。如下所示：

```bash
$ ip route
100.10.0.0/24 dev cni0 proto kernel scope link src 100.10.0.1
```

这条路由规则的含义是，目的地属于 100.10.0.0/24 网段的 IP 包应被送往 cni0 网桥。接下来的处理过程笔者就不再赘述了。

由此可见，Flannel 的 host-gw 模式实际上将每个容器子网（如 Node1 中的 100.10.1.0/24）的下一跳设置为目标主机的 IP 地址，利用宿主机的路由功能充当容器间通信的“路由网关”，这也是“host-gw”名称的由来。

host-gw 模式没有封包/解包的额外消耗，在性能表现上肯定优于前面介绍的 Overlay 模式。但由于它依赖于下一跳路由，因此它肯定无法用于宿主机跨子网的通信。

三层路由模式除了 Flannel 的 host-gw 模式外，还有一个更具代表性的项目 —— Calico。

Calico 和 Flannel 的原理都是直接利用宿主机的路由功能实现容器间通信，但不同之处在于**Calico 通过 BGP 协议实现路由规则的自动化分发**。因此 Calico 的灵活性更强，更适合大规模容器组网。

什么是 BGP

BGP（Border Gateway Protocol，边界网关协议）使用 TCP 作为传输层的路由协议，用于交互 AS（Autonomous System，自治域）之间的路由规则。每个 BGP 服务实例一般称为“BGP Router”，与 BGP Router 连接的对端称为“BGP Peer”。每个 BGP Router 收到 Peer 传来的路由信息后，经过校验判断后，将其存储在路由表中。

了解 BGP 协议之后，再看 Calico 的架构，就能理解它各个组件的作用了：

- **Felix**：负责在宿主机上插入路由规则，相当于 BGP Router；
- **BGP Client**：BGP 的客户端，负责在集群内分发路由规则，相当于 BGP Peer。

![](https://www.thebyte.com.cn/assets/calico-bgp-Dusc2zh6.svg)
除了对路由信息的维护的区别外，Calico 与 Flannel 的另一个不同之处在于，它不会设置任何虚拟网桥设备。观察图 ，Calico 并未创建 Linux Bridge，而是将每个 Veth-Pair 设备的另一端放置在宿主机中（名称以 cali 为前缀），然后根据路由规则进行转发。例如，Node2 中 container-1 的路由规则如下：

```bash
$ ip route
10.223.2.3 dev cali2u3d scope link
```

这条路由规则的含义是，发往 10.223.2.3 的数据包应进入与 container-1 连接的 cali2u3d 设备（也就是 Veth-Pair 设备的另一端）。

由此可见，Calico 实际上将集群中每个节点的容器视为一个 AS（Autonomous System，自治域），并将节点视为边界路由器，节点之间相互交互路由规则，从而构建出容器间的三层路由网络。

#### Underlay 底层网络模式

接下来介绍的是最后一种容器间通信模式 —— Underlay 底层网络模式。

Underlay 模式本质上是**直接利用宿主机的二层网络进行通信**。在这种模式下，容器通常依赖于 MACVLAN 技术来组网。

MAC 地址通常是网卡接口的唯一标识，保持一对一关系。而 MACVLAN 技术打破了这一规则，它借鉴 VLAN 子接口的概念，在物理设备之上、内核网络栈之下创建多个“虚拟以太网卡”，每个虚拟网卡都有独立的 MAC 地址。

通过 MACVLAN 技术虚拟出的副本网卡在功能上与真实网卡完全对等。在接收到数据包后，物理网卡承担类似交换机的职责，它根据目标 MAC 地址判断该数据包应转发至哪块副本网卡处理。
![](https://www.thebyte.com.cn/assets/macvlan-DYuGzlCt.svg)
由于同一物理网卡虚拟出的副网卡天然位于同一子网（VLAN）内，因此它们可以直接在宿主机的二层网络中进行通信。

Docker 的网络模型中的 Macvlan 模式，正是利用上述“子设备”实现组网。Docker 使用 Macvlan 模式配置网络的命令如下：

```bash
$ docker network create -d macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 macvlan_network
```

可以看出，Underlay 底层网络模式直接利用物理网络资源，绕过了容器网络桥接和 NAT，因此具有最佳的性能表现。不过，由于依赖硬件和底层网络环境，部署时需要根据具体的软硬件条件进行调整，缺乏 Overlay 网络那样的开箱即用的灵活性。

### CNI 插件及生态

设计一个容器网络模型是一个很复杂的事情，Kubernetes 本身并不直接实现网络模型，而是通过 CNI（Container Network Interface，容器网络接口）把网络变成外部可扩展的功能。

CNI 接口最初由 CoreOS 为 rkt 容器创建，如今已成为容器网络的事实标准，广泛应用于 Kubernetes、Mesos 和 OpenShift 等容器平台。需要注意的是，CNI 接口并非类似于 CSI、CRI 那样的 gRPC 接口，而是指调用符合 CNI 规范的可执行程序，这些程序被称为“CNI 插件”。

以 Kubernetes 为例，Kubernetes 节点默认的 CNI 插件路径为 /opt/cni/bin。在该路径下，可以查看到可用的 CNI 插件，这些插件有的是内置的，有些是安装容器网络方案时自动下载的。

```bash
$ ls /opt/cni/bin/
bandwidth  bridge  dhcp  firewall  flannel calico-ipam cilium...
```

CNI 插件的大致工作流程如图所示。在创建 Pod 时，容器运行时根据 CNI 配置规范（如设置 VXLAN 网络、配置节点容器子网等），通过标准输入（stdin）向 CNI 插件传递网络配置信息。待 CNI 插件完成网络配置后，容器运行时通过标准输出（stdout）接收配置结果。
![[Pasted image 20250609090454.png]]

举个具体例子，使用 Flannel 配置 VXLAN 网络，来帮助你理解 CNI 插件的工作流程。

首先，当在宿主机安装 flanneld 时，flanneld 启动会在每台宿主机生成对应的 CNI 配置文件，告诉 Kubernetes：该集群使用 flannel 容器网络方案。 CNI 配置文件通常位于 /etc/cni/net.d/ 目录下。它的配置如下所示：

```json
{
  "cniVersion": "0.4.0",
  "name": "container-cni-list",
  "plugins": [
    {
      "type": "flannel",
      "delegate": {
        "isDefaultGateway": true,
        "hairpinMode": true,
        "ipMasq": true,
        "kubeconfig": "/etc/kube-flannel/kubeconfig"
      }
    }
  ]
}
```

接下来，容器运行时（如 CRI-O 或 containerd）会加载上述 CNI 配置文件，将 plugins 列表中的第一个插件（Flannel）设置为默认插件。在 Kubernetes 启动容器之前（即在创建 Infra 容器时），kubelet 调用 CNI 插件，传入下面两类参数，来为 Infra 容器配置网络。

- **Pod 信息**：如容器的唯一标识符、Pod 所在的命名空间、Pod 的名称等，这些信息一般组织成 JSON 对象；
- **CNI 插件要执行的操作**：
    - add 操作：用于分配 IP 地址、创建 veth pair 设备等，并将容器添加到 Flannel 网络中；
    - del 操作：用于清除容器的网络配置，将容器从 Flannel 网络中删除。

接下来，容器运行时会通过标准输入将上述参数传递给 CNI 插件。后续的逻辑则是 CNI 插件的具体操作，具体细节就不再赘述了。

```bash
echo '{
  "cniVersion": "0.4.0",
  "name": "flannel",
  "type": "flannel",
  "containerID": "abc123def456",
  "namespace": "default",
  "podName": "my-pod",
  "netns": "/var/run/netns/abc123def456",
  "ifname": "eth0",
  "args": {
    "isDefaultGateway": true
  }
}' | /opt/cni/bin/flannel add abc123def456
```

最后，CNI 插件执行完毕后，会将容器的 IP 地址等信息返回给容器运行时，并由 kubelet 更新到 Pod 的状态字段中，整个容器网络配置就宣告结束了。

通过 CNI 这种开放性的设计，需要接入什么样的网络，设计一个对应的网络插件即可。这样一来节省了开发资源集中精力到 Kubernetes 本身，二来可以利用开源社区的力量打造一整个丰富的生态。现如今，如图 7-31 所示，支持 CNI 规范的网络插件多达几十种。这些网络插件笔者无法逐一解释，但就实现的容器通信模式而言，总结就上面三种类型：Overlay 覆盖网络模式、三层路由模式 和 Underlay 底层网络模式。
![[Pasted image 20250609090504.png]]

需要补充的是，对于容器编排系统而言，网络并非孤立的功能模块，还要配套各类的网络访问策略能力支持。例如，用来限制 Pod 出入站规则网络策略（NetworkPolicy），对网络流量数据进行分析监控等等额外功能。这些需求明显不属于 CNI 规范内的范畴，因此并不是每个 CNI 插件都会支持这些额外功能。如果你选择 Flannel 插件，必须配套其他插件（如 Calico 或 Cilium）才能启用网络策略。因此，有这方面需求的，应该考虑功能更全面的网络插件。

### 资源模型及编排调度
过去的集群管理平台（如 Mesos、Swarm）擅长的是，通过特定规则将容器调度到最佳节点上，这一功能称为“调度”。而 Kubernetes 擅长的，是根据系统规则和用户需求，自动化地处理好容器间的各种关系，这个功能就是我们常听到的 “编排”。

#### 资源模型与资源管理
##### 资源模型
在 Kubernetes 中，Pod 是最小的调度单元。因此，所有与调度和资源管理相关的属性都应包含在 Pod 对象中。

与调度密切相关的主要是 CPU 和内存的配置，如下所示：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: qos-demo-5
  namespace: qos-example
spec:
  containers:
    - name: qos-demo-ctr-5
      image: nginx
      resources:
        limits:
          memory: "200Mi"
          cpu: "700m"
        requests:
          memory: "200Mi"
          cpu: "700m"
```
像 CPU 这类的资源被称作可压缩资源。这类资源不足时，Pod 内的进程变得卡顿，但 Pod 不会因此被杀掉。

Kubernetes 中的 CPU 资源计量单位为“个数”。例如，CPU=1 表示 Pod 的 CPU 限额为 1 个 CPU。具体的“1 个 CPU”定义取决于宿主机的硬件配置，它可能对应多核处理器中的一个核心、一个超线程（Hyper-Threading）或虚拟机中的一个虚拟处理器（vCPU）。对于不同硬件环境构建的 Kubernetes 集群，1 个 CPU 的实际算力可能有所不同，但 Kubernetes 只保证 Pod 能够使用到“1 个 CPU”这一逻辑单位的算力。

实际上，Kubernetes 中常用的 CPU 计量单位是毫核（Millcores，缩写 m）。1 个 CPU 等于 1000m。这样可以更精确地度量和分配 CPU 资源。例如，分配给某个容器 500m CPU，相当于 0.5 个 CPU。

像内存这样的资源被称作不可压缩资源。这类资源不足时，可能会杀死 Pod 中的进程，甚至驱逐整个 Pod。 对于内存资源来说，最基本的计量单位是字节。如果没有明确指定单位，默认以字节为计量单位。为了方便使用，Kubernetes 支持以 Ki、Mi、Gi、Ti、Pi、Ei 或 K、M、G、T、P、E 为单位来表示内存大小。例如，下面是一些相同内存值的不同表示方式：

```bash
128974848, 129e6, 129M, 123Mi
```

> 注意区分 Mi 和 M，1Mi=1024x1024，1M=1000x1000。随着数值的增加，Mi 和 M 计算的差异会越来越大，因此使用带小 i 的更准确。

##### 资源分配
Kubernetes 使用以下两个属性来描述 Pod 的资源分配和限制：

- **requests**：表示容器请求的资源量，Kubernetes 会确保 Pod 获得这些资源。requests 是调度的依据，调度器只有在节点上有足够可用资源时，才会将 Pod 调度到该节点。
- **limits**：表示容器可使用的资源上限，防止容器过度消耗资源，导致节点过载。limits 会配置到 cgroups 中相应任务的 /sys/fs/cgroup 文件中。

Pod 是由一个或多个容器组成的，因此资源需求是在容器级别进行描述的。如图所示，每个容器都可以通过 resources 属性单独设定相应的 requests 和 limits。例如，container-1 指定其容器进程需要 500m（即 0.5 个 CPU）才能被调度，并且允许最多使用 1000m（即 1 个 CPU）。
![[Pasted image 20250609164023.png]]

requests 和 limits 除了用于表明资源需求和限制资源使用之外，还有一个隐含功能，它决定了 Pod 的 QoS（Quality of Service，服务质量）等级。

##### 服务质量等级

Kubernetes 根据每个 Pod 中容器资源配置情况，为 Pod 设置不同的服务质量（QoS，Quality of Service）等级。不同的 QoS 等级决定了当节点资源紧张时，Kubernetes 该如何处理节点上的 Pod，也就是接下来要讨论的驱逐（eviction）机制。

Pod 的 QoS 级别与资源配置之间的对应关系，具体名称及含义如下：
- **Guaranteed**：Pod 中每个容器必须配置相等的 CPU 和内存 requests 与 limits。此类 Pod 通常用于需要稳定资源的应用（如数据库）。在节点资源紧张时，Guaranteed 类型的 Pod 最不容易被驱逐。
- **Burstable**：Pod 中至少有一个容器设置了 requests 或 limits，但并非所有容器的请求和限制都相等。Burstable 类型的 Pod 在资源使用上有一定灵活性，但优先级低于 Guaranteed 类型。在节点资源紧张时，可能会被驱逐。
- **Best Effort**：Pod 中的容器没有设置 CPU 或内存的 requests 和 limits。Best Effort 类型的 Pod 通常用于临时或非关键任务，会尽可能使用可用资源，但在资源紧张时最容易被驱逐。
![[Pasted image 20250609164044.png]]
从上述描述可见，未配置 requests 和 limits 时，Pod 的 QoS 等级最低，在节点资源紧张时最容易受到影响。因此，合理配置 requests 和 limits 参数，能够提高调度精确度，并增强服务的稳定性。

##### 节点资源管理

在 Kubernetes 系统中，每个节点都运行着容器运行时（如 Docker、containerd）以及负责管理容器的组件 kubelet。这些基础服务在节点上运行时，会占用一定的资源。因此，当 Kubernetes 进行资源管理时，必须为这些基础服务预先分配一部分资源。

Kubelet 通过下面两个参数，控制节点上基础服务的资源预留额度：

- **--kube-reserved**=[cpu=100m][,][memory=100Mi][,][ephemeral-storage=1Gi]：预留给 Kubernetes 组件 CPU、内存和存储资源。
- **--system-reserved**=[cpu=100mi][,][memory=100Mi][,][ephemeral-storage=1Gi]：预留给操作系统的 CPU、内存和存储资源。

需要注意的是，考虑 Kubernetes 驱逐机制，kubelet 会确保节点上的资源使用率不会达到 100%。因此，Pod 实际可用的资源会更少一些。最终，一个节点的资源分配如图 7-34 所示。

Node Allocatable Resource（节点可分配资源）= Node Capacity（节点所有资源） - Kube Reserved（Kubernetes 组件预留资源）- System Reserved（系统预留资源）- Eviction Threshold（为驱逐预留的资源）。
![](https://www.thebyte.com.cn/assets/k8s-resource-Db4gyTHO.svg)
#####  驱逐机制

当不可压缩类型的资源（如可用内存 memory.available、宿主机磁盘空间 nodefs.available、镜像存储空间 imagefs.available）不足时，保证节点稳定的手段是驱逐（Eviction）那些不太重要的 Pod，使其能够重新调度到其他节点。

承担上述职责的组件为 kubelet。kubelet 运行在节点上，能够轻松感知节点的资源耗用情况。当 kubelet 发现不可压缩类型的资源即将耗尽时，触发两类驱逐策略。

kubelet 的第一种驱逐策略是软驱逐（soft eviction）。

由于节点资源耗用可能是临时性波动，通常会在几十秒内恢复。因此，当资源耗用达到设定阈值时，应先观察一段时间再决定是否触发驱逐操作。与软驱逐相关的 kubelet 配置参数如下：

- **--eviction-soft**：软驱逐触发条件。例如，可用内存（memory.available）< 500Mi，可用磁盘空间（nodefs.available）< 10% 等等。
- **--eviction-soft-grace-period**：软驱逐宽限期。例如，memory.available=2m30s，即可用内存 < 500Mi，并持续 2m30s 后，才真正开始驱逐 Pod。
- **--eviction-max-pod-grace-period**：Pod 优雅终止宽限期，该参数决定给 Pod 多少时间来优雅地关闭（graceful shutdown）。

kubelet 的第二种驱逐策略是硬驱逐（hard eviction）。

硬驱逐主要关注节点稳定性，防止资源耗尽导致节点不可用。硬驱逐相当直接，当 kubelet 发现节点资源耗用达到硬驱逐阈值时，会立即杀死相应的 Pod。与硬驱逐相关的 kubelet 配置参数仅有 --eviction-hard，其配置方式与 --eviction-soft 一致，笔者就不再赘述了。

需要注意的是，当 kubelet 驱逐部分 Pod 后，节点的资源使用可能在一段时间后再次达到阈值，进而触发新的驱逐，形成循环，这种现象称为“驱逐波动”。为了预防这种情况，kubelet 预留了以下参数：

- **--eviction-minimum-reclaim**：决定每次驱逐时至少要回收的资源量，以停止驱逐操作；
- **--eviction-pressure-transition-period**：决定 kubelet 上报节点状态的时间间隔。较短的上报周期可能导致频繁更改节点状态，从而引发驱逐波动。

最后，以下是与驱逐相关的 kubelet 配置示例：

```yaml
$ kubelet --eviction-soft=memory.available<500Mi,nodefs.available < 10%,nodefs.inodesFree < 5%,imagefs.available < 15% \
--eviction-soft-grace-period=memory.available=1m30s,nodefs.available=1m30s \
--eviction-max-pod-grace-period=120 \
--eviction-hard=memory.available<500Mi,nodefs.available < 5% \
--eviction-pressure-transition-period=30s \
--eviction-minimum-reclaim="memory.available=500Mi,nodefs.available=500Mi,imagefs.available=1Gi"
```














.容器类型说明
![[napkin-selection.png]]

![[f429ca7114eebf140632409f3fbcbb05.png]]

和docker中不太一样，kubernetes中有自己的子网，因此进行网络访问相对来说复杂一点。 想要访问kubernetes中的的子模块一般需要进行端口映射， `kubectl port-forward pod-name 8080:80 &`

minikube中能通过 `minikube dashboard` 来使用界面查看kubernetes的运行状况。

### Deployment 应用永不宕机

![[Pasted image 20250430201959.png]]

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
```

.Deployment yaml注意事项
![[1f1fdcd112a07cce85757e27fbcc1bb0.jpg]]

按照配置启动deployment之后，可以使用 `kubectl get deploy -A` 命令查看启动之后的状态信息，一旦按照将节点布置成Deployment节点，后期启动完成只后，调用 `kubectl delete pod pod-name` 删除pod节点，deployment会负责将删除的pod节点重新启动。

如果前期备份太少，后面也能使用命令对备机进行扩容，扩容命令 `kubectl scale --replicas=5 deploy ngx-dep` 当然为了能长期生效，最好是修改yaml之后再使用 apply -f修副本的数量。

如果一个系统中启动的deployment数量很多，可以使用 -l命令来过滤想要的 labels支持 ==、!=、in、notin等字段

```bash
kubectl get pod -l app=nginx
kubectl get pod -l 'app in (ngx, nginx, ngx-dep)'
```

1. Pod只能管理容器，不能管理自身，所以就出现了Deployment，由它来管理Pod。
2. Deployment里有三个关键字段，其中的template和Job一样，定义了要运行的Pod模板。
3. replicas字段定义了Pod的“期望数量”，Kubernetes会自动维护Pod数量到正常水平。
4. selector字段定义了基于labels筛选Pod的规则，它必须与template里Pod的labels一致。
5. 创建Deployment使用命令 `kubectl apply`，应用的扩容、缩容使用命令 `kubectl scale`。

学了Deployment这个API对象，我们今后就不应该再使用“裸Pod”了。即使我们只运行一个Pod，也要以Deployment的方式来创建它，虽然它的 `replicas` 字段值是1，但Deployment会保证应用永远在线。

```bash
kubectl api-resources

NAME          SHORTNAMES      APIVERSION      NAMESPACED      KIND
deployments   deploy          apps/v1         true            Deployment
```

同样可以使用kubectl生成Deployment的模板

```bash
export out="--dry-run=client -o yaml"
kubectl create deploy ngx-dep --image=nginx:alpine $out
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    app: ngx-dep
  name: ngx-dep
spec:
  replicas: 1   # 可以实现多实例
  selector:
    matchLabels:
      app: ngx-dep
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: ngx-dep
    spec:
      containers:
      - image: nginx:alpine
        name: nginx
        resources: {}
status: {}
```

### Daemonset 忠实可靠的看门狗

Kubernetes定义了新的API对象DaemonSet，它在形式上和Deployment类似，都是管理控制Pod，但管理调度策略却不同。DaemonSet的目标是在集群的每个节点上运行且仅运行一个Pod，就好像是为节点配上一只“看门狗”，忠实地“守护”着节点，这就是DaemonSet名字的由来。

DaemonSet和Deployment都属于在线业务，所以它们也都是“apps”组，使用命令 `kubectl api-resources` 可以知道它的简称是 `ds`

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: xxx-ds
```

应为DaemonSet不能命令行生成示例，可以使用在线示例进行改写
https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/daemonset/[DaemonSet eg.]

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: redis-ds
  labels:
    app: redis-ds

spec:
    selector:
      matchLabels:
        name: redis-ds

    template:
      metadata:
        labels:
          name: redis-ds
      spec:
        containers:
        - image: redis:5-alpine
          name: redis
          ports:
          - containerPort: 6379
```

![[c1dee411aa02f4ff2b8caaf0bd627a1c.jpg]]

DaemonSet仅仅是在Pod的部署调度策略上和Deployment不同，其他的都是相同的，某种程度上我们也可以把DaemonSet看做是Deployment的一个特例。

*静态Pod*

“静态Pod”非常特殊，它不受Kubernetes系统的管控，不与apiserver、scheduler发生关系，所以是“静态”的。

但既然它是Pod，也必然会“跑”在容器运行时上，也会有YAML文件来描述它，而唯一能够管理它的Kubernetes组件也就只有在每个节点上运行的kubelet了。

“静态Pod”的YAML文件默认都存放在节点的 `/etc/kubernetes/manifests` 目录下，它是Kubernetes的专用目录。

Kubernetes的4个核心组件apiserver、etcd、scheduler、controller-manager原来都以静态Pod的形式存在的，这也是为什么它们能够先于Kubernetes集群启动的原因。

如果你有一些DaemonSet无法满足的特殊的需求，可以考虑使用静态Pod，编写一个YAML文件放到这个目录里，节点的kubelet会定期检查目录里的文件，发现变化就会调用容器运行时创建或者删除静态Pod。

### Service：微服务架构的应对之道

有了Deployment之后和DaemonSet应用能够快速进行迭代，但是Deployment等又会导致应用节点变来变去，而Service-服务发现就是用来解决这个问题的。

![[0347a0b3bae55fb9ef6c07469e964b74.png]]

![[image-2025-02-26-16-11-17-130.png]]

这里Service使用了iptables技术，每个节点上的kube-proxy组件自动维护iptables规则，客户不再关心Pod的具体地址，只要访问Service的固定IP地址，Service就会根据iptables规则转发请求给它管理的多个Pod，是典型的负载均衡架构。

用命令 `kubectl api-resources` 查看它的基本信息，可以知道它的简称是 `svc`，apiVersion是 `v1`。 **注意，这说明它与Pod一样，属于Kubernetes的核心对象，不关联业务应用，与Job、Deployment是不同的。**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    # 选定Pod的标签，可以是Deployment或者DeamonSet中定义的标签
    app.kubernetes.io/name: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 9376
```

https://kubernetes.io/zh-cn/docs/concepts/services-networking/service/[官方Service文档]

同样可以使用命令生成一个Service的示例，但是这里不是使用的create而是使用expose

```bash
export out="--dry-run=client -o yaml"
kubectl expose deploy ngx-dep --port=80 --target-port=80 $out
```

.Service和代理的节点之间的对应关系
![[0f74ae3a71a6a661376698e481903d64.jpg]]

使用  `kubectl get ns` 能查看kubernetes里面有哪些域名。

*使用Service对外暴露服务*

Service对象有一个关键字段“ **type**”，表示Service是哪种类型的负载均衡。前面我们看到的用法都是对集群内部Pod的负载均衡，所以这个字段的值就是默认的“ **ClusterIP**”，Service的静态IP地址只能在集群内访问。

除了“ClusterIP”，Service还支持其他三种类型，分别是“ **ExternalName**”“ **LoadBalancer**”“ **NodePort**”。不过前两种类型一般由云服务商提供，我们的实验环境用不到，所以接下来就重点看“NodePort”这个类型。

如果我们在使用命令 `kubectl expose` 的时候加上参数 `--type=NodePort`，或者在YAML里添加字段 `type:NodePort`，那么Service除了会对后端的Pod做负载均衡之外，还会在集群里的每个节点上创建一个独立的端口，用这个端口对外提供服务，这也正是“NodePort”这个名字的由来。

![[643cf4690a42f723732f9f150021fff9.png]]

就会看到“TYPE”变成了“NodePort”，而在“PORT”列里的端口信息也不一样，除了集群内部使用的“80”端口，还多出了一个“30651”端口，这就是Kubernetes在节点上为Service创建的专用映射端口。

因为这个端口号属于节点，外部能够直接访问，所以现在我们就可以不用登录集群节点或者进入Pod内部，直接在集群外使用任意一个节点的IP地址，就能够访问Service和它代理的后端服务了。

![[fyyebea67e4471aa53cb3a0e8ebe624a.jpg]]

> HostPort（宿主机端口映射）是直接访问Pod不会进行负载均衡，但是NodePort Service会进行负载均衡，见: https://team.jiunile.com/blog/2020/11/k8s-cilium-service.html[k8s-service]


### 服务发现

Kubernetes 通过以下方式来实现服务发现（ Service discovery）。

- DNS（推荐）
- 环境变量（绝对不推荐）

基于 DNS 的服务发现需要 DNS 集群插件（ cluster-add-on） 它其实就是 Kubernetes的 DNS 原生服务的另一种说法。在其内部实现了以下功能。

- 运行 DNS 服务的控制层 Pod。
- 一个面向所有 Pod 的名为 kube-dns 的服务。
- Kubelet 为每一个容器都注入了该 DNS（通过/etc/resolv.conf）

这个 DNS 插件会持续监测 API Server 中新 Service 的动向，并且自动注册到 DNS 中。因此，每一个 Service 都有一个可以在整个集群范围内都能解析的 DNS 名称。另一种实现服务发现的方式是借助环境变量。每一个 Pod 中都有能够解析集群中所有Service 的一组环境变量。不过，这种方式极其受限，仅仅在不使用集群中的 DNS 服务时才会被考虑。

关于环境变量方式的最大问题在于，环境变量只有在 Pod 最初创建的时候才会被注入。 这就意味着， Pod 在创建之后是并不知道新 Service 的。这种方式并不理想，也因此更加推荐 DNS 方式。




### Ingress 集群进出口流量的总管(比Service更加细化)
[[Ingress集群进出口流量的总管]]

Service是运行在四层上的负载均衡，但在四层上的负载均衡功能还是太有限了，只能够依据IP地址和端口号做一些简单的判断和组合，而我们现在的绝大多数应用都是跑在七层的HTTP/HTTPS协议上的，有更多的高级路由条件，比如主机名、URI、请求头、证书等等，而这些在TCP/IP网络栈里是根本看不见的。

**不过除了七层负载均衡，Ingress对象还应该承担更多的职责，也就是作为流量的总入口，统管集群的进出口数据**，“扇入”“扇出”流量（也就是我们常说的“南北向”），让外部用户能够安全、顺畅、便捷地访问内部服务。

![[e6ce31b027ba2a8d94cdc553a2c97255.png]]

Ingress可以说是在七层上另一种形式的Service，它同样会代理一些后端的Pod，也有一些路由规则来定义流量应该如何分配、转发，只不过这些规则都使用的是HTTP/HTTPS协议。

你应该知道，Service本身是没有服务能力的，它只是一些iptables规则， **真正配置、应用这些规则的实际上是节点里的kube-proxy组件**。如果没有kube-proxy，Service定义得再完善也没有用。

同样的，Ingress也只是一些HTTP路由规则的集合，相当于一份静态的描述文件，真正要把这些规则在集群里实施运行，还需要有另外一个东西，这就是 `Ingress Controller`，它的作用就相当于Service的kube-proxy，能够读取、应用Ingress规则，处理、调度流量。

![[ebebd12312fa5e6eb1ea90c930bd5ef8.png]]

但随着Ingress在实践中的大量应用，很多用户发现这种用法会带来一些问题，比如：

- 由于某些原因，项目组需要引入不同的Ingress Controller，但Kubernetes不允许这样做；
- Ingress规则太多，都交给一个Ingress Controller处理会让它不堪重负；
- 多个Ingress对象没有很好的逻辑分组方式，管理和维护成本很高；
- 集群里有不同的租户，他们对Ingress的需求差异很大甚至有冲突，无法部署在同一个Ingress Controller上。

所以，Kubernetes就又提出了一个 `Ingress Class` 的概念，让它插在Ingress和Ingress Controller中间，作为流量规则和控制器的协调人，解除了Ingress和Ingress Controller的强绑定关系。

![[8843704c6314706c9b6f4f2399ca940e.jpg]]

Ingress同样可以通过命令创建YAML示例

```bash
export out="--dry-run=client -o yaml"
kubectl create ing ngx-ing --rule="ngx.test/=ngx-svc:80" --class=ngx-ink $out
```

```bash
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ngx-ing

spec:

  ingressClassName: ngx-ink

  rules:
  - host: ngx.test
    http:
      paths:
      - path: /
        pathType: Exact
        backend:
          service:
            name: ngx-svc
            port:
              number: 80
```

```bash
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: ngx-ink

spec:
  controller: nginx.org/ingress-controller
```

![[6bd934a9c8c81a9f194d2d90ede172af.jpg]]

在创建创建完成ingress和ingressClass之后可以通过get命令获取创建的信息

```bash
kubectl get ingressclass
kubectl get ing
```

![[bb7a911e10c103fb839e01438e184914.jpg]]

1. Service是四层负载均衡，能力有限，所以就出现了Ingress，它基于HTTP/HTTPS协议定义路由规则。
2. Ingress只是规则的集合，自身不具备流量管理能力，需要Ingress Controller应用Ingress规则才能真正发挥作用。
3. Ingress Class解耦了Ingress和Ingress Controller，我们应当使用Ingress Class来管理Ingress资源。
4. 最流行的Ingress Controller是Nginx Ingress Controller，它基于经典反向代理软件Nginx。

![[6c051e3c12db763851b1yya34a90c67c.jpg]]


[[PersistentVolume让Pod拥有一个真正的持久化存储]]

### PersistentVolume 让Pod拥有一个真正的持久化存储

Kubernetes顺着Volume的概念，延伸出了 **PersistentVolume** 对象，它专门用来表示持久存储设备，但隐藏了存储的底层实现，我们只需要知道它能安全可靠地保管数据就可以了（由于PersistentVolume这个词很长，一般都把它简称为PV）。

PV属于集群的系统资源，是和Node平级的一种对象，Pod对它没有管理权，只有使用权。

#### PersistentVolumeClaim/StorageClass

这么多种存储设备，有的速度快，有的速度慢；有的可以共享读写，有的只能独占读写；有的容量小，只有几百MB，有的容量大到TB、PB级别……，只用一个PV对象来管理还是有点太勉强了，不符合“单一职责”的原则，让Pod直接去选择PV也很不灵活。于是Kubernetes就又增加了两个新对象， **PersistentVolumeClaim** 和 **StorageClass**，用的还是“中间层”的思想，把存储卷的分配管理过程再次细化。

PersistentVolumeClaim，简称PVC，从名字上看比较好理解，就是用来向Kubernetes申请存储资源的。PVC是给Pod使用的对象，它相当于是Pod的代理，代表Pod向系统申请PV。一旦资源申请成功，Kubernetes就会把PV和PVC关联在一起，这个动作叫做“ **绑定**”（bind）。

系统里的存储资源非常多，如果要PVC去直接遍历查找合适的PV也很麻烦，所以就要用到StorageClass。

![[a4d709808a0ef729604c884c50748bd8.jpg]]

.nfs 挂载的关系
![[2a21d16b028afdea4f525439bd8f06a7.jpg]]

.带Provisioner的pvc
![[e3905990be6fb8739fb51a4ab9856f1e.jpg]]

### StatefulSet 管理有状态应用

- Stateless Application
- Stateful Application

无状态应用： nginx

有状态应用：Redis, Mysql

Deployment加上PersistentVolume可以解决单个应用的无状态问题，但是多个应用之间存在依赖关系时就无能为力了。所以，Kubernetes就在Deployment的基础之上定义了一个新的API对象，名字也很好理解，就叫StatefulSet，专门用来管理有状态的应用。

```yaml
# apps 属于那个组
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: xxx-sts
```

StatefulSet也相当于一个Deployment的特例，不能能使用kubectl create创建样板文件，同样也需要参考Deployment的样板进行修改。

YAML文件里除了 `kind` 必须是“ **StatefulSet**”，在 `spec` 里还多出了一个“ **serviceName**”字段，其余的部分和Deployment是一模一样的，比如 `replicas`、 `selector`、 `template` 等等。

StatefulSet创建的pod使用应用编号来保证应用的顺序，而且所有创建的Pod的hostname是和pod的编号name是相同的。

![[image-2024-12-20-09-17-11-555.png]]

有了hostname在编写对应Service之后，Service会按照对应Pod名来管理对应的Pod节点，Service会发现这些Pod不是一般的应用，而是有状态应用，需要有稳定的网络标识，所以就会为Pod再多创建出一个新的域名，格式是“ **Pod名.服务名.名字空间.svc.cluster.local**”。当然，这个域名也可以简写成“ **Pod名.服务名**”。

Service原本的目的是负载均衡，应该由它在Pod前面来转发流量，但是对StatefulSet来说，这项功能反而是不必要的，因为Pod已经有了稳定的域名，外界访问服务就不应该再通过Service这一层了。所以，从安全和节约系统资源的角度考虑， **我们可以在Service里添加一个字段 `clusterIP: None` ，告诉Kubernetes不必再为这个对象分配IP地址**。

![[490d814cf0f25db56537a20f3af57e22.jpg]]

.结合持久化卷和StatefulSet
![[1a06987c87f3db948b591883a81bac0f.jpg]]

### 应用的平滑升级

kubectl简单升级使用kubectl apply滚动升级可以使用kubectl rollout命令来实现应用无感知的应用升级和降级。

当使用apply升级应用之后，使用 `kubectl rollout status deployment ngx-dep` 来查看应用升级的过程。

```bash
kubectl rollout status deployment/nginx
kubectl rollout history deployment/nginx
# 回滚上次的操作
kubectl rollout undo deployment/nginx
# 回滚到指定版本
kubectl rollout undo deployment/nginx --to-revision=1
kubectl rollout pause deployment/nginx
kubectl rollout resume deployment/nginx
```

在应用更新的过程中，你可以随时使用 `kubectl rollout pause` 来暂停更新，检查、修改Pod，或者测试验证，如果确认没问题，再用 `kubectl rollout resume` 来继续更新。

仔细查看 `kubectl rollout status` 的输出信息，你可以发现，Kubernetes不是把旧Pod全部销毁再一次性创建出新Pod，而是在逐个地创建新Pod，同时也在销毁旧Pod，保证系统里始终有足够数量的Pod在运行，不会有“空窗期”中断服务。

新Pod数量增加的过程有点像是“滚雪球”，从零开始，越滚越大，所以这就是所谓的“ **滚动更新**”（rolling update）

 **`annotations` 就是包装盒里的产品说明书，而 `labels` 是包装盒外的标签贴纸**。

*为升级添加注释*

```bash
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ngx-dep
  # 添加字段到升级的CHANGE-CAUSE
  annotations:
    kubernetes.io/change-cause: v1, ngx=1.21
...
```


通过修改yaml文件中的image进行滚动升级

```bash
$ kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
deployment "nginx-deployment" image updated

$ kubectl get pods
NAME                                READY     STATUS              RESTARTS   AGE
nginx-deployment-58b94fcb9-8fjm6    0/1       ContainerCreating   0          52s
nginx-deployment-58b94fcb9-qzlwx    0/1       ContainerCreating   0          51s
nginx-deployment-6d8f46cfb7-5f9qm   1/1       Running             0          45m
nginx-deployment-6d8f46cfb7-7xs6z   0/1       Terminating         0          2m
nginx-deployment-6d8f46cfb7-9ppb8   1/1       Running             0          45m
nginx-deployment-6d8f46cfb7-nfmsw   1/1       Running             0          45m
```

修改备机数量进行扩展

```bash
$ kubectl scale deployments/nginx-deployment --replicas=4
deployment "nginx-deployment" scaled
# 升级之后如果应用发现异常，可以对应用进行回滚
$ kubectl rollout undo deployment/nginx-deployment
deployment "nginx-deployment"
```


### Pod的探测

1. 资源限制， spec.containers.resources.[limits,requests]
2. 使用探针，检测Pod运行状态
    - Startup，启动探针
    - Liveness，存活探针
    - Readiness，就绪探针






## 使用命名空间分割系统资源

- 创建命名空间

```bash
kubectl create ns test-ns
kubectl get ns
# 删除命名空间
kubectl delete ns test-ns
```

- 将Pod放入到指定的命名空间

如果想将一个Pod放入到指定命令空间，需要再Metadata中添加namespace字段指定对应的命名空间。

```bash
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: test-ns
spec:
  containers:
  - name: nginx
    image: nginx
    ports:
    - containerPort: 80
```

> 有命名空间的Pod直接使用 `kubectl get pod` 是查看不到的，需要指定具体的命名空间才能查看 `kubectl get pod -n test-ns`

指定命名空间之后，命名空间里面的所有资源都是从属于命名空间的，因此一旦删除命名空间，从属的对象也会跟着一起消失。因此执行 `kubectl delete ns test-ns` 需要特别的慎重。

### 使用命名空间给资源进行配额

有了名字空间，我们就可以像管理容器一样，给名字空间设定配额，把整个集群的计算资源分割成不同的大小，按需分配给团队或项目使用。

不过集群和单机不一样，除了限制最基本的CPU和内存，还必须限制各种对象的数量，否则对象之间也会互相挤占资源。

**名字空间的资源配额需要使用一个专门的API对象，叫做 `ResourceQuota`，简称是 `quota`**，我们可以使用命令 `kubectl create` 创建一个它的样板文件：

.创建样板
```bash
export out="--dry-run=client -o yaml"
kubectl create quota -n test-ns quota-test --hard=cpu=1,memory=1Gi $out
```

.生成的样板
```bash
apiVersion: v1
kind: ResourceQuota
metadata:
  creationTimestamp: null
  name: quota-test
  namespace: test-ns
spec:
  # 硬性全局设置，也可以只显示某些类型的对象
  hard:
    cpu: "1"
    memory: 1Gi
status: {}
```

```bash
kubectl create quota -n test-ns quota-test --hard=cpu=1,memory=1Gi
# 查看资源配额
kubectl describe quota -n test-ns quota-test
# 删除资源配额
kubectl delete quota -n test-ns quota-test
```

按照命名空间加了限制之后，创建一些没有资源限制的Pod会失败，为了解决这些问题，kubernetes提供了一个新的API对象LimitRange，简称limits，这个就相当于我们应用的默认配置，当你创建的Pod等应用没有指定具体资源限额的时候就按照这些默认的进行创建。

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: dev-limits
  namespace: dev-ns

spec:
  # 以下是对每个节点单独的限制设置
  limits:
  - type: Container
    defaultRequest:
      # 0.2个CPU
      cpu: 200m
      memory: 50Mi
    default:
      cpu: 500m
      memory: 100Mi
  - type: Pod
    max:
      cpu: 800m
      memory: 200Mi
```

## 系统监控

### Metrics Server

如果你对Linux系统有所了解的话，也许知道有一个命令 `top` 能够实时显示当前系统的CPU和内存利用率，它是性能分析和调优的基本工具，非常有用。 **Kubernetes也提供了类似的命令，就是 `kubectl top`，不过默认情况下这个命令不会生效，必须要安装一个插件Metrics Server才可以。**

借助Metrics Server，kubernetes实现了**HorizontalPodAutoscaler** 简称HPA。


### Prometheus

![[e62cebb3acc995246f203d698dfdc964.png]]

## 网络模型

.Docker的网络模型
![[0b7954a362b9e04db8b588fbed5b7185.jpg]]

Docker会创建一个名字叫“docker0”的网桥，默认是私有网段“172.17.0.0/16”。每个容器都会创建一个虚拟网卡对（veth pair），两个虚拟网卡分别“插”在容器和网桥上，这样容器之间就可以互联互通了。

Docker的网络方案简单有效，但问题是它只局限在单机环境里工作，跨主机通信非常困难（需要做端口映射和网络地址转换）。

针对Docker的网络缺陷，Kubernetes提出了一个自己的网络模型“ **IP-per-pod**”，能够很好地适应集群系统的网络需求，它有下面的这4点基本假设：

- 集群里的每个Pod都会有唯一的一个IP地址。
- Pod里的所有容器共享这个IP地址。
- 集群里的所有Pod都属于同一个网段。
- Pod直接可以基于IP地址直接访问另一个Pod，不需要做麻烦的网络地址转换（NAT）。

.kubernetes网络模型
![[81d67c2f0a6e97b847c306c16048c06c.jpg]]

因为Pod都具有独立的IP地址，相当于一台虚拟机，而且直连互通，也就可以很容易地实施域名解析、负载均衡、服务发现等工作，以前的运维经验都能够直接使用，对应用的管理和迁移都非常友好。

Kubernetes定义的这个网络模型很完美，但要把这个模型落地实现就不那么容易了。所以Kubernetes就专门制定了一个标准： **CNI**（Container Networking Interface）。

依据实现技术的不同，CNI插件可以大致上分成“ **Overlay**”“ **Route**”和“ **Underlay**”三种。

**Overlay** 的原意是“覆盖”，是指它构建了一个工作在真实底层网络之上的“逻辑网络”，把原始的Pod网络数据封包，再通过下层网络发送出去，到了目的地再拆包。因为这个特点，它对底层网络的要求低，适应性强，缺点就是有额外的传输成本，性能较低。

**Route** 也是在底层网络之上工作，但它没有封包和拆包，而是使用系统内置的路由功能来实现Pod跨主机通信。它的好处是性能高，不过对底层网络的依赖性比较强，如果底层不支持就没办法工作了。

**Underlay** 就是直接用底层网络来实现CNI，也就是说Pod和宿主机都在一个网络里，Pod和宿主机是平等的。它对底层的硬件和网络的依赖性是最强的，因而不够灵活，但性能最高。


.网桥管理工具 brctl
****
`brctl` 是一个用于在 Linux 系统上管理和配置以太网桥（Ethernet bridge）的命令行工具。它允许你创建、删除和管理网络桥接接口，这些接口可以将多个物理或虚拟网络接口连接在一起，使它们像一个单一的网络段一样工作。这对于虚拟化环境（如 KVM、Xen）、容器网络（如 Docker 的自定义网络模式）以及某些类型的网络测试和诊断非常有用。


1. 显示现有桥接
要查看当前系统上的所有桥接及其连接的端口，可以使用以下命令：

```bash
brctl show
```

这将列出所有现有的桥接设备，并显示每个桥接所关联的物理或虚拟网络接口（端口）。

2. 创建新桥接
要创建一个新的桥接设备，可以使用 `addbr` 子命令：

```bash
brctl addbr <bridge_name>
```

例如，创建一个名为 `br0` 的桥接：

```bash
brctl addbr br0
```

3. 删除桥接
要删除一个现有的桥接设备，可以使用 `delbr` 子命令：

```bash
brctl delbr <bridge_name>
```

例如，删除名为 `br0` 的桥接：

```bash
brctl delbr br0
```

4. 添加端口到桥接
要将一个网络接口添加到桥接中，可以使用 `addif` 子命令：

```bash
brctl addif <bridge_name> <interface_name>
```

例如，将 `eth0` 接口添加到 `br0` 桥接：

```bash
brctl addif br0 eth0
```

5. 从桥接中删除端口
要从桥接中移除一个网络接口，可以使用 `delif` 子命令：

```bash
brctl delif <bridge_name> <interface_name>
```

例如，从 `br0` 桥接中移除 `eth0` 接口：

```bash
brctl delif br0 eth0
```

6. 设置桥接参数
`brctl` 还允许你设置一些桥接的参数，如转发延迟（forward delay）、Hello 时间（hello time）、最大年龄（max age）等。这些参数通常用于优化桥接的性能和行为。例如，设置 `br0` 的转发延迟为 0 秒：

```bash
brctl setfd br0 0
```
****

### calico 网络

.calico 网络不经过网桥，直接跳到目的网络
![[yyb9c0ee93730542ebb5475a734991c7.jpg]]

Calico支持Route模式，它不使用cni0网桥，而是创建路由规则，把数据包直接发送到目标网卡，所以性能高。

### 什么是Containerd

kubernetes想踢出Docker， 引入了标准接口：CRI ，Container Runtime Interface，CRI采用了ProtoBuffer和gPRC，规定kubelet该如何调用容器运行时去管理容器和镜像，但这是一套全新的接口，和之前的Docker调用完全不兼容。

这个时候Docker已经非常成熟，而且市场的惯性也非常强大，各大云厂商不可能一下子就把Docker全部替换掉。所以Kubernetes也只能同时提供 **一个“折中”方案，在kubelet和Docker中间加入一个“适配器”，把Docker的接口转换成符合CRI标准的接口** https://kubernetes.io/blog/2016/12/container-runtime-interface-cri-in-kubernetes/[图片来源]：

![[11e3de04b296248711455f22ce5578ef.png]]

面对Docker也没有“坐以待毙”，而是采取了“断臂求生”的策略，推动自身的重构， **把原本单体架构的Docker Engine拆分成了多个模块，其中的Docker daemon部分就捐献给了CNCF，形成了containerd**。

containerd作为CNCF的托管项目，自然是要符合CRI标准的。但Docker出于自己诸多原因的考虑，它只是在Docker Engine里调用了containerd，外部的接口仍然保持不变，也就是说还不与CRI兼容。

由于Docker的“固执己见”，这时Kubernetes里就出现了两种调用链：

- 第一种是用CRI接口调用dockershim，然后dockershim调用Docker，Docker再走containerd去操作容器。
- 第二种是用CRI接口直接调用containerd去操作容器。

![[a8abfe5a55d0fa8b383867cc6062089b.png]]

![[970a234bd610b55340505dac74b026e8.png]]

完全采用containerd作为容器之后，就不能使用dokcer ps来查看容器信息了，需要改用crictl命令，不过和docker ps images一样，这些命令在crictl中一样可以使用。


### 资源配额管理(Resource Quotas)

如果一个Kubernetes集群被多个用户或者多个团队共享， 就需要考虑资源公平使用的问题， 因为某个用户可能会使用超过基于公平原则分配给其的资源量。

Resource Quotas就是解决这个问题的工具。 通过ResourceQuota对象， 我们可以定义资源配额， 这个资源配额可以为每个命名空间都提供一个总体的资源使用限制： 它可以限制命名空间中某种类型的对象的总数量上限， 也可以设置命名空间中Pod可以使用的计算资源的总上限。

资源配额可以通过在kube-apiserver的--admission-control参数值中添加ResourceQuota参数进行开启。 如果在某个命名空间的定义中存在ResourceQuota， 那么对于该命名空间而言， 资源配额就是开启的。一个命名空间可以有多个ResourceQuota配置项。

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: example-resourcequota
  namespace: my-namespace  # 指定命名空间
spec:
  hard:
    # 计算资源限制
    requests.cpu: "2"       # 所有 Pod 的 CPU 请求总和不能超过 2 个 CPU
    requests.memory: "4Gi"  # 所有 Pod 的内存请求总和不能超过 4Gi
    limits.cpu: "4"         # 所有 Pod 的 CPU 限制总和不能超过 4 个 CPU
    limits.memory: "8Gi"    # 所有 Pod 的内存限制总和不能超过 8Gi

    # 对象数量限制
    pods: "10"              # 命名空间中最多允许 10 个 Pod
    services: "5"           # 命名空间中最多允许 5 个 Service
    configmaps: "10"        # 命名空间中最多允许 10 个 ConfigMap
    persistentvolumeclaims: "4"  # 命名空间中最多允许 4 个 PVC
    secrets: "10"           # 命名空间中最多允许 10 个 Secret
```


## 边车模式
所谓的边车模式，对应于我们生活中熟知的边三轮摩托车。也就是说，我们可以通过给一个摩托车加上一个边车的方式来扩展现有的服务和功能。这样可以很容易地做到 " 控制 " 和 "逻辑 " 的分离。

也就是说，我们不需要在服务中实现控制面上的东西，如监视、日志记录、限流、熔断、服务注册、协议适配转换等这些属于控制面上的东西，而只需要专注地做好和业务逻辑相关的代码，然后，由“边车”来实现这些与业务逻辑没有关系的控制功能。

具体来说，你可以理解为，边车就有点像一个服务的 Agent，这个服务所有对外的进出通讯都通过这个 Agent 来完成。这样，我们就可以在这个 Agent 上做很多文章了。但是，我们需要保证的是，这个 Agent 要和应用程序一起创建，一起停用。

边车模式有时候也叫搭档模式，或是伴侣模式，或是跟班模式。就像我们在《编程范式游记》中看到的那样，编程的本质就是将控制和逻辑分离和解耦，而边车模式也是异曲同工，同样是让我们在分布式架构中做到逻辑和控制分离。

对于监视、日志、限流、熔断、服务注册、协议转换等等这些功能，其实都是大同小异，甚至是完全可以做成标准化的组件和模块的。一般来说，我们有两种方式：
- 一种是通过 SDK、Lib 或 Framework 软件包方式，在开发时与真实的应用服务集成起来。
- 另一种是通过像 Sidecar 这样的方式，在运维时与真实的应用服务集成起来。
以软件包的方式可以和应用密切集成，有利于资源的利用和应用的性能，但是对应用有侵入，而且受应用的编程语言和技术限制。同时，当软件包升级的时候，需要重新编译并重新发布应用。

以 Sidecar 的方式，对应用服务没有侵入性，并且不用受到应用服务的语言和技术的限制，而且可以做到控制和逻辑的分开升级和部署。但是，这样一来，增加了每个应用服务的依赖性，也增加了应用的延迟，并且也会大大增加管理、托管、部署的复杂度。

### 边车模式重点
1. 控制和逻辑的分离。
2. 服务调用中上下文的问题
我们知道，熔断、路由、服务发现、计量、流控、监视、重试、幂等、鉴权等控制面上的功能，以及其相关的配置更新，本质来上来说，和服务的关系并不大。


Sidecar 边车模式，这是一个非常不错的分布式架构的设计模式。因为这个模式可以有效地分离系统控制和业务逻辑，并且可以让整个系统架构在控制面上可以集中管理，可以显著地提高分布式系统的整体控制和管理效率，并且可以让业务开发更快速。

## 什么是 Service Mesh
这就是 CNCF（Cloud Native Computing Foundation，云原生计算基金会）目前主力推动的新一代的微服务架构——Service Mesh 服务网格。

Service Mesh 这个服务网络专注于处理服务和服务间的通讯。其主要负责构造一个稳定可靠的服务通讯的基础设施，并让整个架构更为的先进和 Cloud Native。在工程中，Service Mesh 基本来说是一组轻量级的服务代理和应用逻辑的服务在一起，并且对于应用服务是透明的

说白了就是以下几个特点：
- Service Mesh 是一个基础设施。
- Service Mesh 是一个轻量的服务通讯的网络代理。
- Service Mesh 对于应用服务来说是透明无侵入的。
- Service Mesh 用于解耦和分离分布式系统架构中控制层面上的东西

Service Mesh 就像是网络七层模型中的第四层 TCP 协议。其把底层的那些非常难控制的网络通讯方面的控制面的东西都管了（比如：丢包重传、拥塞控制、流量控制），而更为上面的应用层的协议，只需要关心自己业务应用层上的事了。如 HTTP 的 HTML 协议。

[pattern_service_mesh](https://philcalcado.com/2017/08/03/pattern_service_mesh.html)这篇文章说明了Service Mesh的出现并不是一个偶然，而是一个必然，其演化路径如下：

1. 一开始两台主机之间直接通信
2. 然后分离出来网络层，服务间的远程通信，铜鼓底层网络模型完成
3. 再然后因为两边的服务在接收的速度上不一致，所以需要应用层中实现流控
4. 再后来，流控模块基本交给网络层实现，于是TCP/IP就成为世界上最成功的网络协议
5. 再接着，我们知道了分布式系统中的8个谬论 [# Fallacies of distributed computing](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing)，意思到分布式系统需要弹力设计，于是我们在更上层加入了像限流、熔断、服务发现、监控等功能。
6. 然后，我们发现这些弹力设计的模式都是可以标准化的。将这些模式写成SDK/Lib/Framework，这样就可以在开发层面上很容易地集成到我们的应用服务中。
7. 接下来，我们发现，SDK、Lib、Framework 不能跨编程语言。有什么改动后，要重新编译重新发布服务，太不方便了。应该有一个专门的层来干这事，于是出现了 Sidecar。
![[Pasted image 20250430201106.png]]
8. 然后呢，Sidecar 集群就成了 Service Mesh。图中的绿色模块是真实的业务应用服务，蓝色模块则是 Sidecar，其组成了一个网格。而我们的应用服务完全独立自包含，只需要和本机的 Sidecar 依赖，剩下的事全交给了 Sidecar。
![[Pasted image 20250430201154.png]]
9. 于是 Sidecar 组成了一个平台，一个 Cloud Native 的服务流量调度的平台（你是否还记得我在《分布式系统的本质》那一系列文章中所说的关键技术中的流量调度和应用监控，其都可以通过 Service Mesh 这个平台来完成）。
![[Pasted image 20250430201223.png]]

加上对整个集群的管理控制面板，就成了我们整个的 Service Mesh 架构。
![[Pasted image 20250430201322.png]]

![[Pasted image 20250430201347.png]]

### Service Mesh 相关的开源软件
目前比较流行的 Service Mesh 开源软件是 Istio 和 Linkerd，它们都可以在 Kubernetes中集成。当然，还有一个新成员 Conduit，它是由 Linkerd 的作者出来自己搞的，由 Rust和 Go 写成的。Rust 负责数据层面，Go 负责控制面。号称吸取了很多 Linkerd 的 Scala的教训，比 Linkerd 更快，还轻，更简单

lstio 是目前最主流的解决方案，其架构并不复杂，其核心的 Sidecar 被叫做 Envoy（使者），用来协调服务网格中所有服务的出入站流量，并提供服务发现、负载均衡、限流熔断等能力，还可以收集大量与流量相关的性能指标。

在 Service Mesh 控制面上，有一个叫 Mixer 的收集器，用来从 Envoy 收集相关的被监控到的流量特征和性能指标。然后，通过 Pilot 的控制器将相关的规则发送到 Envoy 中，让Envoy 应用新的

![[Pasted image 20250430202042.png]]

[envoy](https://xie.infoq.cn/article/bde4623c16cebde3a86fe49bb)

### Service Mesh 的设计重点
我们知道，像 Kubernetes 和 Docker 也是分布式系统管理面上的技术解决方案，它们一样对于应用程序是透明的。最重要的是，Kubernetes 和 Docker 对于应用服务的干扰是比较少的。也就是说，Kubernetes 和 Docker 的服务进程的失败不会导致应用服务的异常运行。然后，Service Mesh 则不是，因为其调度了流量，所以，如果 Service Mesh 有bug，或是 Sidecar 的组件不可用，就会导致整个架构出现致命的问题。

所以，在设计 Service Mesh 的时候，我们需要小心考虑，如果 Service Mesh 所管理的Sidecar 出了问题，那应该怎么办？所以，Service Mesh 这个网格一定要是高可靠的，或者是出现了故障有 workaround 的方式。一种比较好的方式是，除了在本机有 Sidecar，我们还可以部署一下稍微集中一点的 Sidecar——比如为某个服务集群部署一个集中式的Sidecar。一旦本机的有问题，可以走集中的
这样一来，Sidecar 本来就是用来调度流量的，而且其粒度可以细到每个服务的实例，可以粗到一组服务，还可以粗到整体接入。这看来看去都像是一个 Gateway 的事。所以，我相信，使用 Gateway 来干这个事应该是最合适不过的了。这样，我们的 Service Mesh 的想像空间一下子就大多了
Service Mesh 不像 Sidecar 需要和 Service 一起打包一起部署，Service Mesh 完全独立部署。这样一来，Service Mesh 就成了一个基础设施，就像一个 PaaS 平台。

![[Pasted image 20250430202140.png]]


k8s中yaml配置所有能用的字段都定义在 `k8s.io/api/core/v1/types.go` 文件中，如果哪个字段不明白具体使用方法可以进行查看。


## 文章

[How to Monitor Kubernetes](https://sysdig.com/blog/monitoring-kubernetes/)
[Logging in Kubernetes with Fluentd and Elasticsearch](https://www.dasblinkenlichten.com/logging-in-kubernetes-with-fluentd-and-elasticsearch/)
[Kubernetes Monitoring: Best Practices, Methods, and Existing Solutions](https://dzone.com/articles/kubernetes-monitoring-best-practices-methods-and-e)
[# Kubernetes 101 – Networking](https://www.dasblinkenlichten.com/kubernetes-101-networking/)
[# Kubernetes networking 101 – Pods](https://www.dasblinkenlichten.com/kubernetes-networking-101-pods/)
[# Kubernetes networking 101 – Services](https://www.dasblinkenlichten.com/kubernetes-networking-101-services/)
[# Kubernetes networking 101 – (Basic) External access into the cluster](https://www.dasblinkenlichten.com/kubernetes-networking-101-basic-external-access-into-the-cluster/)
[# Kubernetes Networking 101 – Ingress resources](https://www.dasblinkenlichten.com/kubernetes-networking-101-ingress-resources/)
[# Getting started with Calico on Kubernetes](https://www.dasblinkenlichten.com/getting-started-with-calico-on-kubernetes/)
[借助 GKE 实现现代 CI/CD：应用开发者工作流](https://cloud.google.com/kubernetes-engine/docs/tutorials/modern-cicd-gke-developer-workflow?hl=zh-cn#kubernetes_architecture)
[**[continuous-deployment-on-kubernetes](https://github.com/GoogleCloudPlatform/continuous-deployment-on-kubernetes)**](https://github.com/GoogleCloudPlatform/continuous-deployment-on-kubernetes)
[# Kubernetes Best Practices  Kubernetes 最佳实践](https://sachinarote.medium.com/kubernetes-best-practices-9b1435a4cb53)
[kubernetes-best-practices](https://speakerdeck.com/thesandlord/kubernetes-best-practices?slide=1)
[awesome-kubernetes](https://github.com/ramitsurana/awesome-kubernetes)
