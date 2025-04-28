
## 认识containerd

Namespace和Cgroups容器里面的两大关键技术。

其实，镜像就是一个特殊的文件系统，它提供了容器中程序执行需要的所有文件。具体来说，就是应用程序想启动，需要三类文件：相关的程序可执行文件、库文件和配置文件，这三类文件都被容器打包做好了。

![[image-2025-02-13-16-21-04-695.png]]

从用户使用的角度来看，容器和一台独立的机器或者虚拟机没有什么太大的区别，但是它和虚拟机相比，却没有各种复杂的硬件虚拟层，没有独立的 Linux 内核。

#### *容器是什么*

要回答这个问题，你可以先记住这两个术语 Namespace 和 Cgroups。如果有人问你 Linux 上的容器是什么，最简单直接的回答就是 Namesapce 和 Cgroups。Namespace 和 Cgroups 可以让程序在一个资源可控的独立（隔离）环境中运行，这个就是容器了。

*Namespace*

```bash
# docker exec c5a9ff78d9c1 ps -ef

UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 01:59 ?        00:00:00 /sbin/httpd -D FOREGROUND
apache       6     1  0 01:59 ?        00:00:00 /sbin/httpd -D FOREGROUND
apache       7     1  0 01:59 ?        00:00:00 /sbin/httpd -D FOREGROUND
apache       8     1  0 01:59 ?        00:00:00 /sbin/httpd -D FOREGROUND
apache       9     1  0 01:59 ?        00:00:00 /sbin/httpd -D FOREGROUND

# ps -ef | grep httpd

UID        PID  PPID  C STIME TTY          TIME CMD
root     20731 20684  0 18:59 ?        00:00:01 /sbin/httpd -D FOREGROUND
48       20787 20731  0 18:59 ?        00:00:00 /sbin/httpd -D FOREGROUND
48       20788 20731  0 18:59 ?        00:00:06 /sbin/httpd -D FOREGROUND
48       20789 20731  0 18:59 ?        00:00:05 /sbin/httpd -D FOREGROUND
48       20791 20731  0 18:59 ?        00:00:05 /sbin/httpd -D FOREGROUN
```

这两组输出结果到底有什么差别呢，你可以仔细做个对比，最大的不同就是进程的 PID 不一样。那为什么 PID 会不同呢？或者说，运行 docker exec c5a9ff78d9c1 ps -ef 和 ps -ef 实质的区别在哪里呢？ 如果理解了 PID 为何不同，我们就能搞清楚 Linux Namespace 的概念了

![[image-2025-02-13-16-25-50-304.png]]

Linux 在创建容器的时候，就会建出一个 PID Namespace，PID 其实就是进程的编号。这个 PID Namespace，就是指每建立出一个 Namespace，就会单独对进程进行 PID 编号，每个 Namespace 的 PID 编号都从 1 开始。

同时在这个 PID Namespace 中也只能看到 Namespace 中的进程，而且看不到其他 Namespace 里的进程。

这也就是说，如果有另外一个容器，那么它也有自己的一个 PID Namespace，而这两个 PID Namespace 之间是不能看到对方的进程的，这里就体现出了 Namespace 的作用：相互隔离。

而在宿主机上的 Host PID Namespace，它是其他 Namespace 的父亲 Namespace，可以看到在这台机器上的所有进程，不过进程 PID 编号不是 Container PID Namespace 里的编号了，而是把所有在宿主机运行的进程放在一起，再进行编号。

讲了 PID Namespace 之后，我们了解到 Namespace 其实就是一种隔离机制，主要目的是隔离运行在同一个宿主机上的容器，让这些容器之间不能访问彼此的资源。

这种隔离有两个作用：第一是可以充分地利用系统的资源，也就是说在同一台宿主机上可以运行多个用户的容器；第二是保证了安全性，因为不同用户之间不能访问对方的资源。

我们还可以运行 docker exec c5a9ff78d9c1 ls/ 查看容器中的根文件系统（rootfs）。然后，你会发现，它和宿主机上的根文件系统也是不一样的。容器中的根文件系统，其实就是我们做的镜像。

那容器自己的根文件系统完全独立于宿主机上的根文件系统，这一点是怎么做到的呢？其实这里依靠的是 Mount Namespace，Mount Namespace 保证了每个容器都有自己独立的文件目录结构。

![[image-2025-02-13-16-33-15-861.png]]

这些 Namespace 尽管类型不同，其实都是为了隔离容器资源：PID Namespace 负责隔离不同容器的进程，Network Namespace 又负责管理网络环境的隔离，Mount Namespace 管理文件系统的隔离。

*Cgroups*

想要定义“计算机”各种容量大小，就涉及到支撑容器的第二个技术 Cgroups （Control Groups）了。Cgroups 可以对指定的进程做各种计算机资源的限制，比如限制 CPU 的使用率，内存使用量，IO 设备的流量等等。

Cgroups 究竟有什么好处呢？要知道，在 Cgroups 出现之前，任意一个进程都可以创建出成百上千个线程，可以轻易地消耗完一台计算机的所有 CPU 资源和内存资源。

Cgroups 通过不同的子系统限制了不同的资源，每个子系统限制一种资源。每个子系统限制资源的方式都是类似的，就是把相关的一组进程分配到一个控制组里，然后通过树结构进行管理，每个控制组都设有自己的资源控制参数。

> 完整的 Cgroups 子系统的介绍，你可以查看Linux Programmer’s Manual 中 Cgroups 的定义。

以下是几种常见的 Cgroups 子系统：

- CPU 子系统，用来限制一个控制组（一组进程，你可以理解为一个容器里所有的进程）可使用的最大 CPU。
- memory 子系统，用来限制一个控制组最大的内存使用量。
- pids 子系统，用来限制一个控制组里最多可以运行多少个进程。
- cpuset 子系统， 这个子系统来限制一个控制组里的进程可以在哪几个物理 CPU 上运行。

Namespace 帮助容器来实现各种计算资源的隔离，Cgroups 主要限制的是容器能够使用的某种资源量

### 容器的init进程

现有的linux发行版本中，/sbin/init通常指向的都是systemd。因此，在 Linux 上有了容器的概念之后，一旦容器建立了自己的 Pid Namespace（进程命名空间），这个 Namespace 里的进程号也是从 1 开始标记的。所以，容器的 init 进程也被称为 1 号进程。

```bash
[root@k8smaster-ims cgroup]# ls -al /sbin/init
lrwxrwxrwx. 1 root root 22 Oct 17 18:31 /sbin/init -> ../lib/systemd/systemd
```

我们运行 kill 命令，其实在 Linux 里就是发送一个信号，那么信号ll到底是什么呢？用一句话来概括，信号（Signal）其实就是 Linux 进程收到的一个通知。

```c
kernel/signal.c
static bool sig_task_ignored(struct task_struct *t, int sig, bool force)
{
        void __user *handler;
        handler = sig_handler(t, sig);

        /* SIGKILL and SIGSTOP may not be sent to the global init */
        // is_global_init(t): Checks if the task t is the global init process (PID 1).
        // sig_kernel_only(sig): Checks if the signal sig is one that can only be sent by the kernel (e.g., SIGKILL, SIGSTOP).
        if (unlikely(is_global_init(t) && sig_kernel_only(sig)))
                return true;
        // SIGNAL_UNKILLABLE: A flag indicating that the task is unkillable (e.g., kernel threads or special system tasks).
        // handler == SIG_DFL: Checks if the signal handler is the default action.
        // If the task is unkillable, the signal handler is the default, and the signal is not being forced (or is not a kernel-only signal), the signal is ignored.
        if (unlikely(t->signal->flags & SIGNAL_UNKILLABLE) &&
            handler == SIG_DFL && !(force && sig_kernel_only(sig)))
                return true;

        /* Only allow kernel generated signals to this kthread */
        // PF_KTHREAD: A flag indicating that the task is a kernel thread.
        // handler == SIG_KTHREAD_KERNEL: Checks if the signal handler is specific to kernel threads.
        // If the task is a kernel thread, the signal handler is specific to kernel threads, and the signal is not being forced, the signal is ignored.
        if (unlikely((t->flags & PF_KTHREAD) &&
                     (handler == SIG_KTHREAD_KERNEL) && !force))
                return true;

        return sig_handler_ignored(handler, sig);
}
```

#### 容器中的进程

#### 容器中的僵尸进程

自己的容器运行久了之后，运行 ps 命令会看到一些进程，进程名后面加了 <defunct> 标识。

```bash
# ps aux
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.0   4324  1436 ?        Ss   01:23   0:00 /app-test 1000
root         6  0.0  0.0      0     0 ?        Z    01:23   0:00 [app-test] <defunct>
```

在进程“活着”的时候就只有两个状态：运行态（TASK_RUNNING）和睡眠态（TASK_INTERRUPTIBLE，TASK_UNINTERRUPTIBLE）

.《Linux Kernel Development》这本书里的 Linux 进程状态转化图
![[image-2025-02-13-18-47-52-877.png]]

运行态的意思是，无论进程是正在运行中（也就是获得了 CPU 资源），还是进程在 run queue 队列里随时可以运行，都处于这个状态。我们想要查看进程是不是处于运行态，其实也很简单，比如使用 ps 命令，可以看到处于这个状态的进程显示的是 R stat。

睡眠态是指，进程需要等待某个资源而进入的状态，要等待的资源可以是一个信号量（Semaphore）, 或者是磁盘 I/O，这个状态的进程会被放入到 wait queue 队列里。这个睡眠态具体还包括两个子状态：一个是可以被打断的（TASK_INTERRUPTIBLE），我们用 ps 查看到的进程，显示为 S stat。还有一个是不可被打断的（TASK_UNINTERRUPTIBLE），用 ps 查看进程，就显示为 D stat。

除了上面进程在活的时候的两个状态，进程在调用 do_exit() 退出的时候，还有两个状态。

一个是 EXIT_DEAD，也就是进程在真正结束退出的那一瞬间的状态；第二个是 EXIT_ZOMBIE 状态，这是进程在 EXIT_DEAD 前的一个状态，僵尸进程就是是处于这个状态中。

对于 Linux 系统而言，容器就是一组进程的集合。如果容器中的应用创建过多的进程或者出现 bug，就会产生类似 fork bomb 的行为。

这个 fork bomb 就是指在计算机中，通过不断建立新进程来消耗系统中的进程资源，它是一种黑客攻击方式。这样，容器中的进程数就会把整个节点的可用进程总数给消耗完。

这样，不但会使同一个节点上的其他容器无法工作，还会让宿主机本身也无法工作。所以对于每个容器来说，我们都需要限制它的最大进程数目，而这个功能由 pids Cgroup 这个子系统来完成。

而这个功能的实现方法是这样的：pids Cgroup 通过 Cgroup 文件系统的方式向用户提供操作接口，一般它的 Cgroup 文件系统挂载点在 /sys/fs/cgroup。

在一个容器建立之后，创建容器的服务会在 /sys/fs/cgroup 下建立一个子目录，就是一个控制组，控制组里最关键的一个文件就是 pids.max。

父进程在创建完子进程之后就不管了，这就是造成子进程变成僵尸进程的原因。

#### 为什么容器中的进程会被杀死

Containerd 在停止容器的时候，就会向容器的 init 进程发送一个 SIGTERM 信号。在 init 进程退出之后，容器内的其他进程也都立刻退出了。不过不同的是，init 进程收到的是 SIGTERM 信号，而其他进程收到的是 SIGKILL 信号。

因为在init进程收到SIGTERM之后，对于容器来说，这里调用的就是 zap_pid_ns_processes() 这个函数，而在这个函数中，如果是处于退出状态的 init 进程，它会向 Namespace 中的其他进程都发送一个 SIGKILL 信号。

前面我讲过，SIGKILL 是个特权信号（特权信号是 Linux 为 kernel 和超级用户去删除任意进程所保留的，不能被忽略也不能被捕获）。 所以进程收到这个信号后，就立刻退出了，没有机会调用一些释放资源的 handler 之后，再做退出动作。因此如果想优雅的退出容器中所有的进程，需要对init进程的SIGTERM信号处理函数进行改造。

### 容器的CPU

#### 怎样限制容器的CPU

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: frontend
spec:
  containers:
  - name: app
    image: images.my-company.example/app:v4
    resources:
      requests:
        memory: "64Mi"
        cpu: "1"
      limits:
        memory: "128Mi"
        cpu: "2"
