






## 二阶段构建


### 第二阶段构建发布镜像

```dockerfile
# 构建阶段  
FROM golang:1.25.1-alpine AS builder  
  
# 设置工作目录  
WORKDIR /build  
  
# 复制源代码  
COPY . .  
  
# 获取 Git 信息  
RUN GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") && \  
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown") && \  
    GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "none") && \  
    BUILD_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ') && \  
    GO_VERSION=$(go version | awk '{print $3}') && \  
    echo "Git Commit: $GIT_COMMIT" && \  
    echo "Git Branch: $GIT_BRANCH" && \  
    echo "Git Tag: $GIT_TAG" && \  
    echo "Build Time: $BUILD_TIME" && \  
    echo "Go Version: $GO_VERSION" && \  
    CGO_ENABLED=0 GOOS=linux go build \  
      -ldflags="-s -w \  
        -X main.GitCommit=${GIT_COMMIT} \  
        -X main.GitBranch=${GIT_BRANCH} \  
        -X main.GitTag=${GIT_TAG} \  
        -X main.BuildTime=${BUILD_TIME} \  
        -X main.GoVersion=${GO_VERSION}" \  
      -a -installsuffix cgo -o main .  
  
# 运行阶段，最小化镜像  
FROM alpine:V0.0.2  
  
# 可选：设置非 root 用户（提升安全性）  
RUN adduser -D -s /bin/sh nmq-user  
  
RUN mkdir -p /home/nmq-user  
  
# 设置工作目录  
WORKDIR /home/nmq-user  
  
# 从构建阶段复制编译好的二进制文件  
COPY --chmod=757 --from=builder /build/main /home/nmq-user/  
  
# 暴露端口  
EXPOSE 8080  
  
# 更改文件所有者  
RUN chown nmq-user:nmq-user main  
  
# 切换到非 root 用户  
USER nmq-user  
  
# 设置时区  
ENV TZ=Asia/Shanghai  
  
# 启动应用  
CMD ["/home/nmq-user/main"]
```


### 第二阶段将二进制文件从镜像中取出
- 构建脚本
```bash
docker build \  
        --build-arg VERSION="$version" \  
        --build-arg ARCH="amd64" \  
        --build-arg GIT_COMMIT="$GIT_COMMIT" \  
        --build-arg BUILD_TIME="$BUILD_TIME" \  
        --output . \  
        --target export-stage \  
        -t ysp-agent-build \  
        .
```

- 二阶段构建Dockerfile
```dockerfile
# 构建阶段  
FROM golang:1.25.1-alpine AS builder  
  
# 设置工作目录  
WORKDIR /build  
  
# 复制源代码  
COPY .git .git  
COPY . .  
  
# 设置构建参数  
ARG ARCH  
ARG GIT_COMMIT  
ARG GIT_BRANCH  
ARG GIT_TAG  
ARG BUILD_TIME  
  
# 获取 Git 信息  
RUN GO_VERSION=$(go version | awk '{print $3}') && \  
    echo "Git Commit: $GIT_COMMIT" && \  
    echo "Git Branch: $GIT_BRANCH" && \  
    echo "Git Tag: $GIT_TAG" && \  
    echo "Build Time: $BUILD_TIME" && \  
    echo "Go Version: $GO_VERSION" && \  
    CGO_ENABLED=0 GOOS=linux go build \  
      -ldflags="-s -w \  
        -X main.GitCommit=${GIT_COMMIT} \  
        -X main.GitBranch=${GIT_BRANCH} \  
        -X main.BuildTime=${BUILD_TIME} \  
        -X main.GoVersion=${GO_VERSION}" \  
      -a -installsuffix cgo -o main ./cmd/gin/main.go  
  
  
# 阶段 2：导出阶段，仅用于提取二进制文件  
FROM scratch AS export-stage  
  
# 从 builder 阶段复制编译好的二进制文件到当前阶段的根目录  
COPY --from=builder /build/main ./main
```

在执行`docker build`命令的时候，一定要指定 `--target export-stage` 和 `--output .` 否则会编译出一个`-t`指定的镜像，只有指定了`--target export-stage`  才能不产生镜像

scratch 是一个特殊的 Docker 镜像，具体来说：
scratch 是什么：
- 它是 Docker 官方提供的最基础的空白镜像
- 实际上是一个空文件系统，没有任何内容
- 大小几乎为 0 字节
不是标记：
- scratch 不是一个标签（tag），而是一个独立的镜像名称
- 你不能给其他镜像打上 scratch 标签
- 它是 Docker 保留的特殊镜像名
用途：
- 用于创建极简的生产环境镜像
- 适合静态链接的二进制文件（如 Go 程序）
- 可以显著减小最终镜像的体积
--output 参数的作用：
- 这个参数告诉 Docker 不创建镜像，而是将构建结果直接输出到本地文件系统
- `--output .` 表示将结果输出到当前目录
构建结果：
- 使用 `--target export-stage` 指定构建到导出阶段
- 使用 `--output .` 将结果导出到本地
最终在你的项目根目录下会生成一个名为 main 的可执行二进制文件

```bash
# 将结果输出到当前目录 这个参数告诉 Docker 不创建镜像，而是将构建结果直接输出到本地文件系统
--output . 
```

```bash
#!/bin/bash  
  
echo `pwd`  
  
# 获取 Git 信息  
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null) || GIT_COMMIT="unknown"  
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || GIT_BRANCH="unknown"  
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null) || GIT_TAG="none"  
BUILD_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')  
  
docker build \  
          -f `pwd`/manifest/scratch/Dockerfile \  
          --build-arg ARCH="amd64" \  
          --build-arg GIT_COMMIT="$GIT_COMMIT" \  
          --build-arg GIT_BRANCH="$GIT_BRANCH" \  
          --build-arg GIT_TAG="$GIT_TAG" \  
          --build-arg BUILD_TIME="$BUILD_TIME" \  
          --output . \  
          --target export-stage \  
          -t ysp-agent-build \  
          .
```


