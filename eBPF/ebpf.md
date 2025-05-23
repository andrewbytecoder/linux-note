
## eBPF

![[image-2025-02-11-09-36-02-105.png]]

eBPF 是什么呢？ 从它的全称“扩展的伯克利数据包过滤器 (Extended Berkeley Packet Filter)”来看，它是一种数据包过滤技术，是从 BPF (Berkeley Packet Filter) 技术扩展而来的。

BPF 提供了一种在内核事件和用户程序事件发生时安全注入代码的机制，这就让非内核开发人员也可以对内核进行控制。随着内核的发展，BPF 逐步从最初的数据包过滤扩展到了网络、内核、安全、跟踪等，而且它的功能特性还在快速发展中，这种扩展后的 BPF 被简称为eBPF（相应的，早期的 BPF 被称为经典 BPF，简称 cBPF）。实际上，现代内核所运行的都是 eBPF，如果没有特殊说明，内核和开源社区中提到的 BPF 等同于 eBPF。

在 eBPF 之前，内核模块是注入内核的最主要机制。由于缺乏对内核模块的安全控制，内核的基本功能很容易被一个有缺陷的内核模块破坏。而 eBPF 则借助即时编译器（JIT），在内核中运行了一个虚拟机，保证只有被验证安全的 eBPF 指令才会被内核执行。同时，因为 eBPF 指令依然运行在内核中，无需向用户态复制数据，这就大大提高了事件处理的效率。

eBPF 现如今已经在故障诊断、网络优化、安全控制、性能监控等领域获得大量应用。比如，Facebook 开源的高性能网络负载均衡器 Katran、Isovalent 开源的容器网络方案 Cilium ，以及著名的内核跟踪排错工具 BCC 和 bpftrace 等，都是基于 eBPF 技术实现的。

- 只有特权进程才能执行bpf系统调用
- BPF程序不能包含无限循环
- BPF程序不能导致内核崩溃
- BPF程序必须在有限时间内完成

BPF 程序可以利用 BPF 映射（map）进行存储，而用户程序通常也需要通过 BPF 映射同运行在内核中的 BPF 程序进行交互。

![[image-2025-02-11-10-34-57-912.png]]
可以看到，eBPF 程序的运行需要历经编译、加载、验证和内核态执行等过程，而用户态程序则需要借助 BPF 映射来获取内核态 eBPF 程序的运行状态。

eBPF 并不是万能的，它也有很多的局限性。下面是一些最常见的 eBPF 限制：

- eBPF 程序必须被验证器校验通过后才能执行，且不能包含无法到达的指令；
- eBPF 程序不能随意调用内核函数，只能调用在 API 中定义的辅助函数；
- eBPF 程序栈空间最多只有 512 字节，想要更大的存储，就必须要借助映射存储； 在内核 5.2 之前，eBPF 字节码最多只支持 4096 条指令，而 5.2 内核把这个限制提高到了100 万条；
- 由于内核的快速变化，在不同版本内核中运行时，需要访问内核数据结构的 eBPF 程序很可能需要调整源码，并重新编译。

.通过BCC学习eBPF
![[image-2025-02-11-10-47-16-135.png]]

### 开发一个eBPF程序

- 第一步，使用 C 语言开发一个 eBPF 程序；
- 第二步，借助 LLVM 把 eBPF 程序编译成 BPF 字节码；
- 第三步，通过 bpf 系统调用，把 BPF 字节码提交给内核；
- 第四步，内核验证并运行 BPF 字节码，并把相应的状态保存到 BPF 映射中；
- 第五步，用户程序通过 BPF 映射查询 BPF 字节码的运行状态。

![[image-2025-02-11-14-19-21-916.png]]

接下来，我就以跟踪 openat()（即打开文件）这个系统调用为例，带你来看看如何开发并运行第一个 eBPF 程序。

*第一步：使用 C 开发一个 eBPF 程序*

```c
// This is a Hello World example of BPF.
int hello_world(void *ctx)
{
    // 最常用的 BPF 辅助函数，它的作用是输出一段字符串，不过，由于 eBPF 运行在内核中，它的输出并不是常的标准输出（stdout），而是内核调试文件 /sys/kernel/debug/tracing/trace_pipe ，你可以直接使用 cat 命令来查看这个文件的内容。
    bpf_trace_printk("Hello, World!");
    return 0;
}
```

*第二步：使用 Python 和 BCC 库开发一个用户态程序*

```python
# 处导入了 BCC 库的 BPF 模块，以便接下来调用；
#!/usr/bin/env python3
# This is a Hello World example of BPF.
from bcc import BPF

# load BPF program
# 处调用 BPF() 加载第一步开发的 BPF 源代码
b = BPF(src_file="hello.c")
# 处将 BPF 程序挂载到内核探针（简称 kprobe），其中 do_sys_openat2() 是系统调用 openat() 在内核中的实现
# 除了把 eBPF 程序加载到内核之外，还需要把加载后的程序跟具体的内核函数调用事件进行绑定。
# 在 eBPF 的实现中，诸如内核跟踪（kprobe）、用户跟踪（uprobe）等的事件绑定，都是通过 perf_event_open() 来完成的
b.attach_kprobe(event="do_sys_openat2", fn_name="hello_world")
# 处则是读取内核调试文件 /sys/kernel/debug/tracing/trace_pipe 的内容，并打印到标准输出中。
b.trace_print()
```

在运行的时候，BCC 会调用 LLVM，把 BPF 源代码编译为字节码，再加载到内核中运行。

第三步：执行 eBPF 程序

```bash
sudo python3 hello.py
```

```bash
# 输出结果
#  kubelet-24746  进程和进程号
#  [013] CPU 编号
#  72579.780845   时间戳
#  bpf_trace_printk 表示函数名
b'         kubelet-24746   [013] ....2.1 72579.780845: bpf_trace_printk: Hello, World!'
```



## 运行原理：eBPF 是一个新的虚拟机吗？

### eBPF 虚拟机是如何工作的？

eBPF 是一个运行在内核中的虚拟机，很多人在初次接触它时，会把它跟系统虚拟化（比如kvm）中的虚拟机弄混。其实，虽然都被称为“虚拟机”，系统虚拟化和 eBPF 虚拟机还是有着本质不同的。

系统虚拟化基于 x86 或 arm64 等通用指令集，这些指令集足以完成完整计算机的所有功能。 而为了确保在内核中安全地执行，eBPF 只提供了非常有限的指令集。这些指令集可用于完成一部分内核的功能，但却远不足以模拟完整的计算机。为了更高效地与内核进行交互，eBPF指令还有意采用了 C 调用约定，其提供的辅助函数可以在 C 语言中直接调用，极大地方便了eBPF 程序的开发。

.eBPF 在内核中的运行时主要由 5 个模块组成
![[image-2025-02-11-14-49-01-687.png]]

- 第一个模块是 eBPF 辅助函数。它提供了一系列用于 eBPF 程序与内核其他模块进行交互的函数。
- 第二个模块是 eBPF 验证器。它用于确保 eBPF 程序的安全。验证器会将待执行的指令创建为一个有向无环图（DAG），确保程序中不包含不可达指令；接着再模拟指令的执行过程，确保不会执行无效指令。
- 第三个模块是由 11 个 64 位寄存器、一个程序计数器和一个 512 字节的栈组成的存储模块。这个模块用于控制 eBPF 程序的执行。
- 第四个模块是即时编译器，它将 eBPF 字节码编译成本地机器指令，以便更高效地在内核中执行。
- 第五个模块是 BPF 映射（map），它用于提供大块的存储。这些存储可被用户空间程序用来进行访问，进而控制 eBPF 程序的运行状态。

