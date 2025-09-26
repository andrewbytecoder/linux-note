
## 常用命令


### 创建release实例

```bash
# 使用helm安装一个实例，myconfigmap 是实例名
helm install myconfigmap ./anvil
# 试运行，不进行实际安装，只是将模板内容渲染出来，可以用来检查渲染的模板是否正确
helm install myconfigmap ./anvil --debug -dry-run
# 从本地的char压缩包安装实例
helm install db mysql-1.6.9.tgz
# 从一个网络地址仓库压缩包直接安装release实例
helm install db http://url/mysql-1.6.9.tgz
```

### 删除实例

```bash 
helm uninstall myconfigmap ./anvil
```


### 获取实例

```bash
helm get manifest myconfigmap
```


## 内置对象

### 常见内置对象
- `Release` 对象
- `Value` 对象
- `Chart` 对象
- `Capabilities` 对象
- `Template` 对象


### 各内置对象详解

#### Release 对象 
描述版本发布自身的一些信息

-  `.Release.Name` release的名称
- `.Release.Namespace` release的命名空间
- `.Release.IsUpgrade` 如果当前操作是升级或回滚的话，该值为true
- `.Release.IsInstall` 如果当前操作是安装的话，该值为true
- `.Release.Revision` 获取此次修订的版本号，初次安装时为1，每次升级或回滚都会递增
- `.Release.Service` 获取渲染当前模板的服务名称，一般都是helm

#### Values 对象
描述的value.yaml文件中的内容，默认为空。可以通过 `.Values` 来使用value.yaml中定义的变量数值


#### Chart对象
用于获取chart.yaml文件中的内容
- `.Chart.Name` 获取Chart的名称
- `Chart.Version` 获取Chart的版本


#### Capabilities对象
提供关于k8s集群的相关信息
- `.Capabilities.APIVersions` - 返回k8s集群的API版本信息集合
- `.Capabilities.APIVersions.Has $version` 用于检车指定版本或资源在k8s集群中是否可用，例如： `apps/v1/Deployment`
- `.Capabilities.KubeVersion` 和 `.Capabilities.KubeVersion.Version` 都用于获取k8s的版本号
- `.Capabilities.KubeVersion.Major` 获取k8s的主版本号
- `.Capabilities.KubeVersion.Minor` 获取k8s的小版本号

#### Template对象
用于获取当前模板的信息，有如下两个对象
- `.Template.Name` 用于获取当前模板的名称和路径 (例如： `mychart/templates/mytemplate.yaml`)
- `.Template.BasePath` 用于获取当前模板的路径 (例如： `mychart/templates`)


## 常用命令

- version 查看客户端版本
- repo 添加、列出、移除、更新和索引chart仓库，可用子命令： add、index、list、remove、update
- search 根据关键字搜索chart包
- show 查看chart包的基本信息和详细信息，可用子命令： all、chart、readme、values
- pull 从远程仓库下载拉去chart包并解压到本地，如： `helm pull test-repo/tomcat --version 0.4.3 --untar` , untar是解压，不添加就是下载压缩包
- install 通过cahrt包安装一个release实例
- upgrade 更新一个release实例
- rollback 从之前一个版本回滚release实例，也可指定要回滚的版本号
- uninstall 卸载一个release实例
- history 获取release历史，用法：helm history release实例名
- package 将chart目录打包成chart存档文件中 `helm paclage /ope/helm/work/tomcat`
- get 下载一个release，可以用子命令：all、hooks、manifest、notes，values
- status 显示release实例名的状态，显示已命名版本的状态


### 仓库管理
添加远程仓库
```bash
helm repo add aliyun https://kubernetes.oss-cn-hangzhou.aliyuncs.com/charts
```
删除远程仓库
```bash
helm repo remove aliyun 
```
查看添加的仓库列表
```bash
helm repo list
```

### 安装实例

从加入本地的chart官方仓库直接安装release实例
```bash
helm install tomcat1 stable/tomcat
```

 将chart仓库拉下来安装