```

在 Pod Spec 里的"Request CPU"和"Limit CPU"的值，最后会通过 CPU Cgroup 的配置，来实现控制容器 CPU 资源的作用。

那接下来先从进程的 CPU 使用讲起，然后在看 CPU Cgroup 子系统中建立几个控制组，用这个例子为你讲解 CPU Cgroup 中的三个最重要的参数"cpu.cfs_quota_us""cpu.cfs_period_us""cpu.shares"。

我们对照下图的 Top 运行界面，在截图第三行，"%Cpu(s)"开头的这一行，你会看到一串数值，也就是"0.0 us, 0.0 sy, 0.0 ni, 99.9 id, 0.0 wa, 0.0 hi, 0.0 si, 0.0 st"

![[image-2025-02-13-20-03-23-912.png]]

下面这张图里最长的带箭头横轴，我们可以把它看成一个时间轴。同时，它的上半部分代表 Linux 用户态（User space），下半部分代表内核态（Kernel space）。

![[image-2025-02-13-20-04-07-394.png]]

假设一个用户程序开始运行了，那么就对应着第一个"us"框，"us"是"user"的缩写，代表 Linux 的用户态 CPU Usage。普通用户程序代码中，只要不是调用系统调用（System Call），这些代码的指令消耗的 CPU 就都属于"us"。

当这个用户程序代码中调用了系统调用，比如说 read() 去读取一个文件，这时候这个用户进程就会从用户态切换到内核态。

内核态 read() 系统调用在读到真正 disk 上的文件前，就会进行一些文件系统层的操作。那么这些代码指令的消耗就属于"sy"，这里就对应上面图里的第二个框。"sy"是 "system"的缩写，代表内核态 CPU 使用。

接下来，这个 read() 系统调用会向 Linux 的 Block Layer 发出一个 I/O Request，触发一个真正的磁盘读取操作。

这时候，这个进程一般会被置为 TASK_UNINTERRUPTIBLE。而 Linux 会把这段时间标示成"wa"，对应图中的第三个框。"wa"是"iowait"的缩写，代表等待 I/O 的时间，这里的 I/O 是指 Disk I/O。

紧接着，当磁盘返回数据时，进程在内核态拿到数据，这里仍旧是内核态的 CPU 使用中的"sy"，也就是图中的第四个框。

然后，进程再从内核态切换回用户态，在用户态得到文件数据，这里进程又回到用户态的 CPU 使用，"us"，对应图中第五个框。

好，这里我们假设一下，这个用户进程在读取数据之后，没事可做就休眠了。并且我们可以进一步假设，这时在这个 CPU 上也没有其他需要运行的进程了，那么系统就会进入"id"这个步骤，也就是第六个框。"id"是"idle"的缩写，代表系统处于空闲状态。

如果这时这台机器在网络收到一个网络数据包，网卡就会发出一个中断（interrupt）。相应地，CPU 会响应中断，然后进入中断服务程序。

这时，CPU 就会进入"hi"，也就是第七个框。"hi"是"hardware irq"的缩写，代表 CPU 处理硬中断的开销。由于我们的中断服务处理需要关闭中断，所以这个硬中断的时间不能太长。

但是，发生中断后的工作是必须要完成的，如果这些工作比较耗时那怎么办呢？Linux 中有一个软中断的概念（softirq），它可以完成这些耗时比较长的工作。

你可以这样理解这个软中断，从网卡收到数据包的大部分工作，都是通过软中断来处理的。那么，CPU 就会进入到第八个框，"si"。这里"si"是"softirq"的缩写，代表 CPU 处理软中断的开销。

这里你要注意，无论是"hi"还是"si"，它们的 CPU 时间都不会计入进程的 CPU 时间。*这是因为本身它们在处理的时候就不属于任何一个进程*。

不过，我们还剩两个类型的 CPU 使用没讲到，我想给你做个补充，一次性带你做个全面了解。这样以后你解决相关问题时，就不会再犹豫，这些值到底影不影响 CPU Cgroup 中的限制了。下面我给你具体讲一下。

一个是"ni"，是"nice"的缩写，这里表示如果进程的 nice 值是正值（1-19），代表优先级比较低的进程运行时所占用的 CPU。

另外一个是"st"，"st"是"steal"的缩写，是在虚拟机里用的一个 CPU 使用类型，表示有多少时间是被同一个宿主机上的其他虚拟机抢走的。

![[image-2025-02-13-20-10-29-317.png]]

*CPU Cgroup*

 Cgroups 是对指定进程做计算机资源限制的，CPU Cgroup 是 Cgroups 其中的一个 Cgroups 子系统，它是用来限制进程的 CPU 使用的。

对于进程的 CPU 使用, 通过前面的 Linux CPU 使用分类的介绍，我们知道它只包含两部分: 一个是用户态，这里的用户态包含了 us 和 ni；还有一部分是内核态，也就是 sy。 至于 wa、hi、si，这些 I/O 或者中断相关的 CPU 使用，CPU Cgroup 不会去做限制

每个进程的 CPU Usage 只包含用户态（us 或 ni）和内核态（sy）两部分，其他的系统 CPU 开销并不包含在进程的 CPU 使用中，而 CPU Cgroup 只是对进程的 CPU 使用做了限制。

#### 如何正确拿到容器CPU的消耗

我们想要精准地对运行着众多容器的云平台做监控，快速排查例如应用的处理能力下降，节点负载过高等问题，就绕不开容器 CPU 开销。因为 CPU 开销的异常，往往是程序异常最明显的一个指标。

在宿主机上我们经常使用top命令来查看CPU开销，但是如果你在容器中执行top命令，你会发现显示的是物理机的CPU开销，而不是容器的CPU开销。

我们可以去看一下 top 命令的源代码。在代码中你会看到对于每个进程，top 都会从 proc 文件系统中每个进程对应的 stat 文件中读取 2 个数值。这个 stat 文件就是 /proc/[pid]/stat ， [pid] 就是替换成具体一个进程的 PID 值。

完整的 stat 文件内容和格式在 proc 文件系统的 Linux programmer’s manual 里定义了。在这里，我们只需要重点关注这两项数值，stat 文件中的第 14 项 utime 和第 15 项 stime。

![[image-2025-02-13-20-43-41-551.png]]

utime 是表示进程的用户态部分在 Linux 调度中获得 CPU 的 ticks，stime 是表示进程的内核态部分在 Linux 调度中获得 CPU 的 ticks。

根据top源码可以得到进程的 CPU 使用率计算公式：`((utime_2 – utime_1) + (stime_2 – stime_1)) * 100.0 / (HZ * et * 1 )`

第一个 HZ 是什么意思呢？前面我们介绍 ticks 里说了，ticks 是按照固定频率发生的，在我们的 Linux 系统里 1 秒钟是 100 次，那么 HZ 就是 1 秒钟里 ticks 的次数，这里值是 100。

第二个参数 et 是我们刚才说的那个“瞬时”的时间，也就是得到 utime_1 和 utime_2 这两个值的时间间隔。

第三个“1”, 就更容易理解了，就是 1 个 CPU。那么这三个值相乘，你是不是也知道了它的意思呢？就是在这“瞬时”的时间（et）里，1 个 CPU 所包含的 ticks 数目。

我们要计算系统 CPU 使用率，首先需要拿到数据，数据源也同样可以从 proc 文件系统里得到，对于整个系统的 CPU 使用率，这个文件就是 /proc/stat。

对于系统总的 CPU 使用率，需要读取 /proc/stat 文件，但是这个文件中的各项 CPU ticks 是反映整个节点的，并且这个 /proc/stat 文件也不包含在任意一个 Namespace 里。因此、对于 top 命令来说，它只能显示整个节点中各项 CPU 的使用率，不能显示单个容器的各项 CPU 的使用率。

如果想要单个CPU使用信息，可以去对应容器中读取 /sys/fs/cgroup/cpu.stat

####  Load Average

第三行可以显示当前的 CPU 使用情况，我们可以看到整个机器的 CPU Usage 几乎为 0，因为"id"显示 99.9%，这说明 CPU 是处于空闲状态的。

但是请你注意，这里 1 分钟的"load average"的值却高达 9.09，这里的数值 9 几乎就意味着使用了 9 个 CPU 了，这样 CPU Usage 和 Load Average 的数值看上去就很矛盾了。

![[image-2025-02-13-21-02-49-807.png]]

那问题来了，我们在看一个系统里 CPU 使用情况时，到底是看 CPU Usage 还是 Load Average 呢？

这里就涉及到今天要解决的两大问题：

- Load Average 到底是什么，CPU Usage 和 Load Average 有什么差别？
- 如果 Load Average 值升高，应用的性能下降了，这背后的原因是什么呢？

##### 什么是 Load Average?

Load Average 这个概念，你可能在使用 Linux 的时候就已经注意到了，无论你是运行 uptime, 还是 top，都可以看到类似这个输出"load average：2.02, 1.83, 1.20"。那么这一串输出到底是什么意思呢？

最直接的办法当然是看手册了，如果我们用"Linux manual page"搜索 uptime 或者 top，就会看到对这个"load average"和后面三个数字的解释是"the system load averages for the past 1, 5, and 15 minutes"。

你如果再去网上找资料，就会发现 Load Average 是一个很古老的概念了。上个世纪 70 年代，早期的 Unix 系统上就已经有了这个 Load Average，IETF 还有一个RFC546定义了 Load Average，这里定义的 Load Average 是一种 CPU 资源需求的度量。

举个例子，对于一个单个 CPU 的系统，如果在 1 分钟的时间里，处理器上始终有一个进程在运行，同时操作系统的进程可运行队列中始终都有 9 个进程在等待获取 CPU 资源。那么对于这 1 分钟的时间来说，系统的"load average"就是 1+9=10，这个定义对绝大部分的 Unix 系统都适用。

对于 Linux 来说，如果只考虑 CPU 的资源，Load Averag 等于单位时间内正在运行的进程加上可运行队列的进程，这个定义也是成立的。通过这个定义和我自己的观察，我给你归纳了下面三点对 Load Average 的理解。

第一，不论计算机 CPU 是空闲还是满负载，Load Average 都是 Linux 进程调度器中可运行队列（Running Queue）里的一段时间的平均进程数目。

第二，计算机上的 CPU 还有空闲的情况下，CPU Usage 可以直接反映到"load average"上，什么是 CPU 还有空闲呢？具体来说就是可运行队列中的进程数目小于 CPU 个数，这种情况下，单位时间进程 CPU Usage 相加的平均值应该就是"load average"的值。

第三，计算机上的 CPU 满负载的情况下，计算机上的 CPU 已经是满负载了，同时还有更多的进程在排队需要 CPU 资源。这时"load average"就不能和 CPU Usage 等同了。

比如对于单个 CPU 的系统，CPU Usage 最大只是有 100%，也就 1 个 CPU；而"load average"的值可以远远大于 1，因为"load average"看的是操作系统中可运行队列中进程的个数。

我们是不是就可以认定 Load Average 就代表一段时间里运行队列中需要被调度的进程或者线程平均数目了呢? 或许对其他的 Unix 系统来说，这个理解已经够了，但是对于 Linux 系统还不能这么认定。

为什么这么说呢？故事还要从 Linux 早期的历史说起，那时开发者 Matthias 有这么一个发现，比如把快速的磁盘换成了慢速的磁盘，运行同样的负载，系统的性能是下降的，但是 Load Average 却没有反映出来。

他发现这是因为 Load Average 只考虑运行态的进程数目，而没有考虑等待 I/O 的进程。所以，他认为 Load Average 如果只是考虑进程运行队列中需要被调度的进程或线程平均数目是不够的，因为对于处于 I/O 资源等待的进程都是处于 TASK_UNINTERRUPTIBLE 状态的。

那他是怎么处理这件事的呢？估计你也猜到了，他给内核加一个 patch（补丁），把处于 TASK_UNINTERRUPTIBLE 状态的进程数目也计入了 Load Average 中。

在这里我们又提到了 TASK_UNINTERRUPTIBLE 状态的进程，在前面的章节中我们介绍过，我再给你强调一下，TASK_UNINTERRUPTIBLE 是 Linux 进程状态的一种，是进程为等待某个系统资源而进入了睡眠的状态，并且这种睡眠的状态是不能被信号打断的。

下面就是 1993 年 Matthias 的 kernel patch，你有兴趣的话，可以读一下。

```text
From: Matthias Urlichs <urlichs@smurf.sub.org>
Subject: Load average broken ?
Date: Fri, 29 Oct 1993 11:37:23 +0200

The kernel only counts "runnable" processes when computing the load average.
I don't like that; the problem is that processes which are swapping or
waiting on "fast", i.e. noninterruptible, I/O, also consume resources.

It seems somewhat nonintuitive that the load average goes down when you
replace your fast swap disk with a slow swap disk...

Anyway, the following patch seems to make the load average much more
consistent WRT the subjective speed of the system. And, most important, the
load is still zero when nobody is doing anything. ;-)

--- kernel/sched.c.orig Fri Oct 29 10:31:11 1993
+++ kernel/sched.c Fri Oct 29 10:32:51 1993
@@ -414,7 +414,9 @@
unsigned long nr = 0;

    for(p = &LAST_TASK; p > &FIRST_TASK; --p)
-       if (*p && (*p)->state == TASK_RUNNING)
+       if (*p && ((*p)->state == TASK_RUNNING) ||
+                  (*p)->state == TASK_UNINTERRUPTIBLE) ||
+                  (*p)->state == TASK_SWAPPING))
            nr += FIXED_1;
    return nr;
 }
