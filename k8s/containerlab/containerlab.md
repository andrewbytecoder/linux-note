

## 启动web


```bash
sudo groupadd -f clab_api
sudo groupadd -f clab_admins
sudo usermod -aG clab_api andrew

# 修改完之后注销再登录，保证生效
newgrp clab_api
```


启动 web

```bash
docker run -d --name containerlab-app \
  --restart unless-stopped \
  --network host \
  ghcr.io/srl-labs/containerlab-web:latest
```

启动 api server 容器

```bash
sudo containerlab tools api-server start \
  --labs-dir /opt/containerlab/labs
```


### 界面登录
```bash
## 界面登录的时候，用户名使用绑定的用户 密码使用linux上的密码
这里是  andrew    
```