```bash
helm install tomcat2 tomcat-0.4.3.tgz 
```

 从一个网址（如http服务器）直接安装release实例
```bash
helm install tomcat3 http://url.../mysql.tgz
```

在本地创建一个chart包通过自定义的yaml文件安装
```bash
helm install tomcat4 tomcat
```

### 创建chart实例

```bash
helm create mychart
```


### 升级实例
指定release名和chart名进行相关set设置的升级
```bash
helm upgrade relase-name chart-name --set imageTag=1.19
```

指定release示例名和chart名和values.yaml文件升级
```bash
helm upgrade relase-name chart-name -f ../mychart/values.yaml
```

### 回滚
指定release实例名，回滚到上一个版本
```bash
helm rollback release-name
```

指定release实例名，回滚到指定版本，注意版本号是release的版本号，不是镜像版本号
```bash
helm rollback relase-name 版本号
```


### 获取release示例历史
```
helm history relase-name
```


## 使用说明

### 创建helm工程
执行之后会在当前目录创建一个anvil的子目录，里面是helm的工程文件
```bash
helm create anvil
```

```bash
.
├── charts   -- 存放子chat的目录，目录里面存放这个chart依赖的所有子chart
├── Chart.yaml -- 保存chat的基本信息，包括名字描述及版本等，这个文件可以被templates目录下的文件所引用
├── templates -- 模板文件目录，包含所有yaml模板文件
│   ├── deployment.yaml 
│   ├── _helpers.tpl  -- 放置模板助手文件，可以在整个chart中重复使用
│   ├── hpa.yaml
│   ├── ingress.yaml
│   ├── NOTES.txt   -- 存放帮助信息，helm install之后会展示给用户
│   ├── serviceaccount.yaml
│   ├── service.yaml
│   └── tests     -- 用于测试的文件，比如部署完chart之后，做个web测试
│       └── test-connection.yaml
└── values.yaml  -- 渲染模板时定义的变量值和变量文件，定义templates目录下的yaml文件可能引用到的变量

4 directories, 10 files
```
- `Chart.yaml` - 文件包含元数据和chart的一些功能控件
- charts - 依赖的chart可以选择保存在charts目录中
- templates - 用于存放生成Kubernetes清单
- `values.yaml` - 当Helm渲染清单时传递给模板的默认值位于values.yaml文件中。实例化chart时，可以覆盖这些值。

### 模版说明
#### 生成配置文件
```yaml
# 将 anvil 工程
helm template anvil
# 如果有错误 可以使用debug输出
helm template anvil --debug
```


#### 默认值
Helm是用Go编程语言编写的，Go包含模板包。Helm利用文本模板包作为模板的基础。此模板语言与其他模板语言类似，包括循环、if/then逻辑、函数等。YAML文件的示例模板如下：
```yaml
# .Values.product 如果存在使用返回的值，如果不存在使用 default的值
# 最后一个quote是函数，用于确保输出的结果包含双引号
product: {{ .Values.product | default "rocket" | quote }}
```
`{{}}` 进入模版逻辑的左括号和右括号
管道从 `.Values.product` 中属性的值开始。这来自呈渲染模板时传入的数据对象。此数据的值作为default函数（Helm提供的函数）的最后一个参数通过管道传递。如果传入的值为空，则default函数使用默认值"rocket"，以确保存在值。然后将其发送到quote函数，该函数确保在将字符串写入模板之前将其用引号括起来。

位于 `.Values.product` 开头的“.”很重要。这被认为是当前作用域中的根对象。.Values是根对象的属性。

#### incluede 模版函数
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "anvil.fullname" . }}
  labels:
    {{- include "anvil.labels" . | nindent 4 }}