```

那么对于 Linux 的 Load Average 来说，除了可运行队列中的进程数目，等待队列中的 UNINTERRUPTIBLE 进程数目也会增加 Load Average。

到这里我们就可以准确定义 Linux 系统里的 Load Average 了，其实也很简单，你只需要记住，平均负载统计了这两种情况的进程：

第一种是 Linux 进程调度器中可运行队列（Running Queue）一段时间（1 分钟，5 分钟，15 分钟）的进程平均数。

第二种是 Linux 进程调度器中休眠队列（Sleeping Queue）里的一段时间的 TASK_UNINTERRUPTIBLE 状态下的进程平均数。

所以，最后的公式就是：Load Average= 可运行队列进程平均数 + 休眠队列中不可打断的进程平均数

如果打个比方来说明 Load Average 的统计原理。你可以想象每个 CPU 就是一条道路，每个进程都是一辆车，怎么科学统计道路的平均负载呢？就是看单位时间通过的车辆，一条道上的车越多，那么这条道路的负载也就越高。

此外，Linux 计算系统负载的时候，还额外做了个补丁把 TASK_UNINTERRUPTIBLE 状态的进程也考虑了，这个就像道路中要把红绿灯情况也考虑进去。一旦有了红灯，汽车就要停下来排队，那么即使道路很空，但是红灯多了，汽车也要排队等待，也开不快。

*现象解释：为什么 Load Average 会升高？*

解释了 Load Average 这个概念，我们再回到这一讲最开始的问题，为什么对容器已经用 CPU Cgroup 限制了它的 CPU Usage，容器里的进程还是可以造成整个系统很高的 Load Average。

我们理解了 Load Average 这个概念之后，就能区分出 Load Averge 和 CPU 使用率的区别了。那么这个看似矛盾的问题也就很好回答了，因为 Linux 下的 Load Averge 不仅仅计算了 CPU Usage 的部分，它还计算了系统中 TASK_UNINTERRUPTIBLE 状态的进程数目。

讲到这里为止，我们找到了第一个问题的答案，那么现在我们再看第二个问题：如果 Load Average 值升高，应用的性能已经下降了，真正的原因是什么？问题就出在 TASK_UNINTERRUPTIBLE 状态的进程上了。

怎么验证这个判断呢？这时候我们只要运行 ps aux | grep “ D ” ，就可以看到容器中有多少 TASK_UNINTERRUPTIBLE 状态（在 ps 命令中这个状态的进程标示为"D"状态）的进程，为了方便理解，后面我们简称为 D 状态进程。而正是这些 D 状态进程引起了 Load Average 的升高。

找到了 Load Average 升高的问题出在 D 状态进程了，我们想要真正解决问题，还有必要了解 D 状态进程产生的本质是什么？

在 Linux 内核中有数百处调用点，它们会把进程设置为 D 状态，主要集中在 disk I/O 的访问和信号量（Semaphore）锁的访问上，因此 D 状态的进程在 Linux 里是很常见的。

无论是对 disk I/O 的访问还是对信号量的访问，都是对 Linux 系统里的资源的一种竞争。当进程处于 D 状态时，就说明进程还没获得资源，这会在应用程序的最终性能上体现出来，也就是说用户会发觉应用的性能下降了。

那么 D 状态进程导致了性能下降，我们肯定是想方设法去做调试的。但目前 D 状态进程引起的容器中进程性能下降问题，Cgroups 还不能解决，这也就是为什么我们用 Cgroups 做了配置，即使保证了容器的 CPU 资源， 容器中的进程还是运行很慢的根本原因。

这里我们进一步做分析，为什么 CPU Cgroups 不能解决这个问题呢？就是因为 Cgroups 更多的是以进程为单位进行隔离，而 D 状态进程是内核中系统全局资源引入的，所以 Cgroups 影响不了它。

#所以我们可以做的是，在生产环境中监控容器的宿主机节点里 D 状态的进程数量，然后对 D 状态进程数目异常的节点进行分析，比如磁盘硬件出现问题引起 D 状态进程数目增加，这时就需要更换硬盘。#

![[image-2025-02-13-21-36-10-865.png]]

因为 TASK_UNINTERRUPTIBLE 状态的进程同样也会竞争系统资源，所以它会影响到应用程序的性能。我们可以在容器宿主机的节点对 D 状态进程做监控，定向分析解决。

### 容器内存

#### 我的容器为什么被杀了？

不知道你在使用容器时，有没有过这样的经历？一个容器在系统中运行一段时间后，突然消失了，看看自己程序的 log 文件，也没发现什么错误，不像是自己程序 Crash，但是容器就是消失了。

容器在系统中被杀掉，其实只有一种情况，那就是容器中的进程使用了太多的内存。具体来说，就是容器里所有进程使用的内存量，超过了容器所在 Memory Cgroup 里的内存限制。这时 Linux 系统就会主动杀死容器中的一个进程，往往这会导致整个容器的退出。

*如何理解 OOM Killer？*

OOM 是 Out of Memory 的缩写，顾名思义就是内存不足的意思，而 Killer 在这里指需要杀死某个进程。那么 OOM Killer 就是在 Linux 系统里如果内存不足时，就需要杀死一个正在运行的进程来释放一些内存。

在 Linux 内核里有一个 oom_badness() 函数，就是它定义了选择进程的标准。

- 第一，进程已经使用的物理内存页面数。
- 第二，每个进程的 OOM 校准值 oom_score_adj。在 /proc 文件系统中，每个进程都有一个 /proc/[pid]/oom_score_adj 的接口文件。我们可以在这个文件中输入 -1000 到 1000 之间的任意一个数值，调整进程被 OOM Kill 的几率。

```bash
adj = (long)p->signal->oom_score_adj;

points = get_mm_rss(p->mm) + get_mm_counter(p->mm, MM_SWAPENTS) +mm_pgtables_bytes(p->mm) / PAGE_SIZE;

adj *= totalpages / 1000;
points += adj;
```

函数 oom_badness() 里的最终计算方法是这样的：用系统总的可用页面数，去乘以 OOM 校准值 oom_score_adj，再加上进程已经使用的物理页面数，计算出来的值越大，那么这个进程被 OOM Kill 的几率也就越大。

*如何理解 Memory Cgroup？*

前面我们介绍了 OOM Killer，容器发生 OOM Kill 大多是因为 Memory Cgroup 的限制所导致的，所以在我们还需要理解 Memory Cgroup 的运行机制。

Memory Cgroup 也是 Linux Cgroups 子系统之一，它的作用是对一组进程的 Memory 使用做限制。Memory Cgroup 的虚拟文件系统的挂载点一般在"/sys/fs/cgroup/memory"这个目录下

#### Linux 内存类型

Linux 的各个模块都需要内存，比如内核需要分配内存给页表，内核栈，还有 slab，也就是内核各种数据结构的 Cache Pool；用户态进程里的堆内存和栈的内存，共享库的内存，还有文件读写的 Page Cache。

我们讨论的 Memory Cgroup 里都不会对内核的内存做限制（比如页表，slab 等）。所以我们今天主要讨论与用户态相关的两个内存类型，RSS 和 Page Cache。

*RSS*

RSS 是 Resident Set Size 的缩写，简单来说它就是指进程真正申请到物理页面的内存大小。这是什么意思呢？

应用程序在申请内存的时候，比如说，调用 malloc() 来申请 100MB 的内存大小，malloc() 返回成功了，这时候系统其实只是把 100MB 的虚拟地址空间分配给了进程，但是并没有把实际的物理内存页面分配给进程。

上一讲中，我给你讲过，当进程对这块内存地址开始做真正读写操作的时候，系统才会把实际需要的物理内存分配给进程。而这个过程中，进程真正得到的物理内存，就是这个 RSS 了

比如下面的这段代码，我们先用 malloc 申请 100MB 的内存。

```c
#include <stdio.h>
#include <stdlib.h>

int main()
{
    char *p = (char *)malloc(100 * 1024 * 1024);
    printf("p = %p\n", p);
    return 0;
}
```

通过top命令查看malloc之后，对应进程的虚拟地址空间(VIRT)已经有100MB，但是实际物理内存RSS（TOP命令显示的是RES，就是Resident的简写，和RSS是一个意思）在这里只有688KB。

在上面程序的基础之上，等待30s我们对申请的内存中写入20M的数据，然后哦再使用top命令查看

```c
sleep(30);
memset(p, 0x00, 20 * MB)
```

这时候可以看到虚拟地址空间（VIRT）还是 106728，不过物理内存 RSS（RES）的值变成了 21432（大小约为 20MB）， 这里的单位都是 KB。

RSS 就是进程里真正获得的物理内存大小。

对于进程来说，RSS 内存包含了进程的代码段内存，栈内存，堆内存，共享库的内存, 这些内存是进程运行所必须的。刚才我们通过 malloc/memset 得到的内存，就是属于堆内存。

具体的每一部分的 RSS 内存的大小，你可以查看 /proc/[pid]/smaps 文件。

*Page Cache*

每个进程除了各自独立分配到的 RSS 内存外，如果进程对磁盘上的文件做了读写操作，Linux 还会分配内存，把磁盘上读写到的页面存放在内存中，这部分的内存就是 Page Cache。

Page Cache 的主要作用是提高磁盘文件的读写性能，因为系统调用 read() 和 write() 的缺省行为都会把读过或者写过的页面存放在 Page Cache 里。

代码程序去读取 100MB 的文件，在读取文件前，系统中 Page Cache 的大小是 388MB，读取后 Page Cache 的大小是 506MB，增长了大约 100MB 左右，多出来的这 100MB，正是我们读取文件的大小。

![[image-2025-02-14-13-59-12-242.png]]

在 Linux 系统里只要有空闲的内存，系统就会自动地把读写过的磁盘文件页面放入到 Page Cache 里。那么这些内存都被 Page Cache 占用了，一旦进程需要用到更多的物理内存，执行 malloc() 调用做申请时，就会发现剩余的物理内存不够了，那该怎么办呢？

这就要提到 Linux 的内存管理机制了。 Linux 的内存管理有一种内存页面回收机制（page frame reclaim），会根据系统里空闲物理内存是否低于某个阈值（wartermark），来决定是否启动内存的回收。

内存回收的算法会根据不同类型的内存以及内存的最近最少用原则，就是 LRU（Least Recently Used）算法决定哪些内存页面先被释放。因为 Page Cache 的内存页面只是起到 Cache 作用，自然是会被优先释放的。

所以，Page Cache 是一种为了提高磁盘文件读写性能而利用空闲物理内存的机制。同时，内存管理中的页面回收机制，又能保证 Cache 所占用的页面可以及时释放，这样一来就不会影响程序对内存的真正需求了。


##### RSS & Page Cache in Memory Cgroup

学习了 RSS 和 Page Cache 的基本概念之后，我们下面来看不同类型的内存，特别是 RSS 和 Page Cache 是如何影响 Memory Cgroup 的工作的。

我们先从 Linux 的内核代码看一下，从 mem_cgroup_charge_statistics() 这个函数里，我们可以看到 Memory Cgroup 也的确只是统计了 RSS 和 Page Cache 这两部分的内存。

RSS 的内存，就是在当前 Memory Cgroup 控制组里所有进程的 RSS 的总和；而 Page Cache 这部分内存是控制组里的进程读写磁盘文件后，被放入到 Page Cache 里的物理内存。

![[image-2025-02-14-16-32-15-070.png]]

Memory Cgroup 控制组里 RSS 内存和 Page Cache 内存的和，正好是 memory.usage_in_bytes 的值。

当控制组里的进程需要申请新的物理内存，而且 memory.usage_in_bytes 里的值超过控制组里的内存上限值 memory.limit_in_bytes，这时我们前面说的 Linux 的内存回收（page frame reclaim）就会被调用起来。

那么在这个控制组里的 page cache 的内存会根据新申请的内存大小释放一部分，这样我们还是能成功申请到新的物理内存，整个控制组里总的物理内存开销 memory.usage_in_bytes 还是不会超过上限值 memory.limit_in_bytes。

![[image-2025-02-14-16-47-00-686.png]]

`20211300 - 7222656 = 12988644` 在free命令中，total-free=available,也就是说linux计算真实可用内存时并没有考虑Page Cache，因为在需要时会对page cache进行回收，所以free命令中看到的可用内存会比实际可用内存少。

### 容器磁盘

#### Swap：容器可以使用Swap空间吗？

用过 Linux 的同学应该都很熟悉 Swap 空间了，简单来说它就是就是一块磁盘空间。

当内存写满的时候，就可以把内存中不常用的数据暂时写到这个 Swap 空间上。这样一来，内存空间就可以释放出来，用来满足新的内存申请的需求。

它的好处是可以应对一些瞬时突发的内存增大需求，不至于因为内存一时不够而触发 OOM Killer，导致进程被杀死。

那么对于一个容器，特别是容器被设置了 Memory Cgroup 之后，它还可以使用 Swap 空间吗？会不会出现什么问题呢？

为没有swap的节点添加swap

![[image-2025-02-14-16-58-59-791.png]]

因为有了 Swap 空间，本来会被 OOM Kill 的容器，可以好好地运行了。初看这样似乎也挺好的，不过你仔细想想，这样一来，Memory Cgroup 对内存的限制不就失去了作用么？

我们再进一步分析，如果一个容器中的程序发生了内存泄漏（Memory leak），那么本来 Memory Cgroup 可以及时杀死这个进程，让它不影响整个节点中的其他应用程序。结果现在这个内存泄漏的进程没被杀死，还会不断地读写 Swap 磁盘，反而影响了整个节点的性能。

*如何正确理解 swappiness 参数？*

在普通 Linux 系统上，如果你使用过 Swap 空间，那么你可能配置过 proc 文件系统下的 swappiness 这个参数 (/proc/sys/vm/swappiness)。swappiness 的定义在Linux 内核文档中可以找到，就是下面这段话。

> swappiness
This control is used to define how aggressive the kernel will swap memory pages. Higher values will increase aggressiveness, lower values decrease the amount of swap. A value of 0 instructs the kernel not to initiate swap until the amount of free and file-backed pages is less than the high water mark in a zone.
The default value is 60.

前面两句话大致翻译过来，意思就是 swappiness 可以决定系统将会有多频繁地使用交换分区。

在有磁盘文件访问的时候，Linux 会尽量把系统的空闲内存用作 Page Cache 来提高文件的读写性能。在没有打开 Swap 空间的情况下，一旦内存不够，这种情况下就只能把 Page Cache 释放了，而 RSS 内存是不能释放的。

在 RSS 里的内存，大部分都是没有对应磁盘文件的内存，比如用 malloc() 申请得到的内存，这种内存也被称为匿名内存（Anonymous memory）。那么当 Swap 空间打开后，可以写入 Swap 空间的，就是这些匿名内存。

所以在 Swap 空间打开的时候，问题也就来了，在内存紧张的时候，Linux 系统怎么决定是先释放 Page Cache，还是先把匿名内存释放并写入到 Swap 空间里呢？

我们一起来分析分析，都可能发生怎样的情况。最可能发生的是下面两种情况：

第一种情况是，如果系统先把 Page Cache 都释放了，那么一旦节点里有频繁的文件读写操作，系统的性能就会下降。

还有另一种情况，如果 Linux 系统先把匿名内存都释放并写入到 Swap，那么一旦这些被释放的匿名内存马上需要使用，又需要从 Swap 空间读回到内存中，这样又会让 Swap（其实也是磁盘）的读写频繁，导致系统性能下降。

显然，我们在释放内存的时候，需要平衡 Page Cache 的释放和匿名内存的释放，而 swappiness，就是用来定义这个平衡的参数。

那么 swappiness 具体是怎么来控制这个平衡的？我们看一下在 Linux 内核代码里是怎么用这个 swappiness 参数。

我们前面说了 swappiness 的这个值的范围是 0 到 100，但是请你一定要注意，它不是一个百分比，更像是一个权重。它是用来定义 Page Cache 内存和匿名内存的释放的一个比例。

我们可以看到，这个比例是 anon_prio: file_prio，这里 anon_prio 的值就等于 swappiness。下面我们分三个情况做讨论：

第一种情况，当 swappiness 的值是 100 的时候，匿名内存和 Page Cache 内存的释放比例就是 100: 100，也就是等比例释放了。

第二种情况，就是 swappiness 缺省值是 60 的时候，匿名内存和 Page Cache 内存的释放比例就是 60 : 140，Page Cache 内存的释放要优先于匿名内存。

```c
/*
 * With swappiness at 100, anonymous and file have the same priority.
 * This scanning priority is essentially the inverse of IO cost.
 */

