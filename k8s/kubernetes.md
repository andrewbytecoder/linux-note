

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


## 容器编排
[[容器编排]]

.容器类型说明
![[napkin-selection.png]]

![[f429ca7114eebf140632409f3fbcbb05.png]]

和docker中不太一样，kubernetes中有自己的子网，因此进行网络访问相对来说复杂一点。 想要访问kubernetes中的的子模块一般需要进行端口映射， `kubectl port-forward pod-name 8080:80 &`

minikube中能通过 `minikube dashboard` 来使用界面查看kubernetes的运行状况。

## Deployment 应用永不宕机

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

## Daemonset 忠实可靠的看门狗

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

## Service：微服务架构的应对之道

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


## 服务发现

Kubernetes 通过以下方式来实现服务发现（ Service discovery）。

- DNS（推荐）
- 环境变量（绝对不推荐）

基于 DNS 的服务发现需要 DNS 集群插件（ cluster-add-on） 它其实就是 Kubernetes的 DNS 原生服务的另一种说法。在其内部实现了以下功能。

- 运行 DNS 服务的控制层 Pod。
- 一个面向所有 Pod 的名为 kube-dns 的服务。
- Kubelet 为每一个容器都注入了该 DNS（通过/etc/resolv.conf）

这个 DNS 插件会持续监测 API Server 中新 Service 的动向，并且自动注册到 DNS 中。因此，每一个 Service 都有一个可以在整个集群范围内都能解析的 DNS 名称。另一种实现服务发现的方式是借助环境变量。每一个 Pod 中都有能够解析集群中所有Service 的一组环境变量。不过，这种方式极其受限，仅仅在不使用集群中的 DNS 服务时才会被考虑。

关于环境变量方式的最大问题在于，环境变量只有在 Pod 最初创建的时候才会被注入。 这就意味着， Pod 在创建之后是并不知道新 Service 的。这种方式并不理想，也因此更加推荐 DNS 方式。




## Ingress 集群进出口流量的总管(比Service更加细化)
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

## PersistentVolume 让Pod拥有一个真正的持久化存储

Kubernetes顺着Volume的概念，延伸出了 **PersistentVolume** 对象，它专门用来表示持久存储设备，但隐藏了存储的底层实现，我们只需要知道它能安全可靠地保管数据就可以了（由于PersistentVolume这个词很长，一般都把它简称为PV）。

PV属于集群的系统资源，是和Node平级的一种对象，Pod对它没有管理权，只有使用权。

### PersistentVolumeClaim/StorageClass

这么多种存储设备，有的速度快，有的速度慢；有的可以共享读写，有的只能独占读写；有的容量小，只有几百MB，有的容量大到TB、PB级别……，只用一个PV对象来管理还是有点太勉强了，不符合“单一职责”的原则，让Pod直接去选择PV也很不灵活。于是Kubernetes就又增加了两个新对象， **PersistentVolumeClaim** 和 **StorageClass**，用的还是“中间层”的思想，把存储卷的分配管理过程再次细化。

PersistentVolumeClaim，简称PVC，从名字上看比较好理解，就是用来向Kubernetes申请存储资源的。PVC是给Pod使用的对象，它相当于是Pod的代理，代表Pod向系统申请PV。一旦资源申请成功，Kubernetes就会把PV和PVC关联在一起，这个动作叫做“ **绑定**”（bind）。

系统里的存储资源非常多，如果要PVC去直接遍历查找合适的PV也很麻烦，所以就要用到StorageClass。

![[a4d709808a0ef729604c884c50748bd8.jpg]]

.nfs 挂载的关系
![[2a21d16b028afdea4f525439bd8f06a7.jpg]]

.带Provisioner的pvc
![[e3905990be6fb8739fb51a4ab9856f1e.jpg]]

## StatefulSet 管理有状态应用

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

## 应用的平滑升级

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


## Pod的探测

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