```

include模板函数允许将一个模板的输出包含在另一个模板中，include函数的第一个参数是要使用的模板的名称。作为第二个参数传入的“.”是根对象。因为根对象被传入，所以根对象上的属性和函数可以在被调用的模板中使用。
anvil.fullname根据实例化，chart时选择的名称提供名称

```yaml
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "anvil.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "anvil.labels" . | nindent 8 }}
        {{- with .Values.podLabels }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "anvil.serviceAccountName" . }}
      {{- with .Values.podSecurityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          {{- with .Values.securityContext }}
          securityContext:
            {{- toYaml . | nindent 12 }}
          {{- end }}
	      # 容器镜像版本能通过 .Values 上的值确认
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP
          {{- with .Values.livenessProbe }}
          livenessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.readinessProbe }}
          readinessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.volumeMounts }}
          volumeMounts:
            {{- toYaml . | nindent 12 }}
          {{- end }}
      {{- with .Values.volumes }}
      volumes:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

`.Values`上的属性是基于许多因素计算的，默认值基于chart的values.yaml文件，当然也可以使用传入值覆盖(--set、--set-file和--set-string)等

#### 打包
package会将制定的目录打包成发布包
```bash
helm package anvil
```


#### 忽略文件
部分不能打包到发布包里面的数据可以通过 `.helmignore` 文件进行指定
.helmignore文件提供了一个位置来指定要跳过的内容。此文件必须位于chart的最上层

#### 校验char代码
在开发char代码时，可通过linter来校验代码是否正常
```bash
helm lint anvil
```

### 开发模版
模板是Helm chart的核心，它们构成了chart的大部分文件和内容。这些是位于templates目录中的文件。当你运行helm install和helm upgrade等命令时，Helm将渲染模板并将它们发送给Kubernetes。如果使用helm template命令，模板将被渲染并显示为输出（即，发送到标准输出）。

用户可以通过template来实现将模板渲染成yaml到标准输出
```bash
 helm template anvil 
```

#### 动作
逻辑、控制结构和数据计算用{{和}}包装。这些被称为动作（action）。动作之外的任何内容都将被复制到输出。
当花括号用于启动和停止动作时，可以用-来删除前导或尾随空格。
```yaml
{{"Hello" -}},{{- "World"}}
```
生成的输出是“Hello，World”。空格已经从带有-的那一方删除，直到下一个非空格字符为止。在（用于删除空格的）-和动作的其余部分之间需要有一个ASCII空格。例如，{{-12}}的计算结果是-12，因为-被认为是数字的一部分，而不是括号的一部分。
在动作中，你可以利用各种各样的特性，包括管道、if/else语句、循环、变量、子模板和函数。结合使用这些工具提供了编写模板的强大方法。

#### helm传递到模版的信息
传递到模板中的数据对象的属性名以大写字母开头，这是Helm用Go编程语言编写的产物。在Go中，公共属性以大写字母开头，私有属性以小写字母开头。当访问数据对象时，你只需要记住第一个字母是大写的。
比如访问values.yaml中的值，使用 `.Values` 开头，访问chart.yaml中的值以 `.Chart` 开头

不同的Kubernetes集群可以具有不同的功能。这可能取决于你使用的Kubernetes的版本，或者是否安装了CRD。Helm提供了一些关于集群能力的数据作为.Capabilities的属性。


#### 管道
管道是一系列链接在一起的命令、函数和变量。变量的值或函数的输出用作管道中下一个函数的输入。管道的最后一个元素的输出就是管道的输出。下面是一个简单的管道：

```yaml
product: {{ .Values.character | default "Sylvester" | quote }}
```
该管道有三部分，每个部分之间用|隔开。第一部分

是.Values.character，它是character的计算值。这是values.yaml文件或helm install、helm upgrade或helm template渲染chart时传入的值。此值作为最后一个参数传递给default函数。如果该值为空， default将使用值“Sylvester”代替它。default的输出作为一个输入传递给quote，用于将值用引号括起来。quote的输出是从动作返回的

#### 模板函数
在动作和管道中可以使用模板函数。本章前面已经介绍过default和quote函数。函数提供了一种方法，可以将数据转换为需要渲染的格式，或者在不存在数据的情况下生成数据。