anon_prio = swappiness;
file_prio = 200 - anon_prio;
```

再看一下那段 swappiness 的英文定义，里面特别强调了 swappiness 为 0 的情况。

当空闲内存少于内存一个 zone (/proc/zoneinfo 中的normal zone)的"high water mark"中的值的时候，Linux 还是会做内存交换，也就是把匿名内存写入到 Swap 空间后释放内存。

在这里 zone 是 Linux 划分物理内存的一个区域，里面有 3 个水位线（water mark），水位线可以用来警示空闲内存的紧张程度。

swappiness 的取值范围在 0 到 100，值为 100 的时候系统平等回收匿名内存和 Page Cache 内存；一般缺省值为 60，就是优先回收 Page Cache；即使 swappiness 为 0，也不能完全禁止 Swap 分区的使用，就是说在内存紧张的时候，也会使用 Swap 来回收匿名内存。

swappiness 的取值范围在 0 到 100，值为 100 的时候系统平等回收匿名内存和 Page Cache 内存；一般缺省值为 60，就是优先回收 Page Cache；即使 swappiness 为 0，也不能完全禁止 Swap 分区的使用，就是说在内存紧张的时候，也会使用 Swap 来回收匿名内存。

有了"memory.swappiness = 0"的配置和功能，就可以对控制指定容器不能使用swap空间了。

#### 容器文件系统：在容器中读写文件怎么变慢了

> 使用到开源磁盘I/O测试工具fio。

```bash
# fio -direct=1 -iodepth=64 -rw=read -ioengine=libaio -bs=4k -size=10G -numjobs=1  -name=./fio.test
```

第一个参数是"-direct=1"，代表采用非 buffered I/O 文件读写的方式，避免文件读写过程中内存缓冲对性能的影响。

接着我们来看这"-iodepth=64"和"-ioengine=libaio"这两个参数，这里指文件读写采用异步 I/O（Async I/O）的方式，也就是进程可以发起多个 I/O 请求，并且不用阻塞地等待 I/O 的完成。稍后等 I/O 完成之后，进程会收到通知。

这种异步 I/O 很重要，因为它可以极大地提高文件读写的性能。在这里我们设置了同时发出 64 个 I/O 请求。

然后是"-rw=read，-bs=4k，-size=10G"，这几个参数指这个测试是个读文件测试，每次读 4KB 大小数块，总共读 10GB 的数据。

最后一个参数是"-numjobs=1"，指只有一个进程 / 线程在运行。

```bash
grafana-8465555dc4-q7r8h:~# df
Filesystem           1K-blocks      Used Available Use% Mounted on
overlay              1060941856  93000964 913974252   9% /
```

##### 如何理解容器文件系统？

我们在容器里，运行 df 命令，你可以看到在容器中根目录 (/) 的文件系统类型是"overlay"，它不是我们在普通 Linux 节点上看到的 Ext4 或者 XFS 之类常见的文件系统。

为了有效地减少磁盘上冗余的镜像数据，同时减少冗余的镜像数据在网络上的传输，选择一种针对于容器的文件系统是很有必要的，而这类的文件系统被称为 UnionFS。

UnionFS 这类文件系统实现的主要功能是把多个目录（处于不同的分区）一起挂载（mount）在一个目录下。这种多目录挂载的方式，正好可以解决我们刚才说的容器镜像的问题。

![[image-2025-02-14-18-01-58-343.png]]

##### OverlayFS

UnionFS 类似的有很多种实现，包括在 Docker 里最早使用的 AUFS，还有目前我们使用的 OverlayFS。前面我们在运行df的时候，看到的文件系统类型"overlay"指的就是 OverlayFS。

在 Linux 内核 3.18 版本中，OverlayFS 代码正式合入 Linux 内核的主分支。在这之后，OverlayFS 也就逐渐成为各个主流 Linux 发行版本里缺省使用的容器文件系统了。

先，最下面的"lower/"，也就是被 mount 两层目录中底下的这层（lowerdir）。

在 OverlayFS 中，最底下这一层里的文件是不会被修改的，你可以认为它是只读的。我还想提醒你一点，在这个例子里我们只有一个 lower/ 目录，不过 OverlayFS 是支持多个 lowerdir 的。

然后我们看"uppder/"，它是被 mount 两层目录中上面的这层 （upperdir）。在 OverlayFS 中，如果有文件的创建，修改，删除操作，那么都会在这一层反映出来，它是可读写的。

接着是最上面的"merged" ，它是挂载点（mount point）目录，也是用户看到的目录，用户的实际文件操作在这里进行。

其实还有一个"work/"，这个目录没有在这个图里，它只是一个存放临时文件的目录，OverlayFS 中如果有文件修改，就会在中间过程中临时存放文件到这里。

![[containerd/image-2025-02-14-18-14-40-062.png]]


从这个例子我们可以看到，OverlayFS 会 mount 两层目录，分别是 lower 层和 upper 层，这两层目录中的文件都会映射到挂载点上。

从挂载点的视角看，upper 层的文件会覆盖 lower 层的文件，比如"in_both.txt"这个文件，在 lower 层和 upper 层都有，但是挂载点 merged/ 里看到的只是 upper 层里的 in_both.txt.

如果我们在 merged/ 目录里做文件操作，具体包括这三种。

第一种，新建文件，这个文件会出现在 upper/ 目录中。

第二种是删除文件，如果我们删除"in_upper.txt"，那么这个文件会在 upper/ 目录中消失。如果删除"in_lower.txt", 在 lower/ 目录里的"in_lower.txt"文件不会有变化，只是在 upper/ 目录中增加了一个特殊文件来告诉 OverlayFS，"in_lower.txt'这个文件不能出现在 merged/ 里了，这就表示它已经被删除了。

![[image-2025-02-14-18-15-13-311.png]]

还有一种操作是修改文件，类似如果修改"in_lower.txt"，那么就会在 upper/ 目录中新建一个"in_lower.txt"文件，包含更新的内容，而在 lower/ 中的原来的实际文件"in_lower.txt"不会改变。

OverlayFS 也是把多个目录合并挂载，被挂载的目录分为两大类：lowerdir 和 upperdir。

lowerdir 允许有多个目录，在被挂载后，这些目录里的文件都是不会被修改或者删除的，也就是只读的；upperdir 只有一个，不过这个目录是可读写的，挂载点目录中的所有文件修改都会在 upperdir 中反映出来。

容器的镜像文件中各层正好作为 OverlayFS 的 lowerdir 的目录，然后加上一个空的 upperdir 一起挂载好后，就组成了容器的文件系统。


#### 容器为什么把宿主机的磁盘写满了？

文件系统 OverlayFS，这个 OverlayFS 有两层，分别是 lowerdir 和 upperdir。lowerdir 里是容器镜像中的文件，对于容器来说是只读的；upperdir 存放的是容器对文件系统里的所有改动，它是可读写的。

从宿主机的角度看，upperdir 就是一个目录，如果容器不断往容器文件系统中写入数据，实际上就是往宿主机的磁盘上写数据，这些数据也就存在于宿主机的磁盘目录中。

```bash
# 生成一个1024M大小的文件
dd if=/dev/zero of=/tmp/test.log bs=1M count=1024
```

我们还是继续看宿主机，看看 OverlayFS 里 upperdir 目录中有什么文件？

这里我们仍然可以通过 /proc/mounts 这个路径，找到容器 OverlayFS 对应的 lowerdir 和 upperdir。因为写入的数据都在 upperdir 里，我们就只要看 upperdir 对应的那个目录就行了。果然，里面存放着容器写入的文件 test.log，它的大小是 10GB。

![[image-2025-02-14-18-34-32-437.png]]

通过这个例子，我们已经验证了在容器中对于 OverlayFS 中写入数据，其实就是往宿主机的一个目录（upperdir）里写数据。

#### 容器磁盘限速：我的容器里磁盘读写为什么不稳定?

不过容器文件系统并不适合频繁地读写。对于频繁读写的数据，容器需要把他们到放到"volume"中。这里的 volume 可以是一个本地的磁盘，也可以是一个网络磁盘。

通过上节我们知道容器的文件其实也是存储在宿主机的磁盘上，所以容器的文件读写其实也是对宿主机磁盘的读写。那么理论上，容器的文件读写应该和宿主机的磁盘读写是平级的。但是实际上，容器的文件读写会比宿主机的磁盘读写慢一点，问题也是出在OverlayFS 上。

- 如果写的文件是在lowerdir上，那么写文件时需要先将lowerdir中的文件复制到upperdir上
- 文件是分层的，每次查找文件需要再不同层找，索引时间慢，特别是处理大量小文件时，性能会严重下降

##### Direct I/O 和 Buffered I/O

用户进程如果要写磁盘文件，就会通过 Linux 内核的文件系统层(filesystem) -> 块设备层 (block layer) -> 磁盘驱动 -> 磁盘硬件，这样一路下去写入磁盘

而如果是 Buffered I/O 模式，那么用户进程只是把文件数据写到内存中（Page Cache）就返回了，而 Linux 内核自己有线程会把内存中的数据再写入到磁盘中。在 Linux 里，由于考虑到性能问题，绝大多数的应用都会使用 Buffered I/O 模式

![[image-2025-02-17-20-14-26-591.png]]

### 容器中的内存与I/O：容器写文件的延时为什么波动很大？

.在主机上是灰色线，在容器中是红色线
![[image-2025-02-17-20-29-40-801.png]]

结果很明显，在容器中写入数据块的时间会时不时地增高到 200us；而在虚拟机里的写入数据块时间就比较平稳，一直在 30～50us 这个范围内。

我们对文件的写入操作是 Buffered I/O。在前一讲中，我们其实已经知道了，对于 Buffer I/O，用户的数据是先写入到 Page Cache 里的。而这些写入了数据的内存页面，在它们没有被写入到磁盘文件之前，就被叫作 dirty pages。

Linux 内核会有专门的内核线程（每个磁盘设备对应的 kworker/flush 线程）把 dirty pages 写入到磁盘中。那我们自然会这样猜测，也许是 Linux 内核对 dirty pages 的操作影响了 Buffered I/O 的写操作？

想要验证这个想法，我们需要先来看看 dirty pages 是在什么时候被写入到磁盘的。这里就要用到 /proc/sys/vm 里和 dirty page 相关的内核参数了，我们需要知道所有相关参数的含义，才能判断出最后真正导致问题发生的原因。

现在我们挨个来看一下。为了方便后面的讲述，我们可以设定一个比值 A，A 等于 dirty pages 的内存 / 节点可用内存 *100%。

第一个参数，dirty_background_ratio，这个参数里的数值是一个百分比值，缺省是 10%。如果比值 A 大于 dirty_background_ratio 的话，比如大于默认的 10%，内核 flush 线程就会把 dirty pages 刷到磁盘里。

第二个参数，是和 dirty_background_ratio 相对应一个参数，也就是 dirty_background_bytes，它和 dirty_background_ratio 作用相同。区别只是 dirty_background_bytes 是具体的字节数，它用来定义的是 dirty pages 内存的临界值，而不是比例值。

这里你还要注意，dirty_background_ratio 和 dirty_background_bytes 只有一个可以起作用，如果你给其中一个赋值之后，另外一个参数就归 0 了。

接下来我们看第三个参数，dirty_ratio，这个参数的数值也是一个百分比值，缺省是 20%。

如果比值 A，大于参数 dirty_ratio 的值，比如大于默认设置的 20%，这时候正在执行 Buffered I/O 写文件的进程就会被阻塞住，直到它写的数据页面都写到磁盘为止。

同样，第四个参数 dirty_bytes 与 dirty_ratio 相对应，它们的关系和 dirty_background_ratio 与 dirty_background_bytes 一样。我们给其中一个赋值后，另一个就会归零。

然后我们来看 dirty_writeback_centisecs，这个参数的值是个时间值，以百分之一秒为单位，缺省值是 500，也就是 5 秒钟。它表示每 5 秒钟会唤醒内核的 flush 线程来处理 dirty pages。

最后还有 dirty_expire_centisecs，这个参数的值也是一个时间值，以百分之一秒为单位，缺省值是 3000，也就是 30 秒钟。它定义了 dirty page 在内存中存放的最长时间，如果一个 dirty page 超过这里定义的时间，那么内核的 flush 线程也会把这个页面写入磁盘。

```bash
watch -n 1 "cat /proc/vmstat | grep dirty"
```

好了，从这些 dirty pages 相关的参数定义，你会想到些什么呢？

进程写操作上的时间波动，只有可能是因为 dirty pages 的数量很多，已经达到了第三个参数 dirty_ratio 的值。这时执行写文件功能的进程就会被暂停，直到写文件的操作将数据页面写入磁盘，写文件的进程才能继续运行，所以进程里一次写文件数据块的操作时间会增加。

刚刚说的是我们的推理，那情况真的会是这样吗？

其实我们还可以再做个实验，就是在 dirty_bytes 和 dirty_background_bytes 里写入一个很小的值。

```bash
echo 8192 > /proc/sys/vm/dirty_bytes
echo 4096 > /proc/sys/vm/dirty_background_bytes
```

然后再记录一下容器程序里每写入 64KB 数据块的时间，这时候，我们就会看到，时不时一次写入的时间就会达到 9ms，这已经远远高于我们之前看到的 200us 了。

因此，我们可以知道了这个时间的波动，并不是强制把 dirty page 写入到磁盘引起的。

#### 调试问题

那接下来，我们还能怎么分析这个问题呢？

第一步，我们要找到内核中 write() 这个系统调用函数下，又调用了哪些子函数。想找出主要的子函数我们可以查看代码，也可以用 perf 这个工具来得到。

然后是第二步，得到了 write() 的主要子函数之后，我们可以用 ftrace 这个工具来 trace 这些函数的执行时间，这样就可以找到花费时间最长的函数了。

.使用record追踪对应进程的系统函数调用
```bash
# pid 为容器进程的 pid
perf record -a -g -p <pid>
```

![[image-2025-02-17-20-44-02-504.png]]

把主要的函数写入到 ftrace 的 set_ftrace_filter 里, 然后把 ftrace 的 tracer 设置为 function_graph，并且打开 tracing_on 开启追踪。

```bash
# cd /sys/kernel/debug/tracing
# echo vfs_write >> set_ftrace_filter
# echo xfs_file_write_iter >> set_ftrace_filter
# echo xfs_file_buffered_aio_write >> set_ftrace_filter
# echo iomap_file_buffered_write
# echo iomap_file_buffered_write >> set_ftrace_filter
# echo pagecache_get_page >> set_ftrace_filter
# echo try_to_free_mem_cgroup_pages >> set_ftrace_filter
# echo try_charge >> set_ftrace_filter
# echo mem_cgroup_try_charge >> set_ftrace_filter

