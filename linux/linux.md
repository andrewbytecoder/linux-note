
## 工具

### sysctl

```bash
# 列出所有sysctl可以设置的参数
sysctl -a
```

#### 套接字和tcp缓冲

所有协议类型的读(rmem_max)和写(wmem_max)的最大套接字缓冲区大小可以这样进行设置

```bash
# 列出所有套接字缓冲区
net.core.rmem_max
net.core.wmem_max
# 最小
net.core.rmem_min
net.core.wmem_min
```

```bash
# 为TCP的读和写缓冲设置自动调优参数
# 最小， 默认， 最大字节数，长度从默认值自动调整，要提高吞吐量可以增加最大值
# 增加最小值和默认值会使每个连接消耗更多不必要的内存
sysctl -w net.ipv4.tcp_wmem="4096 87380 87380"
sysctl -w net.ipv4.tcp_rmem="4096 87380 87380"
```

#### TCP加压队列

首个积压队列，用于半开连接
```bash
net.ipv4.tcp_max_syn_backlog = 4096
```

第二个积压队列，将连接传递给accept的监听积压队列
```bash
net.core.somaxconn = 1024
```

为了应对突发的负载，这两个值也许都需要进行提高，比如设置成1024或者4096

#### 设备积压队列

增加每个CPU的网络设备积压队列长度

```bash
# 如果是10GbE的网卡，这可能需要增加到10000
net.core.netdev_max_backlog = 10000
```

#### TCP拥塞控制算法

Linux支持可插入的拥塞控制算法

```bash
# 列出所有支持的算法
sysctl net.ipv4.tcp_available_congestion_control
net.ipv4.tcp_available_congestion_control = reno cubic
# 一些支持但是未加载，例如添加htcp
modprobe tcp_htcp
sysctl net.ipv4.tcp_available_congestion_control
net.ipv4.tcp_available_congestion_control = reno cubic htcp
```

#### TCP选项

一些TCP参数包括SACK和FACK扩展，他们能以一定的CPU负载为代价在高延时的网络中提高性能吞吐性

```bash
net.ipv4.tcp_sack = 1
net.ipv4.tcp_fack = 1
# 可以重用一个TIME_WAIT会话
net.ipv4.tcp_tw_reuse = 1
# 可以重用一个TIME_WAIT会话，但是没有tcp_tw_reuse安全
net.ipv4.tcp_tw_recycle = 1
```


## 命名空间

命名空间对系统的视图进行过滤，使容器只能看到和管理自己的进程、挂载点以及其他资源

[cols="~,~", options="header"]
|===
|命名空间 |描述

|cgroup |用于cgroup可见性
|ipc |用于进程间通讯的可见性
|mnt |用于文件系统挂载点
|net |用于网络隔离，过滤接口、套接字、路由等
|pid |用于进程可见性，过滤/proc
|user |用于用户ID
|uts |用于主机名、域名和uname系统调用
|time |用于不同容器单独的系统时钟
|===

### lsns

使用lsns可以查看系统中当前命名空间

```bash
# 列出所有命名空间
lsns
```






























参见： 网络命名空间