大多数函数都是由Helm提供的，在构建chart时非常有用。这些函数包括简单的函数（如用于缩进输出的indent和nindent函数）和复杂的函数（如能够深入集群并获取有关当前资源和资源类型的信息的函数）。helm模版支持的函数可以参考 [spring库](https://github.com/Masterminds/sprig) 

** `-` & `nindent` **
```yaml
{{- toYaml . | nindent 12 }}
```
toYaml函数可将数据转换为YAML，缩进是通过使用两个函数来实现的。在toYaml的左边，`-` 与`{{` 一起使用，以删除前一行中到:为止的所有空格。toYaml的输出被传递给nindent。此函数在接收到的文本的开头添加一个新行，然后缩进每一行。
为了便于阅读，使用nindent代替indent函数。indent函数不会在开头添加换行符。使用nindent可以使securityContext下的YAML位于新行上。这是模板中的另一个常见模式。

> 除了toYaml之外，Helm还有一些函数。例如，toJson和toToml可以将数据分别转换为JSON和TOML。toYaml通常用于创建Kubernetes清单，而toJson和toToml更常用于创建配置文件，它们通过Secret和ConfigMap传递给应用程序。

模版处理函数有100多个可以使用，详情见： [helm函数](https://helm.sh/docs/chart_template_guide/function_list/)

#### 方法
到目前为止，你已经看到了模板函数。Helm还包括检测Kubernetes集群功能的函数和处理文件的方法。

`.Capabilities` 对象具有方法`.Capabilities.APIVersions.Has`，它接受一个参数，此参数为要检查其存在性的`Kubernetes API`或类型。它返回true或false来显示该资源在集群中是否可用。你可以检查组和版本（如batch/v1）或资源类型（如apps/v1/Deployment）。

`.Files` 中也包含一些方法来帮助你使用文件
- `.Files.Get name` - 以字符串形式获取文件路径的名称
- `.Files.GetBytes` - 以字节数组形式返回，类似于Get
- `.Files.Glob` - 接受glob模式并返回另一个files对象，该对象仅包含其名称与该模式匹配的文件。
- `.Files.AsConfig` - 获取一个文件组，并将其作为适合包含在Kubernetes ConfigMap清单的data部分的纯YAML返回。这在与.Files.Glob匹配时非常有用。
- `.Files.AsSecrets` - 类似于.Files.AsConfig.它不返回纯YAML，而是以一种可以包含在Kubernetes Secret清单的data部分的格式返回数据。它是Base64编码的。这在与.Files.Glob匹配时非常有用。例如， {{.Files.Glob("mysecrets/**").AsSecrets}}。

创建 `templates/sercret.yaml`
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "anvil.fullname" . }}
  labels:
    {{- include "anvil.labels" . | nindent 4 }}
type: Opaque
data:
  {{- if .Values.secret.useGlob }}
  {{ (.Files.Glob "config/*").AsSecrets | indent 2 }}
  {{- else }}
  jetpack.ini: {{ .Files.Get "config/jetpack.ini" | b64enc }}
  rocket.yaml: {{ .Files.Get "config/rocket.yaml" | b64enc }}
  {{- end }}
```

```bash
cat anvil/config/jetpack.ini                         
enabled = true
cat anvil/config/rocket.yaml              
enabled = true
```

 ##### `if/else/with`

```yaml
{{- if .Values.ingress.enabled -}}
...
{{- else -}}
# ingress not enabled
{{- end }}
# 使用and 和 or 实现多个条件判断
{{- if and .Values.ingress.enabled .Values.products -}}

{{- end }}
```

##### 变量
在模板中你可以创建自己的变量，并将变量作为参数传递给函数、打印输出等

```yaml
# 使用 := 创建变量，变量一旦创建就不能再次赋值成其他类型的变量，只能用于同类型变量之间的相互赋值 
{{ $var := .Values.character }}
# 变量的使用
character: {{ $var | default "Sylvester" | quete }}
```
在本例中，变量在另一个动作中被更改。变量在模板执行的生命周期内一直存在，并且在模板后面的相同动作或不同动作中可用

##### 循环
```yaml
# 假设 values.yaml 中有以下list 
characters:
  - Syslvester
  - Tweety
  - Road Runner
  - Wile E. Coyote

