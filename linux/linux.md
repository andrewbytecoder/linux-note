
## CPU

### core
或者从芯片视图看
![[Pasted image 20250929162140.png]]


超线程（Hyper-threading）/硬件线程（hardware thread）
![[Pasted image 20250929162135.png]]
大部分 X86 处理器都支持超线程，也叫**==硬件线程==**。 如果一个 CORE 支持 2 个硬件线程， 那么启用超线程后， 这个 CORE 上面就有 **==2 个在大部分情况下都能独立执行的指令流==**（这 2 个硬件线程共享 L1 cache 等）， **==操作系统能看到的 CPU 数量会翻倍==**（相比 CORE 的数量）， 每个 CPU 对应的不是一个 CORE，而是一个硬件线程/超线程（hyper-thread）。

####  (Logical) `CPU`
以上提到的 package、core/processor、hyper-threading/hardware-thread，都是 **==硬件概念==**。

在任务调度的语境中，我们所说的 “CPU” 其实是一个 **==逻辑概念==**。 例如，内核的任务调度是 **==基于逻辑 CPU==** 来的，

- 为每个逻辑 CPU 分配一个任务队列（run queue），独立调度；
- 为每个逻辑 CPU 能独立加载指令并执行。

逻辑 CPU 的数量和分布跟 package/core/hyper-threading 有直接关系， **==一个逻辑 CPU 不一定对应一个独立的硬件处理器==**。

下面通过一个具体例子来看下四者之间的关系。

Linux node 实探：`cpupower/hwloc/lstopo` 查看三者的关系
```bash
$ cpupower monitor
              | Mperf              
 PKG|CORE| CPU| C0   | Cx   | Freq 
   0|   0|   0|  2.66| 97.34|  2494
   0|   0|  24|  1.89| 98.11|  2493
   0|   1|   1|  2.09| 97.91|  2494
   0|   1|  25|  1.77| 98.23|  2494
   ...
   0|  13|  11|  1.95| 98.05|  2493
   0|  13|  35|  2.30| 97.70|  2492
   1|   0|  12|  1.65| 98.35|  2493
   1|   0|  36|  1.58| 98.42|  2494
   ...
   1|  13|  23|  1.78| 98.22|  2494
   1|  13|  47|  5.07| 94.93|  2493
```

前三列：

1. `PKG`：package，
    
    **==2 个独立的 CPU package==**（`0~1`），对应上面的 NUMA；
    
2. `CORE`：**==物理核心==**/物理处理器
    
    每个 package 里 **==14 个 CORE==**（`0~13`）；
    
3. `CPU`：用户看到的 CPU，即我们上面所说的**==逻辑 CPU==**
    
    这台机器启用了超线程（hyperthreading），每个 CORE 对应两个 **==`hardware thread`==**， 每个 hardware thread 最终呈现为一个**==用户看到的 CPU==**，因此最终是 48 个 CPU（`0~47`）。
    

也可以通过 `hw-loc` 查看**==硬件拓扑==**，里面能详细到不同 CPU 的 **==`L1/L2 cache`==** 关系：
```bash
$ hwloc-ls
Machine (251GB total)
  NUMANode L#0 (P#0 125GB)
    Package L#0 + L3 L#0 (30MB)                                    # <-- PKG 0
      L2 L#0 (256KB) + L1d L#0 (32KB) + L1i L#0 (32KB) + Core L#0  #   <-- CORE 0
        PU L#0 (P#0)                                               #     <-- Logical CPU 0  对应到这里
        PU L#1 (P#24)                                              #     <-- Logical CPU 24 对应到这里
      L2 L#1 (256KB) + L1d L#1 (32KB) + L1i L#1 (32KB) + Core L#1  #   <-- CORE 1
        PU L#2 (P#1)                                               #     <-- Logical CPU 1  对应到这里
        PU L#3 (P#25)                                              #     <-- Logical CPU 25 对应到这里
  ...
  NUMANode L#1 (P#1 126GB) + Package L#1 + L3 L#1 (30MB)
    L2 L#12 (256KB) + L1d L#12 (32KB) + L1i L#12 (32KB) + Core L#12
      PU L#24 (P#12)
      PU L#25 (P#36)
    ...
    L2 L#23 (256KB) + L1d L#23 (32KB) + L1i L#23 (32KB) + Core L#23
      PU L#46 (P#23)
      PU L#47 (P#47)
```




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




## `/proc` 文件系统

### `/proc/net/softnet_stat` 各字段说明

前面看到，如果 budget 或者 time limit 到了而仍有包需要处理，那 `net_rx_action` 在退出 循环之前会更新统计信息。这个信息存储在该 CPU 的 `struct softnet_data` 变量中。

这些统计信息打到了`/proc/net/softnet_stat`，但不幸的是，关于这个的文档很少。每一 列代表什么并没有标题，而且列的内容会随着内核版本可能发生变化，所以应该以内核源码为准， 下面是内核 5.10，可以看到每列分别对应什么：

```c
// https://github.com/torvalds/linux/blob/v5.10/net/core/net-procfs.c#L172

static int softnet_seq_show(struct seq_file *seq, void *v)
{
    ...
    seq_printf(seq,
           "%08x %08x %08x %08x %08x %08x %08x %08x %08x %08x %08x %08x %08x\n",
           sd->processed, sd->dropped, sd->time_squeeze, 0,
           0, 0, 0, 0, /* was fastroute */
           0,    /* was cpu_collision */
           sd->received_rps, flow_limit_count,
           softnet_backlog_len(sd), (int)seq->index);
}
```

```bash
$ cat /proc/net/softnet_stat
6dcad223 00000000 00000001 00000000 00000000 00000000 00000000 00000000 00000000 00000000
6f0e1565 00000000 00000002 00000000 00000000 00000000 00000000 00000000 00000000 00000000
660774ec 00000000 00000003 00000000 00000000 00000000 00000000 00000000 00000000 00000000
61c99331 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000
6794b1b3 00000000 00000005 00000000 00000000 00000000 00000000 00000000 00000000 00000000
6488cb92 00000000 00000001 00000000 00000000 00000000 00000000 00000000 00000000 00000000
```

每一行代表一个 `struct softnet_data` 变量。因为每个 CPU 只有一个该变量，所以每行其实代表一个 CPU； 数字都是 16 进制表示。字段说明：

- 第一列 `sd->processed`：处理的网络帧数量。**==如果用了 ethernet bonding，那这个值会大于总帧数==**， 因为 bond 驱动有时会触发帧的重处理（re-processed）；
- 第二列 `sd->dropped`：因为处理不过来而 drop 的网络帧数量；具体见原理篇；
- 第三列 `sd->time_squeeze`：由于 budget 或 time limit 用完而退出 `net_rx_action()` 循环的次数；原理篇中有更多分析；
- 接下来的 5 列全是 0；
- 第九列 `sd->cpu_collision`：为发送包而获取锁时冲突的次数；
- 第十列 `sd->received_rps`：当前 CPU 被其他 CPU 唤醒去收包的次数；
- 最后一列，`flow_limit_count`：达到 flow limit 的次数；这是 RPS 特性。










## 命令行工具

1. 安装zsh
```bash
sudo apt install zsh
```

2. 将zsh设置为默认shell
```bash
chsh -s $(which zsh)
```

2. 设置主题
```bash
# 先下载主题
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
# 设置 .zshrc
ZSH_THEME="agnoster"
plugins=(git)
```










