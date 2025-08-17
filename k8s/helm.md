























## 使用说明

### 创建helm工程
执行之后会在当前目录创建一个anvil的子目录，里面是helm的工程文件
```bash
helm create anvil
```

```bash
.
├── charts
├── Chart.yaml
├── templates
│   ├── deployment.yaml
│   ├── _helpers.tpl
│   ├── hpa.yaml
│   ├── ingress.yaml
│   ├── NOTES.txt
│   ├── serviceaccount.yaml
│   ├── service.yaml
│   └── tests
│       └── test-connection.yaml
└── values.yaml

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