```bash
# 查看系统中运行的 BPF 程序
sudo bpftool prog list
# 将对应eBPF程序导出为指令进行调试，注意这里的89替换成自己的进程编号
sudo bpftool prog dump xlated id 89

# 第一部分，冒号前面的数字 0-12 ，代表 BPF 指令行数；
# 第二部分，括号中的 16 进制数值，表示 BPF 指令码。它的具体含义你可以参考 IOVisorBPF 文档，比如第 0 行的 0xb7 表示为 64 位寄存器赋值。
# 第三部分，括号后面的部分，就是 BPF 指令的伪代码。
int hello_world(void * ctx):
; int hello_world(void *ctx)
0: (b7) r1 = 33 /* ! */
; ({ char _fmt]] = "Hello, World!"; bpf_trace_printk_(_fmt, sizeof(_fmt)); });
1: (6b) *(u16 *)(r10 -4) = r1
2: (b7) r1 = 1684828783 /* dlro */
3: (63) *(u32 *)(r10 -8) = r1
4: (18) r1 = 0x57202c6f6c6c6548 /* W ,olleH */
6: (7b) *(u64 *)(r10 -16) = r1
7: (bf) r1 = r10
;
8: (07) r1 += -16
; ({ char _fmt]] = "Hello, World!"; bpf_trace_printk_(_fmt, sizeof(_fmt)); });
9: (b7) r2 = 14
10: (85) call bpf_trace_printk#-61616
; return 0;
11: (b7) r0 = 0
12: (95) exit
# 这些指令先通过 R1 和 R2 寄存器设置了 bpf_trace_printk 的参数，然后调用bpf_trace_printk 函数输出字符串，最后再通过 R0 寄存器返回成功
```

## 编程接口：eBPF 程序是怎么跟内核进行交互的？

对于用户态程序来说，与内核进行交互时必须要通过系统调用来完成。而对应到 eBPF 程序中，我们最常用到的就是bpf系统调用

在命令行中输入 man bpf ，就可以查询到 BPF 系统调用的调用格式：

```c
#include <linux/bpf.h>
// 第一个，cmd ，代表操作命令，比如上一讲中我们看到的 BPF_PROG_LOAD 就是加载eBPF 程序；
// 第二个，attr，代表 bpf_attr 类型的 eBPF 属性指针，不同类型的操作命令需要传入不同的属性参数；
// 第三个，size ，代表属性的大小
int bpf(int cmd, union bpf_attr *attr, unsigned int size);
```

不同版本的内核所支持的 BPF 命令是不同的，具体支持的命令列表可以参考内核头文件 include/uapi/linux/bpf.h 中 bpf_cmd 的定义。

![[2023-03-13-16-01-55-d8ec91bff9d070bd6c9af1306dd74a4.jpg]]


### BPF 辅助函数

eBPF 程序并不能随意调用内核函数，因此，内核定义了一系列的辅助函数，用于 eBPF 程序与内核其他模块进行交互。比如，上一讲的 Hello World 示例中使用的 bpf_trace_printk() 就是最常用的一个辅助函数，用于向调试文件系统（/sys/kernel/debug/tracing/trace_pipe）写入调试信息。

需要注意的是，并不是所有的辅助函数都可以在 eBPF 程序中随意使用，不同类型的 eBPF 程 序所支持的辅助函数是不同的。比如，对于 Hello World 示例这类内核探针（kprobe）类型的eBPF 程序，你可以在命令行中执行 bpftool feature probe ，来查询当前系统支持的辅助函数列表

对于这些辅助函数的详细定义，你可以在命令行中执行 man bpf-helpers ，或者参考内核头文件 include/uapi/linux/bpf.h ，来查看它们的详细定义和使用说明。

![[image-2025-02-11-15-24-55-535.png]]

### BPF 映射

BPF 映射用于提供大块的键值存储，这些存储可被用户空间程序访问，进而获取 eBPF 程序的运行状态。eBPF 程序最多可以访问 64 个不同的 BPF 映射，并且不同的 eBPF 程序也可以通过相同的 BPF 映射来共享它们的状态。

![[image-2025-02-11-15-28-27-646.png]]

在前面的 BPF 系统调用和辅助函数小节中，你也看到，有很多系统调用命令和辅助函数都是用来访问 BPF 映射的。我相信细心的你已经发现了：BPF 辅助函数中并没有 BPF 映射的创建函数，BPF 映射只能通过用户态程序的系统调用来创建。比如，你可以通过下面的示例代码来创建一个 BPF 映射，并返回映射的文件描述符：

```c
int bpf_create_map(enum bpf_map_type map_type,
    unsigned int key_size,
    unsigned int value_size, unsigned int max_entries)
{
    // 最关键的是设置映射的类型。内核头文件 include/uapi/linux/bpf.h 中的
    // bpf_map_type 定义了所有支持的映射类型
    // 你可以使用如下的 bpftool 命令
    union bpf_attr attr = {
        .map_type = map_type,
        .key_size = key_size,
        .value_size = value_size,
        .max_entries = max_entries
    };

    return bpf(BPF_MAP_CREATE, &attr, sizeof(attr));
}
```

```bash
$ bpftool feature probe | grep map_type
eBPF map_type hash is available
eBPF map_type array is available
eBPF map_type prog_array is available
eBPF map_type perf_event_array is available
eBPF map_type percpu_hash is available
eBPF map_type percpu_array is available
eBPF map_type stack_trace is available
eBPF map_type cgroup_array is available
eBPF map_type lru_hash is available
eBPF map_type lru_percpu_hash is available
eBPF map_type lpm_trie is available
eBPF map_type array_of_maps is available
eBPF map_type hash_of_maps is available
```

![[image-2025-02-11-15-34-12-524.png]]

如果你的 eBPF 程序使用了 BCC 库，你还可以使用预定义的宏来简化 BPF 映射的创建过程。比如，对哈希表映射来说，BCC 定义了 BPF_HASH(name, key_type=u64,leaf_type=u64, size=10240)，

BPF 系统调用中并没有删除映射的命令，这是因为 BPF 映射会在用户态程序关闭文件描述符的时候自动删除（即close(fd) ）。 如果你想在程序退出后还保留映射，就需要调用 BPF_OBJ_PIN 命令，将映射挂载到 /sys/fs/bpf中。

在调试 BPF 映射相关的问题时，你还可以通过 bpftool 来查看或操作映射的具体内容。比如，你可以通过下面这些命令创建、更新、输出以及删除映射

```bash
#创建一个哈希表映射，并挂载到/sys/fs/bpf/stats_map(Key和Value的大小都是8字节)
$ bpftool map create pinned /sys/fs/bpf/my_map type hash key 8 value 8 entries 1024
# 查询系统中的所有映射
$ bpftool map
# 示例输出
# 340: hash name stats_map flags 0x0
# key 2B value 2B max_entries 8 memlock 4096B
# 向哈希表映射中插入数据
$ bpftool map update name stats_map key 0xc1 0xc2 value 0xa1 0xa2
$ bpftool map dump pinned /sys/fs/bpf/my_map
$ bpftool map delete pinned /sys/fs/bpf/my_map

# 查询哈希表映射中的所有数据
$ bpftool map dump name stats_map
# 删除哈希表映射
$ rm /sys/fs/bpf/stats_map
# 查看一个bpf的所用映射数据
$ bpftool map dump id 386
```

## 事件触发：各类 eBPF 程序的触发机制及其应用场景

根据内核头文件include/uapi/linux/bpf.h 中 bpf_prog_type 的定义，Linux 内核 v5.13 已经支持 30 种不同类型的 eBPF 程序。对于具体的内核来说，因为不同内核的版本和编译配置选项不同，一个内核并不会支持所有的程序类型。你可以在命令行中执行下面的命令，来查询当前系统支持的程序类型

```bash
[root@k8smaster-40-170 ~]# bpftool feature probe | grep program_type
eBPF program_type socket_filter is available
eBPF program_type kprobe is available
eBPF program_type sched_cls is available
eBPF program_type sched_act is available
eBPF program_type tracepoint is available
eBPF program_type xdp is available
eBPF program_type perf_event is available
eBPF program_type cgroup_skb is available
eBPF program_type cgroup_sock is available
eBPF program_type lwt_in is available
eBPF program_type lwt_out is available
eBPF program_type lwt_xmit is available
eBPF program_type sock_ops is available
eBPF program_type sk_skb is available
eBPF program_type cgroup_device is available
eBPF program_type sk_msg is available
eBPF program_type raw_tracepoint is available
eBPF program_type cgroup_sock_addr is available
eBPF program_type lwt_seg6local is available
eBPF program_type lirc_mode2 is NOT available
eBPF program_type sk_reuseport is available
eBPF program_type flow_dissector is available
eBPF program_type cgroup_sysctl is available
eBPF program_type raw_tracepoint_writable is available
eBPF program_type cgroup_sockopt is available
eBPF program_type tracing is available
eBPF program_type struct_ops is available
eBPF program_type ext is available
eBPF program_type lsm is available
eBPF program_type sk_lookup is available
eBPF program_type syscall is available
eBPF program_type netfilter is available
```