# echo function_graph > current_tracer
# echo 1 > tracing_on
```

这些设置完成之后，我们再运行一下容器中的写磁盘程序，同时从 ftrace 的 trace_pipe 中读取出追踪到的这些函数。

这时我们可以看到，当需要申请 Page Cache 页面的时候，write() 系统调用会反复地调用 mem_cgroup_try_charge()，并且在释放页面的时候，函数 do_try_to_free_pages() 花费的时间特别长，有 50+us（时间单位，micro-seconds）这么多。

```bash
  1)               |  vfs_write() {
  1)               |    xfs_file_write_iter [xfs]() {
  1)               |      xfs_file_buffered_aio_write [xfs]() {
  1)               |        iomap_file_buffered_write() {
  1)               |          pagecache_get_page() {
  1)               |            mem_cgroup_try_charge() {
  1)   0.338 us    |              try_charge();
  1)   0.791 us    |            }
  1)   4.127 us    |          }
…

  1)               |          pagecache_get_page() {
  1)               |            mem_cgroup_try_charge() {
  1)               |              try_charge() {
  1)               |                try_to_free_mem_cgroup_pages() {
  1) + 52.798 us   |                  do_try_to_free_pages();
  1) + 53.958 us   |                }
  1) + 54.751 us   |              }
  1) + 55.188 us   |            }
  1) + 56.742 us   |          }
…
  1) ! 109.925 us  |        }
  1) ! 110.558 us  |      }
  1) ! 110.984 us  |    }
  1) ! 111.515 us  |  }
```

看到这个 ftrace 的结果，你是不是会想到，我们在容器内存那一讲中提到的 Page Cahe 呢？

是的，这个问题的确和 Page Cache 有关，Linux 会把所有的空闲内存利用起来，一旦有 Buffered I/O，这些内存都会被用作 Page Cache。

当容器加了 Memory Cgroup 限制了内存之后，对于容器里的 Buffered I/O，就只能使用容器中允许使用的最大内存来做 Page Cache。

*那么如果容器在做内存限制的时候，Cgroup 中 memory.limit_in_bytes 设置得比较小，而容器中的进程又有很大量的 I/O，这样申请新的 Page Cache 内存的时候，又会不断释放老的内存页面，这些操作就会带来额外的系统开销了。*

#### 总结

当 dirty pages 数量超过 dirty_background_ratio 对应的内存量的时候，内核 flush 线程就会开始把 dirty pages 写入磁盘 ; 当 dirty pages 数量超过 dirty_ratio 对应的内存量，这时候程序写文件的函数调用 write() 就会被阻塞住，直到这次调用的 dirty pages 全部写入到磁盘。

在节点是大内存容量，并且 dirty_ratio 为系统缺省值 20%，dirty_background_ratio 是系统缺省值 10% 的情况下，我们通过观察 /proc/vmstat 中的 nr_dirty 数值可以发现，dirty pages 不会阻塞进程的 Buffered I/O 写文件操作。

所以我们做了另一种尝试，使用 perf 和 ftrace 工具对容器中的写文件进程进行 profile。我们用 perf 得到了系统调用 write() 在内核中的一系列子函数调用，再用 ftrace 来查看这些子函数的调用时间。

根据 ftrace 的结果，我们发现写数据到 Page Cache 的时候，需要不断地去释放原有的页面，这个时间开销是最大的。造成容器中 Buffered I/O write() 不稳定的原因，正是容器在限制内存之后，Page Cache 的数量较小并且不断申请释放。

其实这个问题也提醒了我们：在对容器做 Memory Cgroup 限制内存大小的时候，不仅要考虑容器中进程实际使用的内存量，还要考虑容器中程序 I/O 的量，合理预留足够的内存作为 Buffered I/O 的 Page Cache。

### 容器网络

#### 容器网络：我修改了/proc/sys/net下的参数，为什么在容器中不起效？

*Network Namespace*

我们还是先来看看操作手册，在Linux Programmer’s Manual里对 Network Namespace 有一个段简短的描述，在里面就列出了最主要的几部分资源，它们都是通过 Network Namespace 隔离的。

我把这些资源给你做了一个梳理：

第一种，网络设备，这里指的是 lo，eth0 等网络设备。你可以可以通过 ip link命令看到它们。

第二种是 IPv4 和 IPv6 协议栈。从这里我们可以知道，IP 层以及上面的 TCP 和 UPD 协议栈也是每个 Namespace 独立工作的。

所以 IP、TCP、PUD 的很多协议，它们的相关参数也是每个 Namespace 独立的，这些参数大多数都在 /proc/sys/net/ 目录下面，同时也包括了 TCP 和 UPD 的 port 资源。

第三种，IP 路由表，这个资源也是比较好理解的，你可以在不同的 Network Namespace 运行 ip route 命令，就能看到不同的路由表了。

第四种是防火墙规则，其实这里说的就是 iptables 规则了，每个 Namespace 里都可以独立配置 iptables 规则。

最后一种是网络的状态信息，这些信息你可以从 /proc/net 和 /sys/class/net 里得到，这里的状态基本上包括了前面 4 种资源的的状态信息。

*Namespace 的操作*

我们可以通过系统调用 clone() 或者 unshare() 这两个函数来建立新的 Network Namespace。

第一种方法呢，是在新的进程创建的时候，伴随新进程建立，同时也建立出新的 Network Namespace。这个方法，其实就是通过 clone() 系统调用带上 CLONE_NEWNET flag 来实现的。

Clone 建立出来一个新的进程，这个新的进程所在的 Network Namespace 也是新的。然后我们执行 ip link 命令查看 Namespace 里的网络设备，就可以确认一个新的 Network Namespace 已经建立好了。

```bash
int new_netns(void *para)
{
            printf("New Namespace Devices:\n");
            system("ip link");
            printf("\n\n");

            sleep(100);
            return 0;
}

int main(void)
{
            pid_t pid;

            printf("Host Namespace Devices:\n");
            system("ip link");
            printf("\n\n");

            pid =
                clone(new_netns, stack + STACK_SIZE, CLONE_NEWNET | SIGCHLD, NULL);
            if (pid == -1)
                        errExit("clone");

            if (waitpid(pid, NULL, 0) == -1)
                        errExit("waitpid");

            return 0;
}
```

第二种方法呢，就是调用 unshare() 这个系统调用来直接改变当前进程的 Network Namespace。

```bash
int main(void)
{
            printf("Host Namespace Devices:\n");
            system("ip link");
            printf("\n\n");

            if (unshare(CLONE_NEWNET) == -1)
                        errExit("unshare");

            printf("New Namespace Devices:\n");
            system("ip link");
            printf("\n\n");

            sleep(100);
            return 0;
}
```

而创建容器的程序，比如runC也是用 unshare() 给新建的容器建立 Namespace 的。

```bash
# 使用 lsns -t net 查看网络命名空间
[root@k8smaster-73 ~]# lsns -t net
        NS TYPE NPROCS     PID USER                NETNSID NSFS                                                COMMAND
4026531840 net     321       1 root             unassigned                                                     /usr/lib/s
4026532402 net       3    2832 65535                     0 /run/netns/cni-8f11f12e-09f0-be9a-46a5-d0133fc14483 /pause
# 使用nsenter 进入命名空间，并执行ip addr查看网络设备
[root@k8smaster-73 ~]# nsenter -t 2832 -n ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
3: eth0@if5: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether ae:11:e8:06:52:97 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.225.160.84/32 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::ac11:e8ff:fe06:5297/64 scope link
       valid_lft forever preferred_lft forever
4: tunl0@NONE: <NOARP> mtu 1480 qdisc noop state DOWN group default qlen 1000
    link/ipip 0.0.0.0 brd 0.0.0.0
