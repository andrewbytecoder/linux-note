






## 二阶段构建


### 第二阶段构建发布镜像

```dockerfile
# 构建阶段  
FROM ncp/golang:1.25.1 AS builder  
  
# 设置工作目录  
WORKDIR /app  
  
# 添加dockerfile ignore  
# 复制整个源码（除了 .dockerignore 中排除的）  
COPY . .  
  
# podman build -t ncp:latest -f docker/ncp/Dockerfile .  
RUN git rev-parse HEAD  
# 编译二进制文件（静态链接，避免依赖 libc）  
# CGO_ENABLED=0 表示禁用 CGO，生成纯静态二进制  
# GOOS=linux 明确指定目标操作系统  
RUN CGO_ENABLED=0 GO111MODULE=on GOOS=linux go build  -mod=vendor -a -tags netgo \  
     -ldflags "-X 'github.com/ncp/ncp/version.version=1.0.0' \  
          -X 'github.com/ncp/ncp/version.gitBranch=$(git rev-parse --abbrev-ref HEAD)' \  
          -X 'github.com/ncp/ncp/version.gitTag=$(git describe --tags --abbrev=0)' \  
          -X 'github.com/ncp/ncp/version.gitCommit=$(git rev-parse HEAD)' \  
          -X 'github.com/ncp/ncp/version.gitTreeState=clean' \          -X 'github.com/ncp/ncp/version.buildDate=$(date -u +'%Y-%m-%dT%H:%M:%SZ')'" \  
    -o ncp \  
    ./cmd/ncp/ncp.go  
  
# 最终运行阶段（最小化镜像）  
FROM alpine:latest  
  
# 可选：设置非 root 用户（提升安全性）  
RUN adduser -D -s /bin/sh ncp-user  
  
# 安装必要依赖（如时区数据）  
# RUN apk --no-cache add ca-certificates tzdata  
  
RUN mkdir -p /home/ncp-user  
  
# 设置工作目录  
WORKDIR /home/ncp-user  
  
# 复制编译好的二进制文件  
COPY --chmod=757 --from=builder /app/ncp /home/ncp-user/  
  
# 更改文件所有者  
RUN chown ncp-user:ncp-user ncp  
  
# 切换到非 root 用户  
USER ncp-user  
  
# 启动命令  
CMD ["/home/ncpuser/ncp", "dpproxy"]
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
# 第一阶段：构建阶段  
FROM golang:1.26-alpine AS builder  
  
# 设置工作目录  
WORKDIR /  

# 复制源代码  
COPY . .  
  
# 设置构建参数  
ARG VERSION=1.0.0  
ARG ARCH  
ARG GIT_COMMIT  
ARG BUILD_TIME  
  
# 设置交叉编译环境变量  
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$ARCH  go build  -mod=vendor -ldflags="-w -s -X main.version=$VERSION -X main.gitCommit=$GIT_COMMIT -X main.buildTime=$BUILD_TIME" -o ./agent ./cmd/agent  
  
# 阶段 2：导出阶段，仅用于提取二进制文件  
FROM scratch AS export-stage  
  
# 从 builder 阶段复制编译好的二进制文件到当前阶段的根目录  
COPY --from=builder ./yspagent ./yspagent
```