根据具体功能和应用场景的不同，这些程序类型大致可以划分为三类

- 第一类是跟踪，即从内核和程序的运行状态中提取跟踪信息，来了解当前系统正在发生什么
- 第二类是网络，即对网络数据包进行过滤和处理，以便了解和控制网络数据包的收发过程。
- 第三类是除跟踪和网络之外的其他类型，包括安全控制、BPF 扩展等等

### 跟踪类 eBPF 程序

跟踪类 eBPF 程序主要用于从系统中提取跟踪信息，进而为监控、排错、性能优化等提供数据支撑。

![[image-2025-02-11-16-25-03-308.png]]

### 网络类 eBPF 程序

网络类 eBPF 程序主要用于对网络数据包进行过滤和处理，进而实现网络的观测、过滤、流量控制以及性能优化等各种丰富的功能。

根据事件触发位置的不同，网络类 eBPF 程序又可以分为 XDP（eXpress Data Path，高速数据路径）程序、TC（Traffic Control，流量控制）程序、套接字程序以及 cgroup 程序

*XDP程序*

XDP 程序的类型定义为 BPF_PROG_TYPE_XDP，它在网络驱动程序刚刚收到数据包时触发执行。由于无需通过繁杂的内核网络协议栈，XDP 程序可用来实现高性能的网络处理方案，常用于 DDoS 防御、防火墙、4 层负载均衡等场景。

XDP 程序并不是绕过了内核协议栈，它只是在内核协议栈之前处理数据包，而处理过的数据包还可以正常通过内核协议栈继续处理。

![[image-2025-02-11-16-51-33-617.png]]

- XDP_ABORTED：表示 XDP 程序处理数据包时遇到错误或异常。
- XDP_DROP：在网卡驱动层直接将该数据包丢掉，通常用于过滤无效或不需要的数据包，如实现 DDoS 防护时，丢弃恶意数据包。
- XDP_PASS：数据包继续送往内核的网络协议栈，和传统的处理方式一致。这使得 XDP 可以在有需要的时候，继续使用传统的内核协议栈进行处理。
- XDP_TX：数据包会被重新发送到入站的网络接口（通常是修改后的数据包）。这种操作可以用于实现数据包的快速转发、修改和回环测试（如用于负载均衡场景）。
- XDP_REDIRECT：数据包重定向到其他的网卡或 CPU，结合 AF_XDP[2]可以将数据包直接送往用户空间。

![[image-2025-02-24-13-54-54-253.png]]

eBPF 运行在内核空间，能够极大地减少数据的上下文切换开销，再结合 XDP 钩子，在 Linux 系统收包的早期阶段介入处理，就能实现高性能网络数据包处理和转发。以业内知名的容器网络方案 Cilium 为例，它在 eBPF 和 XDP 钩子（也有其他的钩子）基础上，实现了一套全新的 conntrack 和 NAT 机制。并以此为基础，构建出如 L3/L4 负载均衡、网络策略、观测和安全认证等各类高级功能。


- 通用模式。它不需要网卡和网卡驱动的支持，XDP 程序像常规的网络协议栈一样运行在内核中，性能相对较差，一般用于测试
- 原生模式。它需要网卡驱动程序的支持，XDP 程序在网卡驱动程序的早期路径运行
- 卸载模式。它需要网卡固件支持 XDP 卸载，XDP 程序直接运行在网卡上，而不再需要消耗主机的 CPU 资源，具有最好的性能。

无论哪种模式，XDP 程序在处理过网络包之后，都需要根据 eBPF 程序执行结果，决定数据包的去处。这些执行结果对应以下 5 种 XDP 程序结果码：

![[image-2025-02-11-16-54-13-634.png]]

XDP 程序通过 ip link 命令加载到具体的网卡上，加载格式为：

```bash
# eth1 为网卡名
# xdpgeneric 设置运行模式为通用模式
# xdp-example.o 为编译后的 XDP 字节码
sudo ip link set dev eth1 xdpgeneric object xdp-example.o
```

而卸载 XDP 程序也是通过 ip link 命令

```bash
# eth1 为网卡名
# xdpgeneric 设置运行模式为通用模式
sudo ip link set eth1 xdpgeneric off
```

*TC 程序(流量控制)*

TC 程序的类型定义为 BPF_PROG_TYPE_SCHED_CLS 和 BPF_PROG_TYPE_SCHED_ACT，分别作为 Linux 流量控制 的分类器和执行器。Linux 流量控制通过网卡队列、排队规则、分类器、过滤器以及执行器等，实现了对网络流量的整形调度和带宽控制。

下图（图片来自 linux-ip.net）展示了 HTB（Hierarchical Token Bucket，层级令牌桶）流量控制的工作原理：

![[image-2025-02-11-16-58-42-021.png]]


![[image-2025-02-11-17-05-16-397.png]]

同 XDP 程序相比，TC 程序可以直接获取内核解析后的网络报文数据结构sk_buff（XDP 则是 xdp_buff），并且可在网卡的接收和发送两个方向上执行（XDP 则只能用于接收）

- 对于接收的网络包，TC 程序在网卡接收（GRO）之后、协议栈处理（包括 IP 层处理和iptables 等）之前执行；
- 对于发送的网络包，TC 程序在协议栈处理（包括 IP 层处理和 iptables 等）之后、数据包发送到网卡队列（GSO）之前执行。


由于 TC 运行在内核协议栈中，不需要网卡驱动程序做任何改动，因而可以挂载到任意类型的网卡设备（包括容器等使用的虚拟网卡）上。

同 XDP 程序一样，TC eBPF 程序也可以通过 Linux 命令行工具来加载到网卡上，不过相应的工具要换成 tc。

```bash
# 创建 clsact 类型的排队规则
sudo tc qdisc add dev eth0 clsact
# 加载接收方向的 eBPF 程序
sudo tc filter add dev eth0 ingress bpf da obj tc-example.o sec ingress
# 加载发送方向的 eBPF 程序
sudo tc filter add dev eth0 egress bpf da obj tc-example.o sec egress
```

*套接字程序*

套接字程序用于过滤、观测或重定向套接字网络包，具体的种类也比较丰富。根据类型的不同，套接字 eBPF 程序可以挂载到套接字（socket）、控制组（cgroup ）以及网络命名空间（netns）等各个位置。你可以根据具体的应用场景，选择一个或组合多个类型的 eBPF 程序，去控制套接字的网络包收发过程。

![[image-2025-02-11-17-07-25-443.png]]

*cgroup 程序*

cgroup 程序用于对 cgroup 内所有进程的网络过滤、套接字选项以及转发等进行动态控制，它最典型的应用场景是对容器中运行的多个进程进行网络控制。

![[image-2025-02-11-17-09-20-348.png]]

这些类型的 BPF 程序都可以通过 BPF 系统调用的 BPF_PROG_ATTACH 命令来进行挂载，并设置挂载类型为匹配的 BPF_CGROUP_xxx 类型。比如，在挂载BPF_PROG_TYPE_CGROUP_DEVICE 类型的 BPF 程序时，需要设置 bpf_attach_type 为BPF_CGROUP_DEVICE：

```c
union bpf_attr attr = {};
attr.target_fd = target_fd; // cgroup文件描述符
attr.attach_bpf_fd = prog_fd; // BPF程序文件描述符
attr.attach_type = BPF_CGROUP_DEVICE; // 挂载类型为BPF_CGROUP_DEVICE

if (bpf(BPF_PROG_ATTACH, &attr, sizeof(attr)) < 0) {
    return -errno;
} .
..
```