[root@k8smaster-73 ~]#
```

在我们的例子里 tcp_congestion_control 的值是从 Host Namespace 里继承的，而 tcp_keepalive 相关的几个值会被重新初始化了。

在函数tcp_sk_init() 里，tcp_keepalive 的三个参数都是重新初始化的，而 tcp_congestion_control 的值是从 Host Namespace 里复制过来的。

```c
static int __net_init tcp_sk_init(struct net *net)
{
…
        net->ipv4.sysctl_tcp_keepalive_time = TCP_KEEPALIVE_TIME;
        net->ipv4.sysctl_tcp_keepalive_probes = TCP_KEEPALIVE_PROBES;
        net->ipv4.sysctl_tcp_keepalive_intvl = TCP_KEEPALIVE_INTVL;

…
        /* Reno is always built in */
        if (!net_eq(net, &init_net) &&
            try_module_get(init_net.ipv4.tcp_congestion_control->owner))
                net->ipv4.tcp_congestion_control = init_net.ipv4.tcp_congestion_control;
        else
                net->ipv4.tcp_congestion_control = &tcp_reno;

…

}
```

也就是说，在容器启动的时候，这些网络参数已经初始化好了，而且容器启动之后在修改这些网络参数也无法生效，应为网络已经建立好了，所有相关的参数只有在建立网络的时候才会被用到，而且为了保证这些网络参数的安全，一般的容器运行时都是按照只读的方式对 /proc 和 /sys 目录进行mount 的。

为了解决这个问题runC 也在对 /proc/sys 目录做 read-only mount 之前，预留出了修改接口，就是用来修改容器里 "/proc/sys"下参数的，同样也是 sysctl 的参数。

而 Docker 的–sysctl或者 Kubernetes 里的allowed-unsafe-sysctls特性也都利用了 runC 的 sysctl 参数修改接口，允许容器在启动时修改容器 Namespace 里的参数。

```bash
# docker run -d --name net_para --sysctl net.ipv4.tcp_keepalive_time=600 centos:8.1.1911 sleep 3600 7efed88a44d64400ff5a6d38fdcc73f2a74a7bdc3dbc7161060f2f7d0be170d1
# docker exec net_para cat /proc/sys/net/ipv4/tcp_keepalive_time 600
```

#### 容器网络配置（1）：容器网络不通了要怎么调试?

```bash
# --network none 启动容器，但是容器中只有loopback网卡
# docker run -d --name if-test --network none centos:8.1.1911 sleep 36000
cf3d3105b11512658a025f5b401a09c888ed3495205f31e0a0d78a2036729472
# docker exec -it if-test ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
```

```bash
pid=$(ps -ef | grep "sleep 36000" | grep -v grep | awk '{print $2}')
echo $pid
ln -s /proc/$pid/ns/net /var/run/netns/$pid

# Create a pair of veth interfaces
ip link add name veth_host type veth peer name veth_container
# Put one of them in the new net ns
ip link set veth_container netns $pid

# In the container, setup veth_container
ip netns exec $pid ip link set veth_container name eth0
ip netns exec $pid ip addr add 172.17.1.2/16 dev eth0
ip netns exec $pid ip link set eth0 up
ip netns exec $pid ip route add default via 172.17.0.1

# In the host, set veth_host up
ip link set veth_host up
```


首先呢，我们先找到这个容器里运行的进程"sleep 36000"的 pid，通过 "/proc/$pid/ns/net"这个文件得到 Network Namespace 的 ID，这个 Network Namespace ID 既是这个进程的，也同时属于这个容器。

然后我们在"/var/run/netns/"的目录下建立一个符号链接，指向这个容器的 Network Namespace。完成这步操作之后，在后面的"ip netns"操作里，就可以用 pid 的值作为这个容器的 Network Namesapce 的标识了。

接下来呢，我们用 ip link 命令来建立一对 veth 的虚拟设备接口，分别是 veth_container 和 veth_host。从名字就可以看出来，veth_container 这个接口会被放在容器 Network Namespace 里，而 veth_host 会放在宿主机的 Host Network Namespace。

所以我们后面的命令也很好理解了，就是用 ip link set veth_container netns $pid 把 veth_container 这个接口放入到容器的 Network Namespace 中。

再然后我们要把 veth_container 重新命名为 eth0，因为这时候接口已经在容器的 Network Namesapce 里了，eth0 就不会和宿主机上的 eth0 冲突了。

最后对容器内的 eht0，我们还要做基本的网络 IP 和缺省路由配置。因为 veth_host 已经在宿主机的 Host Network Namespace 了，就不需要我们做什么了，这时我们只需要 up 一下这个接口就可以了。


![[image-2025-02-18-10-49-53-310.png]]

现在，我们再来看看 veth 的定义了，其实它也很简单。veth 就是一个虚拟的网络设备，一般都是成对创建，而且这对设备是相互连接的。当每个设备在不同的 Network Namespaces 的时候，Namespace 之间就可以用这对 veth 设备来进行网络通讯了。

比如说，你可以执行下面的这段代码，试试在 veth_host 上加上一个 IP，172.17.1.1/16，然后从容器里就可以 ping 通这个 IP 了。这也证明了从容器到宿主机可以利用这对 veth 接口来通讯了

```bash
# ip addr add 172.17.1.1/16 dev veth_host
# docker exec -it if-test ping 172.17.1.1
PING 172.17.1.1 (172.17.1.1) 56(84) bytes of data.
64 bytes from 172.17.1.1: icmp_seq=1 ttl=64 time=0.073 ms
64 bytes from 172.17.1.1: icmp_seq=2 ttl=64 time=0.092 ms
^C
--- 172.17.1.1 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 30ms
rtt min/avg/max/mdev = 0.073/0.082/0.092/0.013 ms
```

那下面我们再来看第二步， 数据包到了 Host Network Namespace 之后呢，怎么把它从宿主机上的 eth0 发送出去?

Docker 程序在节点上安装完之后，就会自动建立了一个 docker0 的 bridge interface。所以我们只需要把第一步中建立的 veth_host 这个设备，接入到 docker0 这个 bridge 上。

这里我要提醒你注意一下，如果之前你在 veth_host 上设置了 IP 的，就需先运行一下"ip addr delete 172.17.1.1/16 dev veth_host"，把 IP 从 veth_host 上删除。

```bash
# ip addr delete 172.17.1.1/16 dev veth_host
ip link set veth_host master docker0
```

![[image-2025-02-18-10-53-34-561.png]]

从这张示意图中，我们可以看出来，容器和 docker0 组成了一个子网，docker0 上的 IP 就是这个子网的网关 IP。

如果我们要让子网通过宿主机上 eth0 去访问外网的话，那么加上 iptables 的规则就可以了，也就是下面这条规则。

```bash
iptables -P FORWARD ACCEPT
# 查看nat类型的网络转发配置
# iptables -L  -t nat
```

- 抓容器的包

```bash
# $pid 是容器的网络命名空间 ID
# ip netns exec $pid tcpdump -i eth0 host 39.106.233.176 -nn
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes
00:47:29.934294 IP 172.17.1.2 > 39.106.233.176: ICMP echo request, id 71, seq 1, length 64
00:47:30.934766 IP 172.17.1.2 > 39.106.233.176: ICMP echo request, id 71, seq 2, length 64
00:47:31.958875 IP 172.17.1.2 > 39.106.233.176: ICMP echo request, id 71, seq 3, length 64
```


经过上述设置之后，在容器中如果还是不能ping同外部网络，可以确认一下物理网卡的 ip_forward 是否打开。

```bash
# 直接写入打开
# cat /proc/sys/net/ipv4/ip_forward
0
# echo 1 > /proc/sys/net/ipv4/ip_forward

# 使用sysctl打开
# sysctl net.ipv4.ip_forward
net.ipv4.ip_forward = 1
# sysctl -w net.ipv4.ip_forward=1
```


#### 容器网络延时要比宿主机上的高吗?

.containerd容器网络
![[image-2025-02-18-16-05-18-020.png]]

.docker容器网络
![[image-2025-02-18-11-08-46-663.png]]

这种容器向外发送数据包的路径，相比宿主机上直接向外发送数据包的路径，很明显要多了一次接口层的发送和接收。尽管 veth 是虚拟网络接口，在软件上还是会增加一些开销。

如果我们的应用程序对网络性能有很高的要求，特别是之前运行在物理机器上，现在迁移到容器上的，如果网络配置采用 veth 方式，就会出现网络延时增加的现象。

对于这种 veth 接口配置导致网络延时增加的现象，我们可以通过运行netperf（Netperf 是一个衡量网络性能的工具，它可以提供单向吞吐量和端到端延迟的测试）来模拟一下。

![[image-2025-02-18-11-16-04-661.png]]

我们可以运行 netperf 的 TCP_RR 测试用例，TCP_RR 是 netperf 里专门用来测试网络延时的，缺省每次运行 10 秒钟。运行以后，我们还要计算平均每秒钟 TCP request/response 的次数，这个次数越高，就说明延时越小。

```bash
# ./netperf -H 192.168.0.194 -t TCP_RR
MIGRATED TCP REQUEST/RESPONSE TEST from 0.0.0.0 (0.0.0.0) port 0 AF_INET to 192.168.0.194 () port 0 AF_INET : first burst 0
Local /Remote
Socket Size   Request  Resp.   Elapsed  Trans.
Send   Recv   Size     Size    Time     Rate
bytes  Bytes  bytes    bytes   secs.    per sec

16384  131072 1        1       10.00    2504.92
16384  131072

# 容器中运行
[root@4150e2a842b5 /]# ./netperf -H 192.168.0.194 -t TCP_RR
MIGRATED TCP REQUEST/RESPONSE TEST from 0.0.0.0 (0.0.0.0) port 0 AF_INET to 192.168.0.194 () port 0 AF_INET : first burst 0
Local /Remote
Socket Size   Request  Resp.   Elapsed  Trans.
Send   Recv   Size     Size    Time     Rate
bytes  Bytes  bytes    bytes   secs.    per sec

