>Quay 部署方式：离线安装（mirror-registry）  
>容器引擎：Podman  
>数据：SQLite  
>操作系统：RHEL 9.4  
>部署时间：2025 年 11 月  
>文档作者： wangleilei


## 1. 环境与规划
| 项目          | 配置值                                        | 说明                       |
| ----------- | ------------------------------------------ | ------------------------ |
| 主机名         | quay62-podman                              | Quay 服务器主机名              |
| IP 地址       | 10.161.43.96                               | 静态 IP                    |
| 访问域名        | quay62.testocpdc2.62dc2.com                | HTTPS 访问域名               |
| 系统版本        | RHEL 9.4                                   | Red Hat Enterprise Linux |
| 安装用户        | root                                       | 安装需 root 权限              |
| 容器运行环境      | Podman 4.x                                 | 无 Docker 依赖              |
| 数据库类型       | SQLite                                     | 单机内嵌数据库，适用于中小规模          |
| 数据根路径       | /var/lib/quay                              | Quay 持久化目录               |
| 存储路径        | /var/lib/quay/datastorage                  | 存放镜像层（blobs）             |
| SQLite 存储路径 | /var/lib/quay/sqlite                       | SQLite 数据库存放处            |
| 访问端口        | 80 / 443 / 8080 / 8443                     | Web 与管理端口                |
| 初始账号        | admin                                      | Quay 管理员                 |
| 初始密码        | admin[@123](https://github.com/123 "@123") | 登录密码                     |
## 系统配置步骤详解
#### 设置主机名与域名解析
确保主机名与域名一致，以便证书匹配

```bash 
1. `sudo hostnamectl set-hostname quay62-podman`
2. `echo "127.0.0.1 quay62-podman" | sudo tee -a /etc/hosts`
3. `echo "10.161.43.96 quay62.testocpdc2.62dc2.com quay62-podman" | sudo tee -a /etc/hosts`
```

### 创建安装与数据目录
```bash
1. `sudo mkdir -p /var/lib/quay`
2. `sudo chown $USER:$USER /var/lib/quay`
3. `mkdir -p ~/quay-install/{cert,podman}`
```
/var/lib/quay/：Quay 核心数据目录

~/quay-install/：安装工具与证书临时路径
### 优化内存参数

Quay 依赖 Redis 与 SQLite 内存缓存，启用内存过量分配可避免 OOM。
1. `echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf`
2. `sudo sysctl -p`


## 3. 安装 Podman
### 安装命令
```bash
1. `cd ~/quay-install/podman/`
2. `scp root@10.161.30.107:/openshift_data/quay/podman.tar.gz .`
3. `tar -xzf podman.tar.gz`
4. `sudo yum localinstall podman/*.rpm -y`
```


## 防火墙配置
```bash
1. `sudo firewall-cmd --permanent --add-port={80,443,8080,8443,5432,6379}/tcp`
2. `sudo firewall-cmd --permanent --add-service=ssh`
3. `sudo firewall-cmd --reload`
```

|端口|服务|说明|
|---|---|---|
|80 / 443|Web 服务|Quay Web UI|
|8080 / 8443|管理 API|管理与健康检查|
|5432|PostgreSQL|保留，SQLite 不使用|
|6379|Redis|内置无密码实例|
|22|SSH|远程访问|
## SSH 无密码配置
mirror-registry 安装工具通过 SSH 连接目标主机执行部署任务。
```bash
1. `ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""`
2. `cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys`
3. `chmod 600 ~/.ssh/authorized_keys`
4. `chmod 700 ~/.ssh`
5. `ssh root@quay62-podman "echo 'SSH connection successful'"`
```

## 生成 SSL 证书（自签）
### 创建CA证书
```bash
1. `cd ~/quay-install/cert/`
2. `openssl genrsa -out ca.key 4096`
3. `openssl req -x509 -new -nodes -key ca.key -subj "/CN=quay62-podman-CA" -days 3650 -out ca.crt`
```

### 创建服务器证书配置文件
```bash
1. `cat > csr.conf << 'EOF'`
2. `[ req ]`
3. `default_bits = 2048`
4. `prompt = no`
5. `default_md = sha256`
6. `req_extensions = req_ext`
7. `distinguished_name = dn`

8. `[ dn ]`
9. `C = CN`
10. `ST = GuangDong`
11. `L = Shenzhen`
12. `O = quay`
13. `OU = quay`
14. `CN = quay62.testocpdc2.62dc2.com`

15. `[ req_ext ]`
16. `subjectAltName = @alt_names`

17. `[ alt_names ]`
18. `DNS.1 = quay62.testocpdc2.62dc2.com`
19. `DNS.2 = quay62-podman`
20. `IP.1 = 10.161.43.96`

21. `[ v3_ext ]`
22. `authorityKeyIdentifier=keyid,issuer:always`
23. `basicConstraints=CA:FALSE`
24. `keyUsage=keyEncipherment,dataEncipherment,digitalSignature`
25. `extendedKeyUsage=serverAuth,clientAuth`
26. `subjectAltName=@alt_names`
27. `EOF`
```
### 签发证书
```bash
1. `openssl genrsa -out server.key 4096`
2. `openssl req -new -key server.key -out server.csr -config csr.conf`
3. `openssl x509 -req -in server.csr \`
4. `-CA ca.crt -CAkey ca.key -CAcreateserial \`
5. `-out server.crt -days 3650 \`
6. `-extensions v3_ext -extfile csr.conf`
```

## 下载并安装 Mirror Registry
### 下载安装包
```bash
1. `cd ~/quay-install`
2. `scp root@10.161.30.107:/openshift_data/quay/mirror-registry-offline.tar.gz .`
3. `tar -xvf mirror-registry-offline.tar.gz`
```
## 安装 Quay Registry（SQLite 模式）
```bash
1. `./mirror-registry install \`
2. `-v \`
3. `--targetHostname quay62-podman \`
4. `--targetUsername root \`
5. `-k ~/.ssh/id_rsa \`
6. `--quayHostname quay62.testocpdc2.62dc2.com \`
7. `--sslCert ./cert/server.crt \`
8. `--sslKey ./cert/server.key \`
9. `--initUser admin \`
10. `--initPassword admin@123 \`
11. `--quayRoot /var/lib/quay \`
12. `--quayStorage /var/lib/quay/datastorage \`
13. `--sqliteStorage /var/lib/quay/sqlite`
```

|参数|含义|
|---|---|
|—targetHostname|目标主机名（本机）|
|—targetUsername|SSH 用户|
|-k|SSH 私钥路径|
|—quayHostname|Quay Web 访问域名|
|—sslCert / —sslKey|SSL 证书与私钥|
|—initUser / —initPassword|初始管理员账号|
|—quayRoot|Quay 主目录|
|—quayStorage|镜像存储目录|
|—sqliteStorage|SQLite 数据库存放目录|
|-v|显示详细日志输出|
⚠️ 不要添加 —redisPassword，默认 Redis 无密码。

## 验证安装状态
```bash
1. `podman ps -a`
2. `podman pod ls`
```
```bash
1. `POD ID NAME STATUS CONTAINERS`
2. `abcdef1234 quay-pod Running quay, postgres, redis`
```

验证服务
```bash
1. `curl -k https://quay62.testocpdc2.62dc2.com:8443`
```
web登录信息

|项|值|
|---|---|
|地址|[https://quay62.testocpdc2.62dc2.com:8443](https://quay62.testocpdc2.62dc2.com:8443/)|
|用户名|admin|
|密码|admin[@123](https://github.com/123 "@123")|

## 服务管理与重启
安装完成后，mirror-registry 会通过 Podman 生成 systemd 服务文件。  
Quay 会随系统启动自动恢复。

```bash
1. `常用命令：`
2. `podman ps -a # 查看容器状态`
3. `podman logs quay-app # 查看日志`
4. `podman pod restart quay-pod # 重启所有容器`
5. `sudo systemctl restart podman # 重启 Podman 服务`
```

## 上传镜像
### 配置本地信任自签证书
你的 Quay 使用的是自签 SSL 证书（server.crt），Podman 需要信任它，否则会报 x509 certificate signed by unknown authority 错误。

将 Quay 的 CA 证书拷贝到本地：
```bash
1. `scp root@quay62-podman:/root/quay-install/cert/ca.crt /etc/pki/ca-trust/source/anchors/quay62-ca.crt`
```

更新系统证书信任：
```bash
1. `sudo update-ca-trust`
```

对 Podman 特别信任你的私有仓库（**可选，如果不想全局信任**）：

创建文件 /etc/containers/registries.d/quay62.testocpdc2.62dc2.com/registries.conf，内容：

```bash
1. `[[registry]]`
2. `prefix = "quay62.testocpdc2.62dc2.com"`
3. `insecure = false`
```

注意：insecure = true 可以跳过证书验证，但不推荐生产环境使用。

### 给镜像打标签
假设你本地有一个镜像叫 registry.redhat.io/quay/quay-rhel8:v3.12.10，要推送到 Quay，需要打上仓库前缀：
```bash
1. `podman tag registry.redhat.io/quay/quay-rhel8:v3.12.10 quay62.testocpdc2.62dc2.com:8443/myrepo/quay-rhel8:v3.12.10`
```
格式说明：
```bash
1. `<registry-host>/<repository-name>:<tag>`
```
- registry-host：你的 Quay 域名，例如 quay62.testocpdc2.62dc2.com
    
- repository-name：在 Quay 上创建的仓库名（可以事先在 Web UI 创建）
    
- tag：镜像版本，如 latest 或 v1.0

### 推送镜像到 Quay
```bash
1. `podman push quay62.testocpdc2.62dc2.com:8443/myrepo/quay-rhel8:v3.12.10`
```
> myrepo 需要在 Quay Web UI 上事先创建。

如果一切顺利，你会看到镜像层被上传的进度，最终输出类似：
```bash
1. `Getting image source signatures`
2. `Copying blob sha256:xxxxxx...`
3. `...`
4. `Writing manifest to image destination`
5. `Storing signatures`
```
### 验证镜像上传
可以通过 Podman 或 Quay Web UI 验证：
```bash
1. `podman pull quay62.testocpdc2.62dc2.com:8443/myrepo/quay-rhel8:v3.12.10`
```

如果能拉取，说明镜像已经成功上传。

## SQLite 数据库说明
|项目|值|
|---|---|
|数据库文件|/var/lib/quay/sqlite/quay.db|
|存储内容|用户、仓库、组织、访问权限、镜像元信息等|
|特点|无需独立服务、自动创建、单节点使用最佳|
|缺点|不支持高并发、主从同步或集群|
|适用场景|离线环境、小型企业内部镜像仓库|

```bash
1. `备份数据库`
2. `systemctl stop podman`
3. `cp /var/lib/quay/sqlite/quay.db /var/lib/quay/sqlite/quay.db.bak.$(date +%F)`
4. `systemctl start podman`

5. `恢复数据库`
6. `systemctl stop podman`
7. `cp /var/lib/quay/sqlite/quay.db.bak.2025-11-08 /var/lib/quay/sqlite/quay.db`
8. `systemctl start podman`
```
## 配置文件说明
默认配置路径：
```bash
1. `/var/lib/quay/quay-config/config.yaml`
```

```bash
1. `SERVER_HOSTNAME: quay62.testocpdc2.62dc2.com`
2. `DATABASE_SECRET_KEY: <自动生成>`
3. `DB_URI: sqlite:////var/lib/quay/sqlite/quay.db`
4. `DISTRIBUTED_STORAGE_CONFIG:`
5. `default:`
6. `- LocalStorage`
7. `- storage_path: /var/lib/quay/datastorage`
8. `FEATURE_USER_CREATION: true`
9. `AUTHENTICATION_TYPE: Database`
```

关键字段说明（示例）
```bash
1. `SERVER_HOSTNAME: quay62.testocpdc2.62dc2.com`
2. `DATABASE_SECRET_KEY: <自动生成>`
3. `DB_URI: sqlite:////var/lib/quay/sqlite/quay.db`
4. `DISTRIBUTED_STORAGE_CONFIG:`
5. `default:`
6. `- LocalStorage`
7. `- storage_path: /var/lib/quay/datastorage`
8. `FEATURE_USER_CREATION: true`
9. `AUTHENTICATION_TYPE: Database`
```

|字段|含义|
|---|---|
|DB_URI|SQLite 数据库连接路径|
|DISTRIBUTED_STORAGE_CONFIG|镜像层存储配置|
|AUTHENTICATION_TYPE|认证方式，默认 Database|
|FEATURE_USER_CREATION|是否允许用户注册|
|SERVER_HOSTNAME|对外访问域名|
### 特别注意—关于安全扫描
查看/var/lib/quay/quay-config/config.yaml，看到这些
```bash
1. `FEATURE_SECURITY_SCANNER: false`
2. `FEATURE_SECURITY_NOTIFICATIONS: true`
3. `SECURITY_SCANNER_ISSUER_NAME: security_scanner`
```
解释：

FEATURE_SECURITY_SCANNER: false  
✅ 表示 安全扫描功能未启用，Quay 默认不执行镜像漏洞扫描。

FEATURE_SECURITY_NOTIFICATIONS: true  
✅ 启用了安全通知功能，但没有扫描器，这个只是通知机制。

SECURITY_SCANNER_ISSUER_NAME  
这个字段只是标识安全扫描器的身份名，用于后续启用扫描时配置。

结论：你的当前 Quay 单机部署（SQLite + 内置 Redis）不支持镜像安全扫描，因为安全扫描依赖一个独立的 clair / trivy 扫描器服务，默认单机安装不会自动启用。

## 常见问题与排查
|问题|可能原因|解决方案|
|---|---|---|
|Web 无法访问|证书或端口问题|检查防火墙与证书路径|
|登录失败|密码错误或数据库异常|重新初始化管理员或检查 SQLite 文件|
|Redis 报错|启动顺序错误|podman pod restart quay-pod|
|证书不受信任|自签 CA 未导入|将 ca.crt 导入客户端系统信任库|
|页面慢或卡顿|内存不足 / I/O 慢|调整 vm.overcommit_memory=1|

## 总结与建议

|模块|状态|备注|
|---|---|---|
|Podman|✅ 已部署|轻量容器引擎|
|Mirror Registry|✅ 已安装|自动安装 Quay 组件|
|SQLite|✅ 已启用|适合单机环境|
|Redis|✅ 内置无密码|默认本地连接|
|证书|✅ 自签|可替换为正式证书|
|初始用户|✅ admin / admin[@123](https://github.com/123 "@123")|登录 Quay 控制台|
|自动启动|✅|Podman + systemd 管理|

## 附件清单
|文件|作用|
|---|---|
|/var/lib/quay/sqlite/quay.db|主数据库文件|
|/var/lib/quay/datastorage/|镜像层文件|
|/var/lib/quay/config/config.yaml|主配置文件|
|~/quay-install/cert/server.crt|SSL 证书|
|~/quay-install/cert/server.key|SSL 密钥|
|~/quay-install/mirror-registry-offline.tar.gz|安装包|
|~/.ssh/id_rsa|SSH 私钥|

## 运维经验

```bash
1. `harbor3.quay.dc.com:8443/ocp419-red/openshift4/nmstate-console-plugin-rhel9@sha256:b9deb7aba06907d25d870a3cc3dbbb43ffd19c8dd0a884aaebe82084d41abcfa: reading manifest sha256:b9deb7aba06907d25d870a3cc3dbbb43ffd19c8dd0a884aaebe82084d41abcfa in harbor3.quay.dc.com:8443/ocp419-red/openshift4/nmstate-console-plugin-rhel9: received unexpected HTTP status: 504 Gateway Time-out]`
```

解决方案
```bash
1. `仓库突然无法联网导致，联网后正常。具体原因待分析`
```