最流行的 Kubernetes 网络方案 Cilium 就大量使用了 XDP、TC 和套接字 eBPF 程序

.图中黄色部分即为 Cilium eBPF 程序
![[image-2025-02-11-17-13-09-207.png]]

### 其他类 eBPF 程序

除了上面的跟踪和网络 eBPF 程序之外，Linux 内核还支持很多其他的类型。这些类型的eBPF 程序虽然不太常用，但在需要的时候也可以帮你解决很多特定的问题

![[image-2025-02-11-17-14-45-039.png]]

根据具体功能和应用场景的不同，我们可以把 eBPF 程序分为跟踪、网络和其他三类:

- 跟踪类 eBPF 程序主要用于从系统中提取跟踪信息，进而为监控、排错、性能优化等提供数据支撑
- 网络类 eBPF 程序主要用于对网络数据包进行过滤和处理，进而实现网络的观测、过滤、流量控制以及性能优化等
- 其他类则包含了跟踪和网络之外的其他 eBPF 程序类型，如安全控制、BPF 扩展等。

虽然每个 eBPF 程序都有特定的类型和触发事件，但这并不意味着它们都是完全独立的。通过BPF 映射提供的状态共享机制，各种不同类型的 eBPF 程序完全可以相互配合，不仅可以绕过单个 eBPF 程序指令数量的限制，还可以实现更为复杂的控制逻辑。


## 内核跟踪（上）：如何查询内核中的跟踪点？

### 利用调试信息查询跟踪点

为了方便调试，内核把所有函数以及非栈变量的地址都抽取到了 /proc/kallsyms中，这样调试器就可以根据地址找出对应的函数和变量名称。对内核插桩类的 eBPF 程序来说，它们要挂载的内核函数就可以从 /proc/kallsyms 这个文件中查到

不过需要提醒你的是，这些符号表不仅包含了内核函数，还包含了非栈数据变量。而且，并不是所有的内核函数都是可跟踪的，只有显式导出的内核函数才可以被 eBPF 进行动态跟踪。因而，通常我们并不直接从内核符号表查询可跟踪点。

eBPF 程序的执行也依赖于调试文件系统，有了调试文件系统，你就可以从 /sys/kernel/debug/tracing 中找到所有内核预定义的跟踪点，进而可以在需要时把 eBPF 程序挂载到对应的跟踪点。

除了内核函数和跟踪点之外，性能事件又该如何查询呢？你可以使用 Linux 性能工具perf来查询性能事件的列表。

```bash
sudo perf list [hw|sw|cache|tracepoint|pmu|sdt|metric|metricgroup]
```

### 利用 bpftrace 查询跟踪点

bpftrace 在 eBPF 和 BCC 之上构建了一个简化的跟踪语言，通过简单的几行脚本，就可以实现复杂的跟踪功能。并且，多行的跟踪指令也可以放到脚本文件中执行（脚本后缀通常为 .bt)

bpftrace 会把你开发的脚本借助BCC编译加载到内核中执行，再通过 BPF 映射获取执行的结果

![[image-2025-02-11-17-30-37-703.png]]

安装好 bpftrace 之后，你就可以执行 bpftrace -l 来查询内核插桩和跟踪点了

- bpftrace内置变量精选

| 内置变量              | 类型             | 说明                                                      |
| ----------------- | -------------- | ------------------------------------------------------- |
| pid               | integer        | 进程 ID（内核 tgid）                                          |
| tid               | integer        | 线程 ID（内核 pid）                                           |
| uid               | integer        | 用户 ID                                                   |
| username          | string         | 用户名称                                                    |
| nsecs             | integer        | 时间戳，以纳秒为单位                                              |
| elapsed           | integer        | 时间戳，以纳秒为单位，从 bpfrace 初始化开始                              |
| cpu               | integer        | 处理器 ID                                                  |
| comm              | string         | 进程名称                                                    |
| kstack            | string         | 内核栈踪迹                                                   |
| ustack            | string         | 用户级栈踪迹                                                  |
| arg0, ..., argN   | integer        | 某些探针类型的参数                                               |
| args              | struct         | 某些探针类型的参数                                               |
| sarg0, ..., sargN | integer        | 某些探针类型的栈参数                                              |
| retval            | integer        | 某些探针类型的返回值                                              |
| func              | string         | 被跟踪函数的名称                                                |
| probe             | string         | 当前探针的完整名称                                               |
| curtask           | struct/integer | 内核 task_struct（可以是 task_struct 或无符号 64 位整数，取决于类型信息的可用性） |
| cgroup            | integer        | 当前进程的默认 cgroup v2 ID（用于与 cgroupid() 做比较）                |
| $1, ..., $N       | int, char *    | bpfrace 程序的位置参数                                         |

- bpftrace内置函数精选

| 函数                                      | 说明                                    |
| --------------------------------------- | ------------------------------------- |
| printf(char *fmt [, ...])               | 格式化打印                                 |
| time(char *fmt)                         | 打印格式化的时间                              |
| join(char *arr]])                       | 打印字符串数组，用空格字符连接                       |
| str(char *s [, int len])                | 返回来自指针 s 的字符串，有一个可选的长度限制              |
| buf(void *d [, int length])             | 返回十六进制字符串版本的数据指针                      |
| strncmp(char *s1, char *s2, int length) | 限定长度比较两个字符串                           |
| sizeof(expression)                      | 返回表达式或数据类型的大小                         |
| kstack([int limit])                     | 返回一个深度不超过限制帧的内核栈                      |
| ustack([int limit])                     | 返回一个深度不超过限制帧的用户栈                      |
| ksym(void *p)                           | 解析内核地址并返回地址的字符串标识                     |
| usym(void *p)                           | 解析用户空间地址并返回地址的字符串标识                   |
| kaddr(char *name)                       | 将内核标识名称解析为一个地址                        |
| uaddr(char *name)                       | 将用户空间的标识名称解析为一个地址                     |
| reg(char *name)                         | 返回存储在已命名的寄存器中的值                       |
| ntop([int af,] int addr)                | 返回一个 IPv4/IPv6 地址的字符串表示               |
| cgroupid(char *path)                    | 返回给定路径（/sys/fs/cgroup/...）的 cgroup ID |
| system(char *fmt [, ...])               | 执行 shell 命令                           |
| cat(char *filename)                     | 打印文件的内容                               |
| signal(char]] sig \| u32 sig)           | 向当前任务发送信号（例如，SIGTERM）                 |
| override(u64 rc)                        | 覆盖一个 kprobe 的返回值                      |
| exit()                                  | 退出 bpfrace                            |

- bpftrace内置的map函数

map是BPF特殊的哈希表存储对象，有多种不同的用途。例如可以作为哈希表存储键/值对或者用于统计汇总，bpftrace为map的赋值和操作提供了内置函数，多数内置函数用来支持统计汇总map的。

| 函数                                                   | 说明                                         |
| ---------------------------------------------------- | ------------------------------------------ |
| count()                                              | 计算出现的次数                                    |
| sum(int n)                                           | 数值求和                                       |
| min(int n)                                           | 记录最小值                                      |
| avg(int n)                                           | 求平均值                                       |
| max(int n)                                           | 记录最大值                                      |
| stats(int n)                                         | 返回计数、平均值和总数                                |
| hist(int n)                                          | 打印数值的 2 的幂级直方图                             |
| lhist(int n, const int min, const int max, int step) | 打印数值的线性直方图                                 |
| delete(@m[key])                                      | 删除 map 中指定的键 / 值对                          |
| print(@m [, top [, div]])                            | 打印 map，包括可选的限制（只输出最高的 top 个）和除数（将数值整除后再输出） |
| clear(@m)                                            | 删除 map 上的所有键                               |
| zero(@m)                                             | 将 map 的所有值设为零                              |