16384  131072 1        1       10.00    2104.68
16384  131072
```

虽然 veth 是一个虚拟的网络接口，但是在接收数据包的操作上，这个虚拟接口和真实的网路接口并没有太大的区别。这里除了没有硬件中断的处理，其他操作都差不多，特别是软中断（softirq）的处理部分其实就和真实的网络接口是一样的。

我们可以通过阅读 Linux 内核里的 veth 的驱动代码（drivers/net/veth.c）确认一下。

veth 发送数据的函数是 veth_xmit()，它里面的主要操作就是找到 veth peer 设备，然后触发 peer 设备去接收数据包。
比如 veth_container 这个接口调用了 veth_xmit() 来发送数据包，最后就是触发了它的 peer 设备 veth_host 去调用 netif_rx() 来接收数据包。

```c
static netdev_tx_t veth_xmit(struct sk_buff *skb, struct net_device *dev)
{
…
       /* 拿到veth peer设备的net_device */
       rcv = rcu_dereference(priv->peer);
…
       /* 将数据送到veth peer设备 */
       if (likely(veth_forward_skb(rcv, skb, rq, rcv_xdp) == NET_RX_SUCCESS)) {


…
}

static int veth_forward_skb(struct net_device *dev, struct sk_buff *skb,
                            struct veth_rq *rq, bool xdp)
{
        /* 这里最后调用了 netif_rx() */
        return __dev_forward_skb(dev, skb) ?: xdp ?
                veth_xdp_rx(rq, skb) :
                netif_rx(skb);
}
```

而 netif_rx() 是一个网络设备驱动里面标准的接收数据包的函数，netif_rx() 里面会为这个数据包 raise 一个 softirq。 ` __raise_softirq_irqoff(NET_RX_SOFTIRQ);`

一般在硬件中断处理结束之后，网络 softirq 的函数才会再去执行没有完成的包的处理工作。即使这里 softirq 的执行速度很快，还是会带来额外的开销。

所以，根据 veth 这个虚拟网络设备的实现方式，我们可以看到它必然会带来额外的开销，这样就会增加数据包的网络延时。

那么我们有什么方法可以减少容器的网络延时呢？你可能会想到，我们可不可以不使用 veth 这个方式配置网络接口，而是换成别的方式呢？

的确是这样，其实除了 veth 之外，容器还可以选择其他的网络配置方式。在 Docker 的文档中提到了 macvlan 的配置方式，和 macvlan 很类似的方式还有 ipvlan。

我们先来看这两个方式的相同之处，无论是 macvlan 还是 ipvlan，它们都是在一个物理的网络接口上再配置几个虚拟的网络接口。在这些虚拟的网络接口上，都可以配置独立的 IP，并且这些 IP 可以属于不同的 Namespace。

然后我再说说它们的不同点。对于 macvlan，每个虚拟网络接口都有自己独立的 mac 地址；而 ipvlan 的虚拟网络接口是和物理网络接口共享同一个 mac 地址。而且它们都有自己的 L2/L3 的配置方式，不过我们主要是拿 macvlan/ipvlan 来和 veth 做比较，这里可以先忽略 macvlan/ipvlan 这些详细的特性。

我们就以 ipvlan 为例，运行下面的这个脚本，为容器手动配置上 ipvlan 的网络接口。

```bash
docker run --init --name lat-test-1 --network none -d registry/latency-test:v1 sleep 36000

pid1=$(docker inspect lat-test-1 | grep -i Pid | head -n 1 | awk '{print $2}' | awk -F "," '{print $1}')
echo $pid1
ln -s /proc/$pid1/ns/net /var/run/netns/$pid1
# 接着我们在宿主机 eth0 的接口上增加一个 ipvlan 虚拟网络接口 ipvt1，再把它加入到容器的 Network Namespace 里面，重命名为容器内的 eth0，并且配置上 IP。这样我们就配置好了第一个用 ipvlan 网络接口的容器。
ip link add link eth0 ipvt1 type ipvlan mode l2
ip link set dev ipvt1 netns $pid1

ip netns exec $pid1 ip link set ipvt1 name eth0
ip netns exec $pid1 ip addr add 172.17.3.2/16 dev eth0
ip netns exec $pid1 ip link set eth0 up
```

我们可以用同样的方式配置第二个容器，这样两个容器可以相互 ping 一下 IP，看看网络是否配置成功了。脚本你可以在这里得到。

两个容器配置好之后，就像下面图中描述的一样了。从这张图里，你很容易就能看出 macvlan/ipvlan 与 veth 网络配置有什么不一样。容器的虚拟网络接口，直接连接在了宿主机的物理网络接口上了，形成了一个网络二层的连接。

![[image-2025-02-18-11-33-01-510.png]]

如果从容器里向宿主机外发送数据，看上去通过的接口要比 veth 少了，那么实际情况是不是这样呢？我们先来看一下 ipvlan 接口发送数据的代码。

从下面的 ipvlan 接口的发送代码中，我们可以看到，如果是往宿主机外发送数据，发送函数会直接找到 ipvlan 虚拟接口对应的物理网络接口。

比如在我们的例子中，这个物理接口就是宿主机上的 eth0，然后直接调用 dev_queue_xmit()，通过物理接口把数据直接发送出去。

```c
static int ipvlan_xmit_mode_l2(struct sk_buff *skb, struct net_device *dev)
{
…
        if (!ipvlan_is_vepa(ipvlan->port) &&
            ether_addr_equal(eth->h_dest, eth->h_source)) {
…
        } else if (is_multicast_ether_addr(eth->h_dest)) {
…
        }
        /*
         * 对于普通的对外发送数据，上面的if 和 else if中的条件都不成立，
         * 所以会执行到这一步，拿到ipvlan对应的物理网路接口设备，
         * 然后直接从这个设备发送数据。
         */
        skb->dev = ipvlan->phy_dev;
        return dev_queue_xmit(skb);
}
```

我们讲过通过 veth 接口从容器向外发送数据包，会触发 peer veth 设备去接收数据包，这个接收的过程就是一个网络的 softirq 的处理过程。

和 veth 接口相比，我们用 ipvlan 发送对外数据就要简单得多，因为这种方式没有内部额外的 softirq 处理开销。

容器通常缺省使用 veth 虚拟网络接口，不过 veth 接口会有比较大的网络延时。我们可以使用 netperf 这个工具来比较网络延时，相比物理机上的网络延时，使用 veth 接口容器的网络延时会增加超过 10%。

我们通过对 veth 实现的代码做分析，可以看到由于 veth 接口是成对工作，在对外发送数据的时候，peer veth 接口都会 raise softirq 来完成一次收包操作，这样就会带来数据包处理的额外开销。

如果要减小容器网络延时，就可以给容器配置 ipvlan/macvlan 的网络接口来替代 veth 网络接口。Ipvlan/macvlan 直接在物理网络接口上虚拟出接口，在发送对外数据包的时候可以直接通过物理接口完成，没有节点内部类似 veth 的那种 softirq 的开销。容器使用 ipvlan/maclan 的网络接口，它的网络延时可以非常接近物理网络接口的延时。

对于延时敏感的应用程序，我们可以考虑使用 ipvlan/macvlan 网络接口的容器。不过，由于 ipvlan/macvlan 网络接口直接挂载在物理网络接口上，对于需要使用 iptables 规则的容器，比如 Kubernetes 里使用 service 的容器，就不能工作了。这就需要你结合实际应用的需求做个判断，再选择合适的方案。

#### 容器中的网络乱序包怎么这么高？

通过 veth 接口从容器向外发送数据包，会触发 peer veth 设备去接收数据包，这个接收的过程就是一个网络的 softirq 的处理过程，veth 接口会模拟硬件接收数据的过程，通过 enqueue_to_backlog() 函数把数据包放到某个 CPU 对应的数据包队列里（softnet_data）。

```c
static int netif_rx_internal(struct sk_buff *skb)
{
        int ret;

        net_timestamp_check(netdev_tstamp_prequeue, skb);

        trace_netif_rx(skb);

#ifdef CONFIG_RPS
        if (static_branch_unlikely(&rps_needed)) {
                struct rps_dev_flow voidflow, *rflow = &voidflow;
                int cpu;

                preempt_disable();
                rcu_read_lock();

                cpu = get_rps_cpu(skb->dev, skb, &rflow);
                if (cpu < 0)
                        cpu = smp_processor_id();

                ret = enqueue_to_backlog(skb, cpu, &rflow->last_qtail);

                rcu_read_unlock();
                preempt_enable();
        } else
#endif
        {
                unsigned int qtail;

                ret = enqueue_to_backlog(skb, get_cpu(), &qtail);
                put_cpu();
        }
        return ret;
}
```

从上面的代码，我们可以看到，在缺省的状况下（也就是没有 RPS 的情况下），enqueue_to_backlog() 把数据包放到了“当前运行的 CPU”（get_cpu()）对应的数据队列中。如果是从容器里通过 veth 对外发送数据包，那么这个“当前运行的 CPU”就是容器中发送数据的进程所在的 CPU。

对于多核的系统，这个发送数据的进程可以在多个 CPU 上切换运行。进程在不同的 CPU 上把数据放入队列并且 raise softirq 之后，因为每个 CPU 上处理 softirq 是个异步操作，所以两个 CPU network softirq handler 处理这个进程的数据包时，处理的先后顺序并不能保证。

所以，veth 对的这种发送数据方式增加了容器向外发送数据出现乱序的几率。

*RSS 和 RPS*

那么对于 veth 接口的这种发包方式，有办法减少一下乱序的几率吗？

其实，我们在上面 netif_rx_internal() 那段代码中，有一段在"#ifdef CONFIG_RPS"中的代码。

我们看到这段代码中在调用 enqueue_to_backlog() 的时候，传入的 CPU 并不是当前运行的 CPU，而是通过 get_rps_cpu() 得到的 CPU，那么这会有什么不同呢？这里的 RPS 又是什么意思呢？

要解释 RPS 呢，需要先看一下 RSS，这个 RSS 不是我们之前说的内存 RSS，而是和网卡硬件相关的一个概念，它是 Receive Side Scaling 的缩写。

现在的网卡性能越来越强劲了，从原来一条 RX 队列扩展到了 N 条 RX 队列，而网卡的硬件中断也从一个硬件中断，变成了每条 RX 队列都会有一个硬件中断。

每个硬件中断可以由一个 CPU 来处理，那么对于多核的系统，多个 CPU 可以并行的接收网络包，这样就大大地提高了系统的网络数据的处理能力.

同时，在网卡硬件中，可以根据数据包的 4 元组或者 5 元组信息来保证同一个数据流，比如一个 TCP 流的数据始终在一个 RX 队列中，这样也能保证同一流不会出现乱序的情况。

![[image-2025-02-18-14-33-03-178.png]]

RSS 的实现在网卡硬件和驱动里面，而 RPS（Receive Packet Steering）其实就是在软件层面实现类似的功能。它主要实现的代码框架就在上面的 netif_rx_internal() 代码里，原理也不难。

就像下面的这张示意图里描述的这样：在硬件中断后，CPU2 收到了数据包，再一次对数据包计算一次四元组的 hash 值，得到这个数据包与 CPU1 的映射关系。接着会把这个数据包放到 CPU1 对应的 softnet_data 数据队列中，同时向 CPU1 发送一个 IPI 的中断信号。

这样一来，后面 CPU1 就会继续按照 Netowrk softirq 的方式来处理这个数据包了

![[image-2025-02-18-14-34-02-481.png]]

RSS 和 RPS 的目的都是把数据包分散到更多的 CPU 上进行处理，使得系统有更强的网络包处理能力。在把数据包分散到各个 CPU 时，保证了同一个数据流在一个 CPU 上，这样就可以减少包的乱序。

明白了 RPS 的概念之后，我们再回头来看 veth 对外发送数据时候，在 enqueue_to_backlog() 的时候选择 CPU 的问题。显然，如果对应的 veth 接口上打开了 RPS 的配置以后，那么对于同一个数据流，就可以始终选择同一个 CPU 了。

其实我们打开 RPS 的方法挺简单的，只要去 /sys 目录下，在网络接口设备接收队列中修改队列里的 rps_cpus 的值，这样就可以了。rps_cpus 是一个 16 进制的数，每个 bit 代表一个 CPU。

RPS 和 RSS 的作用类似，都是把数据包分散到更多的 CPU 上进行处理，使得系统有更强的网络包处理能力。它们的区别是 RSS 工作在网卡的硬件层，而 RPS 工作在 Linux 内核的软件层。

### 容器安全

在普通 Linux 节点上，非 root 用户启动的进程缺省没有任何 Linux capabilities，而 root 用户启动的进程缺省包含了所有的 Linux capabilities

使用capsh执行一个root用户启动的程序，但是去除了cap_net_admin这个cap，就会发现iptables命令执行失败。

```c
# sudo /usr/sbin/capsh --keep=1 --user=root   --drop=cap_net_admin  --   -c './iptables -L;sleep 100'
Chain INPUT (policy ACCEPT)
target     prot opt source               destination

Chain FORWARD (policy ACCEPT)
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination
iptables: Permission denied (you must be root).

# ps -ef | grep sleep
root     22603 22275  0 19:44 pts/1    00:00:00 sudo /usr/sbin/capsh --keep=1 --user=root --drop=cap_net_admin -- -c ./iptables -L;sleep 100
root     22604 22603  0 19:44 pts/1    00:00:00 /bin/bash -c ./iptables -L;sleep 100

# cat /proc/22604/status | grep Cap
CapInh:            0000000000000000
CapPrm:          0000003fffffefff
CapEff:             0000003fffffefff
CapBnd:          0000003fffffefff
CapAmb:         0000000000000000
```

运行上面的命令查看 /proc//status 里 Linux capabilities 的相关参数之后，我们可以发现，输出结果中包含 5 个 Cap 参数。

这里我给你解释一下， 对于当前进程，直接影响某个特权操作是否可以被执行的参数，是"CapEff"，也就是"Effective capability sets"，这是一个 bitmap，每一个 bit 代表一项 capability 是否被打开。

在 Linux 内核capability.h里把 CAP_NET_ADMIN 的值定义成 12，所以我们可以看到"CapEff"的值是"0000003fffffefff"，第 4 个数值是 16 进制的"e"，而不是 f。

这表示 CAP_NET_ADMIN 对应的第 12-bit 没有被置位了（0xefff = 0xffff & (~(1 << 12))），所以这个进程也就没有执行 iptables 命令的权限了。

![[image-2025-02-18-15-12-01-891.png]]

如果我们要新启动一个程序，在 Linux 里的过程就是先通过 fork() 来创建出一个子进程，然后调用 execve() 系统调用读取文件系统里的程序文件，把程序文件加载到进程的代码段中开始运行。

就像图片所描绘的那样，这个新运行的进程里的相关 capabilities 参数的值，是由它的父进程以及程序文件中的 capabilities 参数值计算得来的。具体可以参见：Linux capabilities，或者如下两篇文章。

1. Capabilities: Why They Exist and How They Work
2. Linux Capabilities in Practice

这里你只要记住最重要的一点，文件中可以设置 capabilities 参数值，并且这个值会影响到最后运行它的进程。比如，我们如果把 iptables 的应用程序加上 CAP_NET_ADMIN 的 capability，那么即使是非 root 用户也有执行 iptables 的权限了。

```bash
$ id
uid=1000(centos) gid=1000(centos) groups=1000(centos),10(wheel)
$ sudo setcap cap_net_admin+ep ./iptables
$ getcap ./iptables
./iptables = cap_net_admin+ep
$./iptables -L
Chain INPUT (policy ACCEPT)
target     prot opt source               destination

Chain FORWARD (policy ACCEPT)
target     prot opt source               destination
DOCKER-USER  all  --  anywhere             anywhere
DOCKER-ISOLATION-STAGE-1  all  --  anywhere             anywhere
ACCEPT     all  --  anywhere             anywhere             ctstate RELATED,ESTABLISHED
DOCKER     all  --  anywhere             anywhere
ACCEPT     all  --  anywhere             anywhere
ACCEPT     all  --  anywhere             anywhere
```

我们搞懂了 Linux capabilities 之后，那么对 privileged 的容器也很容易理解了。Privileged 的容器也就是允许容器中的进程可以执行所有的特权操作。

因为安全方面的考虑，容器缺省启动的时候，哪怕是容器中 root 用户的进程，系统也只允许了 15 个 capabilities。这个你可以查看runC spec 文档中的 security 部分，你也可以查看容器 init 进程 status 里的 Cap 参数。

因为容器中的权限越高，对系统安全的威胁显然也是越大的。比如说，如果容器中的进程有了 CAP_SYS_ADMIN 的特权之后，那么这些进程就可以在容器里直接访问磁盘设备，直接可以读取或者修改宿主机上的所有文件了。

所以，在容器平台上是基本不允许把容器直接设置为"privileged"的，我们需要根据容器中进程需要的最少特权来赋予 capabilities。

我们结合这一讲开始的例子来说说。在开头的例子中，容器里需要使用 iptables。因为使用 iptables 命令，只需要设置 CAP_NET_ADMIN 这个 capability 就行。那么我们只要在运行 Docker 的时候，给这个容器再多加一个 NET_ADMIN 参数就可以了。

```bash
# docker run --name iptables --cap-add NET_ADMIN -it registry/iptables:v1 bash
[root@cfedf124dcf1 /]# iptables -L
Chain INPUT (policy ACCEPT)
target     prot opt source               destination

Chain FORWARD (policy ACCEPT)
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination
```

### 实践

#### 理解perf：怎么用perf聚焦热点函数？

```bash
# 使用perf命令查看CPU 32上函数调用热度
# perf record -C 32 -g -- sleep 10
```

第一步，抓取数据。当时我们运行了下面这条 perf 命令，这里的参数 -C 32 是指定只抓取 CPU32 的执行指令；-g 是指 call-graph enable，也就是记录函数调用关系； sleep 10 主要是为了让 perf 抓取 10 秒钟的数据。

perf 可以在 CPU Usage 增高的节点上找到具体的引起 CPU 增高的函数，然后我们就可以有针对性地聚焦到那个函数做分析。

查看 page-faults错误

```bash
[root@k8smaster-40-170 ~]# perf stat -e page-faults -- sleep 2

 Performance counter stats for 'sleep 2':

                74      page-faults

       2.001660323 seconds time elapsed

       0.001613000 seconds user
       0.000000000 seconds sys
```

perf record 在不加 -e 指定 event 的时候，它缺省的 event 就是 Hardware event cycles。

第一点，Perf 通过系统调用 perf_event_open() 来完成对 perf event 的计数或者采样。不过 Docker 使用 seccomp（seccomp 是一种技术，它通过控制系统调用的方式来保障 Linux 安全）会默认禁止 perf_event_open()。

所以想要让 Docker 启动的容器可以运行 perf，我们要怎么处理呢？

其实这个也不难，在用 Docker 启动容器的时候，我们需要在 seccomp 的 profile 里，允许 perf_event_open() 这个系统调用在容器中使用。在我们的例子中，启动 container 的命令里，已经加了这个参数允许了，参数是"--security-opt seccomp=unconfined"。

第二点，需要允许容器在没有 SYS_ADMIN 这个 capability的情况下，也可以让 perf 访问这些 event。那么现在我们需要做的就是，在宿主机上设置出 echo -1 > /proc/sys/kernel/perf_event_paranoid，这样普通的容器里也能执行 perf 了。

完成了权限设置之后，在容器中运行 perf，就和在 VM/BM 上运行没有什么区别了。

最后，我们再来说一下我们在定位 CPU Uage 异常时最常用的方法，常规的步骤一般是这样的：

首先，调用 perf record 采样几秒钟，一般需要加 -g 参数，也就是 call-graph，还需要抓取函数的调用关系。在多核的机器上，还要记得加上 -a 参数，保证获取所有 CPU Core 上的函数运行情况。至于采样数据的多少，在讲解 perf 概念的时候说过，我们可以用 -c 或者 -F 参数来控制。

```bash
# perf record -a -g -- sleep 60
# perf script > out.perf
# git clone --depth 1 https://github.com/brendangregg/FlameGraph.git
# FlameGraph/stackcollapse-perf.pl out.perf > out.folded
# FlameGraph/flamegraph.pl out.folded > out.sv
```

#### 理解ftrace（1）：怎么应用ftrace查看长延时内核函数？

ftrace 的操作都可以在 tracefs 这个虚拟文件系统中完成，对于 CentOS，这个 tracefs 的挂载点在 /sys/kernel/debug/tracing 下：

```bash
# cat /proc/mounts | grep tracefs
tracefs /sys/kernel/debug/tracing tracefs rw,relatime 0 0
```

你可以进入到 /sys/kernel/debug/tracing 目录下，看一下这个目录下的文件：

```bash
# cd /sys/kernel/debug/tracing
# ls
available_events            dyn_ftrace_total_info     kprobe_events    saved_cmdlines_size  set_graph_notrace   trace_clock          tracing_on
available_filter_functions  enabled_functions         kprobe_profile   saved_tgids          snapshot            trace_marker         tracing_thresh
available_tracers           error_log                 max_graph_depth  set_event            stack_max_size      trace_marker_raw     uprobe_events
buffer_percent              events                    options          set_event_pid        stack_trace         trace_options        uprobe_profile
buffer_size_kb              free_buffer               per_cpu          set_ftrace_filter    stack_trace_filter  trace_pipe
buffer_total_size_kb        function_profile_enabled  printk_formats   set_ftrace_notrace   synthetic_events    trace_stat
current_tracer              hwlat_detector            README           set_ftrace_pid       timestamp_mode      tracing_cpumask
dynamic_events              instances                 saved_cmdlines   set_graph_function   trace               tracing_max_latency
```

tracefs 虚拟文件系统下的文件操作，其实和我们常用的 Linux proc 和 sys 虚拟文件系统的操作是差不多的。通过对某个文件的 echo 操作，我们可以向内核的 ftrace 系统发送命令，然后 cat 某个文件得到 ftrace 的返回结果。

对于 ftrace，它的输出结果都可以通过 cat trace 这个命令得到。在缺省的状态下 ftrace 的 tracer 是 nop，也就是 ftrace 什么都不做。因此，我们从cat trace中也看不到别的，只是显示了 trace 输出格式。

```bash
# pwd
/sys/kernel/debug/tracing
# cat trace

# tracer: nop
#
# entries-in-buffer/entries-written: 0/0   #P:12
#
#                              _-----=> irqs-off
#                             / _```=> need-resched
#                            | / _---=> hardirq/softirq
#                            || / _--=> preempt-depth
#                            ||| /     delay
#           TASK-PID   CPU#  ||||    TIMESTAMP  FUNCTION
#              | |       |   ||||       |         |
```

下面，我们可以执行 echo function > current_tracer 来告诉 ftrace，我要启用 function tracer。

```bash
# cat current_tracer
nop
# cat available_tracers
hwlat blk mmiotrace function_graph wakeup_dl wakeup_rt wakeup function nop
# echo function > current_tracer
# cat current_tracer
function
```

在启动了 function tracer 之后，我们再查看一下 trace 的输出。这时候我们就会看到大量的输出，每一行的输出就是当前内核中被调用到的内核函数，具体的格式你可以参考 trace 头部的说明

```bash
cat trace | more
# tracer: function
#
# entries-in-buffer/entries-written: 615132/134693727   #P:12
#
#                              _-----=> irqs-off
#                             / _```=> need-resched
#                            | / _---=> hardirq/softirq
#                            || / _--=> preempt-depth
#                            ||| /     delay
#           TASK-PID   CPU#  ||||    TIMESTAMP  FUNCTION
#              | |       |   ||||       |         |
   systemd-udevd-20472 [011] .... 2148512.735026: lock_page_memcg <-page_remove_rmap
   systemd-udevd-20472 [011] .... 2148512.735026: PageHuge <-page_remove_rmap
   systemd-udevd-20472 [011] .... 2148512.735026: unlock_page_memcg <-page_remove_rmap
   systemd-udevd-20472 [011] .... 2148512.735026: __unlock_page_memcg <-unlock_page_memcg
   systemd-udevd-20472 [011] .... 2148512.735026: __tlb_remove_page_size <-unmap_page_range
   systemd-udevd-20472 [011] .... 2148512.735027: vm_normal_page <-unmap_page_range
   systemd-udevd-20472 [011] .... 2148512.735027: mark_page_accessed <-unmap_page_range
   systemd-udevd-20472 [011] .... 2148512.735027: page_remove_rmap <-unmap_page_range
   systemd-udevd-20472 [011] .... 2148512.735027: lock_page_memcg <-page_remove_rmap
```

其实在实际使用的时候，我们可以利用 ftrace 里的 filter 参数做筛选，比如我们可以通过 set_ftrace_filter 只列出想看到的内核函数，或者通过 set_ftrace_pid 只列出想看到的进程。

为了让你加深理解，我给你举个例子，比如说，如果我们只是想看 do_mount 这个内核函数有没有被调用到，那我们就可以这么操作:

```bash
# echo nop > current_tracer
# echo do_mount > set_ftrace_filter
# echo function > current_tracer
```

输出里"do_mount <- ksys_mount"表示 do_mount() 函数是被 ksys_mount() 这个函数调用到的，"2159455.499195"表示函数执行时的时间戳，而"[005]"是内核函数 do_mount() 被执行时所在的 CPU 编号，还有"mount-20889"，它是 do_mount() 被执行时当前进程的 pid 和进程名。

```bash
# mount -t tmpfs tmpfs /tmp/fs
# cat trace
# tracer: function
#
# entries-in-buffer/entries-written: 1/1   #P:12
#
#                              _-----=> irqs-off
#                             / _```=> need-resched
#                            | / _---=> hardirq/softirq
#                            || / _--=> preempt-depth
#                            ||| /     delay
#           TASK-PID   CPU#  ||||    TIMESTAMP  FUNCTION
#              | |       |   ||||       |         |
           mount-20889 [005] .... 2159455.499195: do_mount <-ksys_mount
```

这里我们只能判断出，ksys mount() 调用了 do mount() 这个函数，这只是一层调用关系，如果我们想要看更加完整的函数调用栈，可以打开 ftrace 中的 func_stack_trace 选项：

```bash
# echo 1 > options/func_stack_trace
```

打开以后，我们再来做一次 mount 操作，就可以更清楚地看到 do_mount() 是系统调用 (syscall) 之后被调用到的。

```bash
# umount /tmp/fs
# mount -t tmpfs tmpfs /tmp/fs
# cat trace

# tracer: function
#
# entries-in-buffer/entries-written: 3/3   #P:12
#
#                              _-----=> irqs-off
#                             / _```=> need-resched
#                            | / _---=> hardirq/softirq
#                            || / _--=> preempt-depth
#                            ||| /     delay
#           TASK-PID   CPU#  ||||    TIMESTAMP  FUNCTION
#              | |       |   ||||       |         |
           mount-20889 [005] .... 2159455.499195: do_mount <-ksys_mount
           mount-21048 [000] .... 2162013.660835: do_mount <-ksys_mount
           mount-21048 [000] .... 2162013.660841: <stack trace>
 => do_mount
 => ksys_mount
 => __x64_sys_mount
 => do_syscall_64
 => entry_SYSCALL_64_after_hwframe
```

结合刚才说的内容，我们知道了，通过 function tracer 可以帮我们判断内核中函数是否被调用到，以及函数被调用的整个路径 也就是调用栈。

这样我们就理清了整体的追踪思路：如果我们通过 perf 发现了一个内核函数的调用频率比较高，就可以通过 function tracer 工具继续深入，这样就能大概知道这个函数是在什么情况下被调用到的。

那如果我们还想知道，某个函数在内核中大致花费了多少时间，需要用到 ftrace 中的另外一个 tracer，它就是 function_graph。我们可以在刚才的 ftrace 的设置基础上，把 current_tracer 设置为 function_graph，然后就能看到 do_mount() 这个函数调用的时间了。

```bash
# echo function_graph > current_tracer
# umount /tmp/fs
# mount -t tmpfs tmpfs /tmp/fs
# cat trace
# tracer: function_graph
#
# CPU  DURATION                  FUNCTION CALLS
# |     |   |                     |   |   |   |
  0) ! 175.411 us  |  do_mount();
```

通过 function_graph tracer，还可以让我们看到每个函数里所有子函数的调用以及时间，这对我们理解和分析内核行为都是很有帮助的。

比如说，我们想查看 kfree_skb() 这个函数是怎么执行的，就可以像下面这样配置：

```bash
# echo '!do_mount ' >> set_ftrace_filter ### 先把之前的do_mount filter给去掉。
# echo kfree_skb > set_graph_function  ### 设置kfree_skb()
# echo nop > current_tracer ### 暂时把current_tracer设置为nop, 这样可以清空trace
# echo function_graph > current_tracer ### 把current_tracer设置为function_graph
```

下面这张图描述了 ftrace 实现的 high level 的架构，用户通过 tracefs 向内核中的 function tracer 发送命令，然后 function tracer 把收集到的数据写入一个 ring buffer，再通过 tracefs 输出给用户

![[image-2025-02-18-20-09-28-448.png]]

```bash
# perf stat -a -e fs:do_sys_open -- sleep 10
```