# 如果想使用range可以用如下方式
characters:
{{- range .Values.characters }}
  - {{ . | quete }}
{{- end }}
```

##### 模板
在 `_helpers.tpl`中会存储大量的用于后期Yaml配置的模板，yaml配置中通过include可引入这些模板
```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "anvil.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "anvil.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "anvil.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "anvil.labels" -}}
helm.sh/chart: {{ include "anvil.chart" . }}
{{ include "anvil.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "anvil.selectorLabels" -}}
app.kubernetes.io/name: {{ include "anvil.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "anvil.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "anvil.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

##### 依赖项目
从提供的文本中，我们可以提取出一系列关于版本范围指定的规则和示例。这些规则主要描述了如何使用特定符号（如`^`和`~`）来定义软件版本的兼容范围。以下是提取的关键信息：

使用`^`符号的规则
- `^1.2.x`等价于`>=1.2.0<2.0.0`：表示任何大于等于1.2.0且小于2.0.0的版本。
- `^2.3`等价于`>=2.3<3`：表示任何大于等于2.3且小于3的版本。
- `^2.x`等价于`>=2.0.0<3`：表示任何大于等于2.0.0且小于3的版本。
- `^0.2.3`等价于`>=0.2.3<0.3.0`：表示任何大于等于0.2.3且小于0.3.0的版本。
- `^0.2`等价于`>=0.2.0<0.3.0`：表示任何大于等于0.2.0且小于0.3.0的版本。
- `^0.0.3`等价于`>=0.0.3<0.0.4`：表示任何大于等于0.0.3且小于0.0.4的版本。
- `^0.0`等价于`>=0.0.0<0.1.0`：表示任何大于等于0.0.0且小于0.1.0的版本。
- `^0`等价于`>=0.0.0<1.0.0`：表示任何大于等于0.0.0且小于1.0.0的版本。

使用`~`符号的规则
- `~用于指定补丁程序范围`：这表明`~`通常用于在主版本或次要版本范围内选择最新的补丁版本。
- `~1.2.3`等价于`>=1.2.3<1.3.0`：表示任何大于等于1.2.3且小于1.3.0的版本，特别强调在1.2.x系列中的最新补丁版本。
- `~1`等价于`>=1<2`：表示任何大于等于1且小于2的版本，在1.x系列中的最新版本。
- `~2.3`等价于`>=2.3<2.4`：表示任何大于等于2.3且小于2.4的版本，在2.3.x系列中的最新补丁版本。
- `~1.2.x`等价于`>=1.2.0<1.3.0`：表示任何大于等于1.2.0且小于1.3.0的版本，在1.2.x系列中的最新补丁版本。
- `~1.x`等价于`>=1<2`：表示任何大于等于1且小于2的版本，在1.x系列中的最新版本。

这些规则和示例展示了如何灵活地使用`^`和`~`符号来精确控制软件依赖的版本范围，这对于确保软件项目的稳定性和兼容性至关重要。

```yaml
dependencies: 
- name: booster 
  version: ^1.0.0 
  condition: booster.enabled
  repository: https://raw.githubusercontent.com/Masterminds/learning-helm/main/chapter6/repository/
```

依赖项详情

- **名称（name）**: `booster`
    - 这是依赖项的标识符，用于在项目中引用该依赖。

- **版本（version）**: `^1.0.0`
    - 这表示对`booster`依赖项的版本要求。使用了caret (^) 版本范围指定符，意味着任何大于等于1.0.0但小于2.0.0的版本都可以满足此依赖要求。例如，1.0.1, 1.1.0, 1.2.3等版本都符合条件，但2.0.0及其以上版本则不被接受。

- **条件（condition）**: `booster.enabled`
    - 这是一个布尔表达式，用于决定是否启用该依赖项。只有当`booster.enabled`为真时，才会加载和使用这个依赖项。这通常用于配置文件中，允许用户根据需要动态地开启或关闭某些功能或组件。

- **仓库（repository）**: `https://raw.githubusercontent.com/Masterminds/learning-helm/main/chapter6/repository/`
    - 这指定了`booster`依赖项的来源位置。它是一个URL，指向GitHub上一个特定项目的资源。具体来说，这是`Masterminds`组织下的`learning-helm`仓库中的`chapter6/repository/`目录。这可能是一个包含Helm图表或其他相关资源的目录，用于构建和部署应用程序。

##### exports属性
chart可以将另外一个chart作为自己的子chart，在子chart中通过 `exports` 可以导出部分配置
```yaml
# example-child/values.yaml 
exports: 
  types: 
    foghorn: rooster
```
在父chart中可以通过 `import-values` 将对应的配置导入
```yaml
# parent-chart/Chart.yaml
apiVersion: v2
name: parent-chart
version: 0.1.0
dependencies:
  - name: example-child
    version: ^1.0.0
    repository: https://charts.example.com/
    import-values:
      - types
```
通过这种方式，你可以轻松地在父 chart 中使用子 chart 导出的值

##### 子-父格式
当子cahrt没有导出值但是父chart想用，可以通过父依赖直接声明就行
```yaml
dependencies:
  - name: example-child
    version: ^1.0.0
    repository: https://charts.example.com/
    import-values:
      - child: types
        parent: characters
```

#### 库chart
在创建多个共享许多相同模板的类似chart。对于这些情况，可以使用库chart。

库chart在概念上类似于软件库。它们提供了可重用的功能，这些功能可以被导入并由其他chart使用，但它们本身不能被安装。
使用helm create创建新的库chart时，第一步是删除templates目录和values.yaml文件，因为二者都不会被使用。然后，你需要告诉Helm这是一个库chart。在Chart。
```yaml
apiVersion: v2
name: mylib
type: library
description: an example library chart
version: 0.1.0
```

在编辑好辅助函数和需要的数据之后，通过 `helm package .` 将模板库进行打包
```yaml
apiVersion: v2 
name: myapp 
version: 0.1.0 
dependencies: 
  - name: mylib 
    version: 0.1.0 
    repository: "file://path/to/mylib"
```



### chart编写常见用法
```yaml
# include 和 template都是去 模板中找数据
metadata:
  labels:
  # include 能返回数据给管道，接着后面的处理
  # . 的意思是将上下文传递给include函数， include函数可以在调用的地方使用当前文件的上下文
    {{- include "kube-state-metrics.labels" . | indent 4 }}
  name: {{ template "kube-state-metrics.fullname" . }}
```
- **`template`**: 只能将模板的输出结果插入到 YAML 文件的**顶层（top level）**。它不能作为管道（pipeline）的一部分，也不能对其输出进行后续处理（如 `indent`）。
- **`include`**: 返回模板的输出作为一个**字符串**，因此它可以被用在管道中，并且可以对其输出进行后续处理（如 `indent`, `quote`, `lower` 等）。**

#### 1. `template` 指令
- **作用**: `template` 是一个“指令”，它的主要目的是将一个命名模板的内容**直接注入**到当前模板的当前位置。
- **限制**: 它**不能**被用在管道中。这意味着你不能对 `template` 的输出进行任何函数处理。
- **适用场景**: 当你只需要简单地插入一个模板的完整输出，且不需要修改其格式时使用

#### 2. `include` 函数
- **作用**: `include` 是一个“函数”，它会**返回**指定模板的渲染结果作为一个字符串。
- **优势**: 因为它返回的是一个字符串，所以这个字符串可以被传递给其他函数进行处理，比如 `indent`, `nindent`, `quote` 等。
- **适用场景**: 当你需要对模板的输出进行格式化（如缩进）或转换时使用