```bash
# 查询所有内核插桩和跟踪点
sudo bpftrace -l
# 使用通配符查询所有的系统调用跟踪点
sudo bpftrace -l 'tracepoint:syscalls:*'
# 使用通配符查询所有名字包含"execve"的跟踪点
sudo bpftrace -l '*execve*'
# 按照用户栈和进程对libc malloc的请求量进行统计
bpftrace -e 'uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc {@[ustack, comm] = sum(arg0); }'
# 对进程ID为181的进程 malloc请求的字节数进行求和统计
bpftrace -e 'uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc /pid == 181/ {@[ustack] = sum(arg0); }'
# 按照直方图的形式对pid为181的进程 malloc请求的字节数进行直方图统计
bpftrace -e 'uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc /pid == 181/ {@[ustack] = hist(arg0); }'
# 按内核的栈显示内核kmem缓存分配字节数的总和
bpftrace -e 't:kmem:kmem_cache_alloc { @bytes[kstack] = sum(args->bytes_alloc); }'
# 按照进程进行统计缺页故障 page faults by process
bpftrace -e 'software:page-fault:1 { @[comm, pid] = count(); }'
# 在用户成面统计缺页错误 Count user page faults by user-level stack trace
bpftrace -e 't:exceptions:page_fault_user { @[ustack, comm] = count(); }'
# 统计vmscan操作计数通过 tracepoint
bpftrace -e 'tracepoint:vmscan:* { @[probe] = count(); }'
# 按进程对swapin操作计数
bpftrace -e 'kprobe:swap_readpage { @[comm, pid] = count(); }'
# 对页迁移数量进行计数
bpftrace -e 'tracepoint:migrate:mm_migrate_pages { @ = count(); }'
# 跟踪页压缩事件
bpftrace -e 't:compaction:mm_compaction_begin { time(); }'
# 列出libc中的USDT探针
bpftrace -l 'usdt:/lib/x86_64-linux-gnu/libc.so.6:*'
# 列出内核的 kmem跟踪点
bpftrace -l 't:kmem:*'
```

对于跟踪点来说，你还可以加上 -v 参数查询函数的入口参数或返回值。而由于内核函数属于不稳定的 API，在 bpftrace中只能通过 arg0、arg1 这样的参数来访问，具体的参数格式还需要参考内核源代码。

```bash
# 查询execve入口参数格式
[root@k8smaster-40-170 ~]# sudo bpftrace -lv tracepoint:syscalls:sys_enter_execve
tracepoint:syscalls:sys_enter_execve
    int __syscall_nr
    const char * filename
    const char *const * argv
    const char *const * envp
# 查询execve返回值格式
[root@k8smaster-40-170 ~]# sudo bpftrace -lv tracepoint:syscalls:sys_exit_execve
tracepoint:syscalls:sys_exit_execve
    int __syscall_nr
    long ret
```

#### 使用bpftrace跟踪文件系统的性能

```bash
# 跟踪openat打开的文件，带进程名
bpftrace -e 't:syscalls:sys_enter_openat { printf("%s %s\n", comm,str(args->filename)); }'
# 按照系统调用类型统计读系统调用
bpftrace -e 'tracepoint:syscalls:sys_enter_*read* { @[probe] = count(); }'
# 按照系统调用类型统计写系统调用
bpftrace -e 'tracepoint:syscalls:sys_enter_*write* { @[probe] = count(); }'
# 显示read系统调用的请求大小分布
bpftrace -e 'tracepoint:syscalls:sys_enter_read { @ = hist(args->count); }'
Attaching 1 probe...
^C

@:
[1]                   86 |                                                    |
[2, 4)                20 |                                                    |
[4, 8)                60 |                                                    |
[8, 16)               86 |                                                    |
[16, 32)            2690 |@@@@@@@@@@@@@@@@@@@@@@@                             |
[32, 64)              39 |                                                    |
[64, 128)             49 |                                                    |
[128, 256)          1348 |@@@@@@@@@@@                                         |
[256, 512)          4185 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                 |
[512, 1K)           6051 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@|
[1K, 2K)            4425 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@              |
[2K, 4K)            1044 |@@@@@@@@                                            |
[4K, 8K)            4500 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@              |
[8K, 16K)            200 |@                                                   |
[16K, 32K)           293 |@@                                                  |
[32K, 64K)          3008 |@@@@@@@@@@@@@@@@@@@@@@@@@                           |
[64K, 128K)         1738 |@@@@@@@@@@@@@@                                      |
[128K, 256K)           1 |                                                    |
[256K, 512K)          54 |                                                    |

# 按照错误码统计read系统调用错误数
bpftrace -e 'tracepoint:syscalls:sys_exit_read { @ = hist(args->ret); }'
# 按照错误码统计read系统调用错误数
bpftrace -e 't:syscalls:sys_exit_read /args->ret < 0/ { @[- args->ret] = count(); }'
# 统计VFS调用次数
bpftrace -e 'kprobe:vfs_* { @[probe] = count(); }'
# 统计指定进程对VFS的调用次数
bpftrace -e 'kprobe:vfs_* /pid == 181/ { @[probe] = count(); }'
# 统计ext4的 tracepoints
bpftrace -e 'tracepoint:ext4:* { @[probe] = count(); }'
# 统计xfs的 tracepoints
bpftrace -e 'tracepoint:xfs:* { @[probe] = count(); }'
# 按照进程名和用户栈统计ext4文件读取数量
bpftrace -e 'kprobe:ext4_file_read_iter { @[ustack, comm] = count(); }'
# 追踪 ZFS spa_sunc的调用次数
bpftrace -e 'kprobe:spa_sync { time("%H:%M:%S ZFS spa_sync()\n"); }'
# 按照进程名和PID统计dcache的引用
bpftrace -e 'kprobe:lookup_fast { @[comm, pid] = count(); }'
```

#### *使用bpftrace跟踪系统磁盘性能*

```bash
# 计算块I/O tracepoint事件
bpftrace -e 'tracepoint:block:* { @[probe] = count(); }'
# 把块I/O 大小汇总成一张直方图
bpftrace -e 't:block:block_rq_issue { @bytes = hist(args->bytes); }'
# 计数块请求的用户栈踪迹
bpftrace -e 't:block:block_rq_issue { @[ustack] = count(); }'
bpftrace -e 't:block:block_rq_insert { @[ustack] = count(); }'
# 跟踪块I/O错误，包括设备和I/O类型
bpftrace -e 't:block:block_rq_complete /args->error/ {printf("dev %d type %s error %d\n", args->dev, args->rwbs, args->error); }'
# 计数块I/O类型的标志位
bpftrace -e 't:block:block_rq_issue { @[args->rwbs] = count(); }'
# 按照进程细分磁盘I/O大小分布
bpftrace -e 't:block:block_rq_issue /args->bytes/ { @[comm] = hist(args->bytes); }'
```

#### *使用bpftrace跟踪网络接口*

- 通过通配符统计多个函数的调用，这样能够显示哪个函数调用的最频繁

```bash
# 按照PID和进程名统计套接字accept的次数
bpftrace -e 't:syscalls:sys_enter_accept* { @[pid, comm] = count(); }'
# 增加调用堆栈的显示
bpftrace -e 't:syscalls:sys_enter_accept* { @[ustack, pid, comm] = count(); }'
# 按照PID和进程名统计套接字connect的次数
bpftrace -e 't:syscalls:sys_enter_connect { @[pid, comm] = count(); }'
# 通过用户栈踪迹统计套接字connect的数量，打印出堆栈信息
bpftrace -e 't:syscalls:sys_enter_connect { @[ustack, comm] = count(); }'
# 通过发送/接受方向、on-CPU的PID和进程名称统计套接字的数量
bpftrace -e 'k:sock_sendmsg,k:sock_recvmsg { @[func, pid, comm] = count(); }'
# 按on-CPU的PID和进程名统计套接字的发送/接受字节数
bpftrace -e 'kr:sock_sendmsg,kr:sock_recvmsg /(int32)retval > 0/ { @[pid, comm] = sum((int32)retval); }'
# 按on-CPU PID和进程名统计TCP连接数
bpftrace -e 'k:tcp_v*_connect { @[pid, comm] = count(); }'
# 按on-CPU PID 和进程名统计TCP接受accept次数
bpftrace -e 'k:inet_csk_accept { @[pid, comm] = count(); }'
# 按on-CPU PID和进程名统计TCP发送/接收的次数
bpftrace -e 'k:sock_sendmsg,k:sock_recvmsg { @[func, pid, comm] = count(); }'
# 按照直方图形式显示TCP 发送/接收的字节数，通过on-CPU PID和进程名
bpftrace -e 'kr:sock_sendmsg,kr:sock_recvmsg /(int32)retval > 0/ { @[pid, comm] = sum((int32)retval); }'
# 统计TCP发送字节数的直方图
bpftrace -e 'k:tcp_sendmsg { @send_bytes = hist(arg2); }'
# 统计TCP接收字节数的直方图
bpftrace -e 'kr:tcp_recvmsg /retval >= 0/ { @recv_bytes = hist(retval); }'
# 统计TCP重传类型和对端的IP地址
bpftrace -e 't:tcp:tcp_retransmit_* { @[probe, ntop(2, args->saddr)] = count(); }'
# 对所有的TCP函数（会给TCP增加高额的开销）进行计数
bpftrace -e 'k:tcp_* { @[func] = count(); }'
# 按 on-CPU PID 和进程名统计UDP发送/接收的次数
bpftrace -e 'k:udp*_sendmsg,k:udp*_recvmsg { @[func, pid, comm] = count(); }'
bpftrace -e 'kr:udp_sendmsg,kr:udp_recvmsg /(int32)retval > 0/ { @[pid, comm] = sum((int32)retval); }'
# 统计UDP发送字节直方图
bpftrace -e 'k:udp_sendmsg { @send_bytes = hist(arg2); }'
# UDP接收字节直方图
bpftrace -e 'kr:udp_recvmsg /retval >= 0/ { @recv_bytes = hist(retval); }'
# 统计内核传输(transmit)相关的内核堆栈信息
bpftrace -e 't:net:net_dev_xmit { @[kstack] = count(); }'
# 显示每个设备接收数据的CPU直方图
bpftrace -e 't:net:netif_receive_skb { @[str(args->name)] = lhist(cpu, 0, 128, 1); }'
# 统计ieee80211层的函数数量（会给数据包增加高额的开销）
bpftrace -e 'k:ieee80211_* { @[func] = count(); }'
```

#### 利用bpftrace跟踪CPU

```bash
#跟踪带有参数的新进程：
bpftrace -e 'tracepoint:syscalls:sys_enter_execve { join(args->argv); }'
#按进程对系统调用计数：
bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[pid, comm] = count(); }'
#按系统调用的探针名对系统调用计数：
bpftrace -e 'tracepoint:syscalls:sys_enter_* { @[probe] = count(); }'
#以 99Hz 的频率对运行中的进程名采样：
bpftrace -e 'profile:hz:99 { @[comm] = count(); }'
#以 49Hz 的频率按进程名称对用户栈和内核栈进行系统级别的采样：
bpftrace -e 'profile:hz:49 { @[kstack, ustack, comm] = count(); }'
#以 49Hz 对 PID 为 189 的用户级栈进行采样：
bpftrace -e 'profile:hz:49 /pid == 189/ { @[ustack] = count(); }'
#以 49Hz 对 PID 为 189 的用户级栈进行 5 帧的采样：
bpftrace -e 'profile:hz:49 /pid == 189/ { @[ustack(5)] = count(); }'
#对名为 “mysqld” 的进程，以 49Hz 对用户级栈采样：
bpftrace -e 'profile:hz:49 /comm == "mysqld"/ { @[ustack] = count(); }'
#对内核 CPU 调度器的 tracepoint 计数：
bpftrace -e 'tracepoint:sched:* { @[probe] = count(); }'
#统计上下文切换事件的 off-CPU 的内核栈：
bpftrace -e 'tracepoint:sched:sched_switch { @[kstack] = count(); }'
#统计以 “vfs_” 开头的内核函数调用：
bpftrace -e 'kprobe:vfs_* { @[func] = count(); }'
#通过 pthread_create() 跟踪新线程：
bpftrace -e 'u:/lib/x86_64-linux-gnu/libpthread-2.27.so:pthread_create { printf("%s by %s (%d)\n", probe, comm, pid); }'
```


#### 利用bpftrace跟踪内存

```bash
#按用户栈和进程计算 libc malloc() 请求字节数的总和（高开销）：
bpftrace -e 'u:/lib/x86_64-linux-gnu/libc.so.6:malloc { @[ustack, comm] = sum(arg0); }'
#按用户栈计算 PID 181 的 libc malloc() 请求字节数的总和（高开销）：
bpftrace -e 'u:/lib/x86_64-linux-gnu/libc.so.6:malloc /pid == 181/ { @[ustack] = sum(arg0); }'
#将 PID 181 的 libc malloc() 请求字节数按用户栈生成 2 的幂级直方图（高开销）：
bpftrace -e 'u:/lib/x86_64-linux-gnu/libc.so.6:malloc /pid == 181/ { @[ustack] = hist(pow2(arg0)); }'
#按内核栈踪迹对内核 kmem 缓存分配的字节数求和：
bpftrace -e 't:kmem:kmem_cache_alloc { @[kstack] = sum(args->bytes_alloc); }'
#按代码路径统计进程堆扩展（brk(2)）：
bpftrace -e 'tracepoint:syscalls:sys_enter_brk { @[ustack, comm] = count(); }'
#按进程统计缺页故障：
bpftrace -e 'software:page-fault:1 { @[comm, pid] = count(); }'
#按用户级栈踪迹统计用户缺页故障：
bpftrace -e 't:exceptions:page_fault_user { @[ustack, comm] = count(); }'
#按 tracepoint 统计 vmscan 操作
bpftrace -e 'tracepoint:vmscan:* { @[probe]++; }'
#按进程统计交换
bpftrace -e 'kprobe:swap_readpage { @[comm, pid] = count(); }'
#统计页面迁移
bpftrace -e 'tracepoint:migrate:mm_migrate_pages { @ = count(); }'
# 跟踪内存压缩事件
bpftrace -e 't:compaction:mm_compaction_begin { time(); }'
#列出 libc 中的 USDT 探针
bpftrace -l 'usdt:/lib/x86_64-linux-gnu/libc.so.6:*'
#列出内核的 kmem tracepoint
bpftrace -l 't:kmem:*'
#列出所有内存子系统 (mm) 的 tracepoint
bpftrace -l 't:*:mm_*'
```

- 1. `kprobe:inet_accept`
* **挂钩函数**: `inet_accept`
* **功能**: `inet_accept` 是内核中用于接受一个新的连接请求的函数。它通常在 TCP 套接字上调用，负责创建一个新的套接字来表示接受的连接。
* **调用时机**: 当应用程序调用 `accept()` 系统调用时，内核会调用 `inet_accept` 来处理连接请求。
* **使用场景**: 如果你想要跟踪所有通过 `accept()` 系统调用接受的连接，可以使用 `kprobe:inet_accept`。

- 2. `kprobe:inet_csk_accept`
* **挂钩函数**: `inet_csk_accept`
* **功能**: `inet_csk_accept` 是 `inet_accept` 的一个底层实现，属于内核的 TCP 协议栈的一部分。它负责从已完成连接队列中取出一个连接，并返回一个新的套接字。
* **调用时机**: `inet_csk_accept` 是在 `inet_accept` 内部调用的，专门用于 TCP 套接字的连接接受。
* **使用场景**: 如果你想要更深入地了解 TCP 连接接受的过程，或者只对 TCP 连接的接受感兴趣，可以使用 `kprobe:inet_csk_accept`。

- 主要区别
* **抽象层次**: `inet_accept` 是一个更高层次的函数，适用于所有类型的套接字（如 TCP、UDP 等），而 `inet_csk_accept` 是专门用于 TCP 套接字的底层函数。
* **调用关系**: `inet_accept` 会调用 `inet_csk_accept` 来处理 TCP 连接的接受。
* **使用场景**: `inet_accept` 更适合用于跟踪所有类型的连接接受，而 `inet_csk_accept` 更适合用于深入分析 TCP 连接的接受过程。


## PMCs (硬件事件)

PMCs（Performance Monitoring Counters）是性能检测计数器，可以解释CPU周期性能

.github地址: https://github.com/brendangregg/pmc-cloud-tools/tree/master[PMC]

.可分别在容器和虚拟机中执行
```bash
serverA# ./pmcarch -p 4093 10
K_CYCLES   K_INSTR    IPC BR_RETIRED     BR_MISPRED BMR% LLCCREF LLCMISS LLC%
982412660  575706336  0.59  126424862460  2416880487  1.91  15724006692  10872315070  30.86
999621309  555043627  0.56  120449284756  2317302514  1.92  15378257714  11121882510  27.68
991146940  558145849  0.56  126350181501  2530383860  2.00  15965082710  11464682655  28.19
996314688  562276830  0.56  122215605985  2348638980  1.92  15558286345  10835594199  30.35
979890037  560268707  0.57  125609807909  2386085660  1.90  15828820588  11038597030  30.26
```

K_INSTR：指示处理器周期数
K_INSTR：指示处理器上执行的指令数
IPC：每周期指令执行次数

IPC越高说明执行效率越好，性能也越好，一般是1.0以上，这偏低只有1.59左右，观察后面可以得出结论，LLC也就是虚拟机最后一级的缓存(LLC)命中率只有30%左右，因此导致指令在访问主存时经常停滞。

通常是如下原因导致的：

- 较小的LLC大小 （33MB对45MB）
- CPU饱和度高会导致更多上下文切换，以及更多的代码路径之间的跳跃(包括用户和内核)，从而增加了缓存压力

研究完硬件事件PMCs可以看下软件事件，我们可以使用perf命令查看计算机系统的上下文切换率。

.每秒钟上下文切换的次数
```bash
serverA# perf stat -e cs -a -I 1000

#       time           counts unit events
1.000411740   2,063,105    cs
2.000977435   2,065,354    cs
3.001537756   1,527,297    cs
4.002028407   515,509      cs
5.002538455   2,447,126    cs
6.003114251   2,021,182    cs
7.003665091   2,329,157    cs
8.004093520   1,740,898    cs
9.004533912   1,235,641    cs
10.005106500  2,340,443    cs
^C
10.513632795  1,496,555    cs
```

如果上下文切换过多会导致性能下降

如果需要进一步跟踪可以使用bcc工具中的 cpudist,cpuwalk,runqlen,runqslower,cpuunclaimed





### 如何利用内核跟踪点排查短时进程问题？

在排查系统 CPU 使用率高的问题时，我想你很可能遇到过这样的困惑：明明通过 top 命令发现系统的 CPU 使用率（特别是用户 CPU 使用率）特别高，但通过 ps、pidstat 等工具都找不出 CPU 使用率高的进程。这是什么原因导致的呢？

- 第一，应用程序里面直接调用其他二进制程序，并且这些程序的运行时间很短，通过 top 工具不容易发现；
- 第二，应用程序自身在不停地崩溃重启中，且重启间隔较短，启动过程中资源的初始化导致了高 CPU 使用率。

如果利用 eBPF 的事件触发机制，跟踪内核每次新创建的进程，你就能轻松的找到问题进程。

因为我们要关心的主要是新创建进程的基本信息，而像进程名称和参数等信息都在 execve() 的参数里，所以我们就要找出 execve() 所对应的内核函数或跟踪点。

```bash
sudo bpftrace -l '*execve*'

kprobe:__ia32_compat_sys_execve
kprobe:__ia32_compat_sys_execveat
kprobe:__ia32_sys_execve
kprobe:__ia32_sys_execveat
kprobe:__x32_compat_sys_execve
kprobe:__x32_compat_sys_execveat
kprobe:__x64_sys_execve
kprobe:__x64_sys_execveat
kprobe:audit_log_execve_info
kprobe:bprm_execve
kprobe:do_execveat_common.isra.0
kprobe:kernel_execve
tracepoint:syscalls:sys_enter_execve
tracepoint:syscalls:sys_enter_execveat
tracepoint:syscalls:sys_exit_execve
tracepoint:syscalls:sys_exit_execveat
```


从输出中，你可以发现这些函数可以分为内核插桩（kprobe）和跟踪点（tracepoint）两类。 在上一小节中我曾提到，内核插桩属于不稳定接口，而跟踪点则是稳定接口。因而，在内核插桩和跟踪点两者都可用的情况下，应该选择更稳定的跟踪点，以保证 eBPF 程序的可移植性（即在不同版本的内核中都可以正常执行）。

- bpftrace 通常用在快速排查和定位系统上，它支持用单行脚本的方式来快速开发并执行一个 eBPF 程序。不过，bpftrace 的功能有限，不支持特别复杂的 eBPF 程序，也依赖于BCC 和 LLVM 动态编译执行。
- BCC 通常用在开发复杂的 eBPF 程序中，其内置的各种小工具也是目前应用最为广泛的 eBPF 小程序。不过，BCC 也不是完美的，它依赖于 LLVM 和内核头文件才可以动态编译和加载 eBPF 程序。
- libbpf 是从内核中抽离出来的标准库，用它开发的 eBPF 程序可以直接分发执行，这样就不需要每台机器都安装 LLVM 和内核头文件了。不过，它要求内核开启 BTF 特性

## 内核跟踪（下）：开发内核跟踪程序的进阶方法

### libbpf 方法

使用 libbpf 开发eBPF 程序也是分为两部分：第一，内核态的 eBPF 程序；第二，用户态的加载、挂载、映射
读取以及输出程序等。

在 eBPF 程序中，由于内核已经支持了 BTF，你不再需要引入众多的内核头文件来获取内核 数据结构的定义。取而代之的是一个通过 bpftool 生成的 vmlinux.h 头文件，其中包含了内核数据结构的定义。

1. 使用 bpftool 生成内核数据结构定义头文件。BTF 开启后，你可以在系统中找到/sys/kernel/btf/vmlinux 这个文件，bpftool 正是从它生成了内核数据结构头文件。
2. 开发 eBPF 程序部分。为了方便后续通过统一的 Makefile 编译，eBPF 程序的源码文件一般命名为 <程序名>.bpf.c。
3. 编译 eBPF 程序为字节码，然后再调用 bpftool gen skeleton 为 eBPF 字节码生成脚手架头文件（Skeleton Header）。这个头文件包含了 eBPF 字节码以及相关的加载、挂载和卸载函数，可在用户态程序中直接调用。
4. 最后就是用户态程序引入上一步生成的头文件，开发用户态程序，包括 eBPF 程序加载、挂载到内核函数和跟踪点，以及通过 BPF 映射获取和打印执行结果等


```makefile
APPS = execsnoop
.PHONY: all
all: $(APPS)
$(APPS):
    clang -g -O2 -target bpf -D__TARGET_ARCH_x86_64 -I/usr/include/x86_64-linux
    bpftool gen skeleton $@.bpf.o > $@.skel.h
    clang -g -O2 -Wall -I . -c $@.c -o $@.o
    clang -Wall -O2 -g $@.o -static -lbpf -lelf -lz -o $@
vmlinux:
    # 生成内核数据结构的头文件
    $(bpftool) btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h
```

## 用户态跟踪：如何使用 eBPF 排查应用程序？

在静态语言的编译过程中，通常你可以加上 -g 选项保留调试信息。这样，源代码中的函数、变量以及它们对应的代码行号等信息，就以 DWARF（Debugging With AttributedRecord Formats，Linux 和类 Unix 平台最主流的调试信息格式）格式存储到了编译后的二进制文件中。

有了调试信息，你就可以通过 readelf、objdump、nm 等工具，查询可用于跟踪的函数、变量等符号列表。比如，我经常使用 readelf 命令，查询二进制文件的基本信息。

```bash
# 查询符号表（RHEL8系统中请把动态库路径替换为/usr/lib64/libc.so.6）
readelf -Ws /usr/lib/x86_64-linux-gnu/libc.so.6
# 查询USDT信息（USDT信息位于ELF文件的notes段）
readelf -n /usr/lib/x86_64-linux-gnu/libc.so.6
```

 bpftrace 工具也可以用来查询 uprobe 和 USDT 跟踪点，其查询格式如下所示（同样支持 * 通配符过滤）：

```bash
# 查询uprobe（RHEL8系统中请把动态库路径替换为/usr/lib64/libc.so.6）
bpftrace -l 'uprobe:/usr/lib/x86_64-linux-gnu/libc.so.6:*'
# 查询USDT
bpftrace -l 'usdt:/usr/lib/x86_64-linux-gnu/libc.so.6:*'
```

uprobe 是基于文件的。当文件中的某个函数被跟踪时，除非对进程PID 进行了过滤，默认所有使用到这个文件的进程都会被插桩。

## 网络跟踪：如何使用 eBPF 排查网络问题？

网络不仅是 eBPF 应用最早的领域，也是目前 eBPF 应用最为广泛的一个领域。随着分布式系统、云计算和云原生应用的普及，网络已经成为了大部分应用最核心的依赖，随之而来的网络问题也是最难排查的问题之一。

### eBPF 提供了哪些网络功能？

![[image-2025-02-12-09-04-25-434.png]]

网络协议栈也是内核的一部分，因而网络相关的内核函数、跟踪点以及用户程序的函数等，也都可以使用前几讲我们提到的 kprobe、uprobe、USDT 等跟踪类 eBPF 程序进行跟踪

eBPF 提供了大量专用于网络的 eBPF 程序类型，包括XDP 程序、TC 程序、套接字程序以及 cgroup 程序等。这些类型的程序涵盖了从网卡（如卸载到硬件网卡中的 XDP 程序）到网卡队列（如 TC 程序）、封装路由（如轻量级隧道程序）、TCP 拥塞控制、套接字（如 sockops 程序）等内核协议栈，再到同属于一个 cgroup 的一组进程的网络过滤和控制，而这些都是内核协议栈的核心组成部分

### 如何跟踪内核网络协议栈？

根据调用栈回溯路径，找出导致某个网络事件发生的整个流程，进而就可以再根据这些流程中的内核函数进一步跟踪。

对 Linux 网络丢包问题来说，内核协议栈执行的结尾，当然就是释放最核心的 SKB （Socket Buffer）数据结构。查询内核 SKB 文档，你可以发现，内核中释放 SKB 相关的函数有两个：

1. 第一个，kfree_skb ，它经常在网络异常丢包时调用
2. 第二个，consume_skb，它在正常网络连接完成时调用

bpftrace 提供了 kstack 和 ustack 这两个内置变量，分别用于获取内核和进程的调用栈。

```bash
bpftrace -e 'kprobe:kfree_skb /comm=="curl"/ { printf("kstack: %s\n", kstack());}'
```

```bash
# 使用faddr2line可以查看内核函数位置
faddr2line /usr/lib/debug/boot/vmlinux-5.13.0-22-generic __ip_local_out+219
```

```bash
# 追踪 net 相关追踪点以及调用堆栈，追踪所有的调用关系
bpftrace -e 'tracepoint:net:* { printf("%s(%d): %s %s\n", comm, pid, probe, kstack()); }'
# 使用 perf trace 也比较方便
perf trace --no-syscalls -e 'net:*' curl -s time.geekbang.org > /dev/null
```



## 容器安全：如何使用 eBPF 增强容器安全？

故障诊断、网络优化、安全控制、性能监控等，都已是 eBPF 的主战场

随着容器和云原生技术的普及，由于容器天生共享内核的特性，容器的安全和隔离就是所有容器平台头上的“紧箍咒”。因此，如何快速定位容器安全问题，如何确保容器的隔离，以及如何预防容器安全漏洞等，是每个容器平台都需要解决的头号问题。

### eBPF 都有哪些安全能力？

对于安全问题的分析与诊断，eBPF 无需修改并重新编译内核和应用就可以动态分析内核及应用的行为。这在很多需要保留安全问题现场的情况下非常有用。特别是在紧急安全事件的处理过程中，eBPF 可以实时探测进程或内核中的可疑行为，进而帮你更快地定位安全问题的根源。

Aqua Security 开源的 Tracee 项目就利用 eBPF，动态跟踪系统和应用的可疑行为模式，再与不断丰富的特征检测库进行匹配，就可以分析出容器应用中的安全问题。

![[image-2025-02-12-09-42-40-830.png]]

.eBPF安全跟踪点
![[2023-03-13-16-01-55-d8ec91bff9d070bd6c9af1306dd74a4.jpg]]

曾使用过 sysdig，老版本通过插入内核模块的方式进行安全审计。后来 sysdig 支持了 eBPF driver，主要通过追踪系统调用分析可能的安全隐患。sysdig eBPF driver 实现比较简单，一共十几个 program，统一放在 probe.c 源文件，里面的思路借鉴下还是不错的。

## 高性能网络实战（上）：如何开发一个负载均衡器

- XDP 程序在网络驱动程序刚刚收到数据包的时候触发执行，支持卸载到网卡硬件，常用于防火墙和四层负载均衡
- TC 程序在网卡队列接收或发送的时候触发执行，运行在内核协议栈中，常用于流量控制；
- 套接字程序在套接字发生创建、修改、收发数据等变化的时候触发执行，运行在内核协议栈中，常用于过滤、观测或重定向套接字网络包。其中，BPF_PROG_TYPE_SOCK_OPS、BPF_PROG_TYPE_SK_SKB、BPF_PROG_TYPE_SK_MSG 等都可以用于套接字重定向
- cgroup 程序在 cgroup 内所有进程的套接字创建、修改选项、连接等情况下触发执行，常用于过滤和控制 cgroup 内多个进程的套接字。

## 高性能网络实战（下）：如何完善负载均衡器

对于网络优化来说，除了套接字 eBPF 程序，XDP 程序和 TC 程序也可以用来优化网络的性能。特别是 XDP 程序，由于它在 Linux 内核协议栈之前就可以处理网络包，在负载均衡、防火墙等需要高性能网络的场景中已经得到大量的应用

XDP 处理过的数据包还可以正常通过内核协议栈继续处理，所以你只需要在 XDP 程序中实现最核心的网络逻辑就可以了

SEC("xdp") 表示程序的类型为 XDP 程序。你可以在 libbpf 中 section_defs 找到所有 eBPF 程序类型对应的段名称格式。

在 Linux 内核的 conntrack 机制里，如果收到了乱序的包，在缺省配置的情况下（这里提示下，可以去了解一下内核 ip_conntrack_tcp_be_liberal 这个参数），就是会放过这个包而不去做 NAT 的，这是一个很常见的问题了

## 实用 eBPF 工具及最新开源项目总结

![[image-2025-02-12-11-39-19-354.png]]

![[image-2025-02-12-11-41-27-330.png]]

![[image-2025-02-12-11-46-24-356.png]]

![[image-2025-02-12-11-49-17-694.png]]


## 以下工具部分来自 perf-tools

https://github.com/brendangregg/perf-tools/tree/master[perf-tools]

## funccount

funccount 是一个用于统计函数调用次数的工具，它使用 eBPF 技术来统计函数调用次数，并输出统计结果。


```bash
#对VFS内核调用进行计数
funcgraph 'vfs_*'
# 堆TCP内核调用计数
funccount 'tcp_*'
# 对每秒的TCP发送调用计数
funccount -i 1 'tcp_send*'
# 显示每秒块I/O事件的次数
funccount -i 1 't:block_*'
# 每秒libc的getaddrinfo 名字解析 执行次数
funccount -i 1 c:getaddrinfo
```

### stackcount

```bash
# 对创建块I/O的栈踪迹进行计数
stackcount -i 1 't:block:block_rq_insert'
# 对发送IP包的栈踪迹进行计数带对应PID
stackcount -p ip_output
# 针对导致线程阻塞并切换到off-CPU的栈踪迹进行计数
stackcount t:sched:sched_switch
```









## 参考

https://arthurchiao.art/blog/cilium-bpf-xdp-reference-guide-zh/#bpf_helper[bpf-helper

https://mp.weixin.qq.com/s/25mhUrNhF3HW8H6-ES7waA[epbf-st

https://gist.github.com/BruceChen7/8b15bdc26d2831e91983b3b52f114e60?permalink_comment_id=3263483[bcc-understand]
































