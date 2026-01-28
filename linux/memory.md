

## IO Cache
顾名思义，Cache 即为缓存，IO 是指令外设传输（IN/OUT）数据的操作。
缓存是怎么回事我们都知道，由此我们就可以这样理解 IO Cache：把外设的 IO 操作的数据保存起来，当重新执行 IO 操作时，先从之前保存的地方开始查找，若找到需要的数据，即为命中，这时就不要去操作外设了；若没有命中就去操作外设。其中的数据，会根据 IO 操作频率进行组织，把操作最频繁的内容放在最容易找到的位置，达到性能最优化。

```bash
[root@bash40 ~]# free -m 
               total        used        free      shared  buff/cache   available
Mem:           31826       19446        1258        2953       16058       12380
Swap:              0           0           0
```
上图中的 buff/cache，就是我们所说的 IO Cache 占用的内存。从这个角度，是不是看得更透彻了？所谓 IO Cache，不过是操作系统基于某种算法管理的一块内存空间，用该内存空间缓存 IO 设备的数据，应用多次读写外设数据会更方便，而不需要反复发起 IO 操作。

其实早期的 Cache 是位于 CPU 和内存之间的高速缓存，由于硬件实现的 Cache 芯片的速度仅次于 CPU，而内存速度远小于 CPU，Cache 只是为了缓存内存中的数据，加快 CPU 的性能，避免 CPU 等待内存。而 Buffer 是在内存中由软件实现的，用于缓存 IO 设备的数据，缓解由于 IO 设备过慢带来系统性能下降。
但是现在 Buffer 和 Cache 成了在计算机技术中被用滥的两个名词。在 Linux 的内存管理中， Buffer 指 Linux 内存的 Buffer Cache，而 Cache 是指 Linux 内存中的 Page Cache，翻译成中文可以叫做缓冲区缓存和页面缓存，用来缓存 IO 设备的读、写数据。补充一句，这里的IO 设备，主要指的是块设备文件和文件系统上的普通文件。

在当前的 Linux 内核中，BufferCache 建立 Page Cache 之上，如下图所示

![[Pasted image 20260128144343.png]]

在现代 Linux 的实现中，远比上图画得要复杂得多，不过我们只需要关注这个层次结构就行了。Buffer Cache 中有多个小块组成，块大小通常为 512 字节，在 Linux 内核中用一个 struct Bio 结构来描述块，而一个物理内存页中存在多个块，多个 struct Bio 结构形成 Buffer Cache，多个这种页就形成了 Page Cache

在操作系统理论中，这一套实现机制被抽象为 IO Cache。但是，各种操作系统的实现的叫法不同，在此不必展开了，我们只需要明白它们能在内存中缓存设备数据就行了。


一般情况下，Linux 内核中的 IO 操作，会从上至下经过三大逻辑层，具体如下：
1. 文件系统层。因为 Linux 中万物皆为文件，IO 操作首先会经过文件系统，Linux 为了兼容不同的文件系统，对文件、目录等文件系统对象进行了抽象，形成了 VFS 层，也是 IO 操作经历的第一层。
2. 块层。Linux 内核把各种设备分成块设备，字符设备、网络设备和硬盘都属于块设备，块层主要负责管理块设备的 IO 队列，对 IO 请求进行合并、排序等操作
3. 设备层。具体设备驱动通过 DMA 与内存交互，完成数据和具体设备之间的交换，此例子中的设备为硬盘。

![[Pasted image 20260128144638.png]]

IO 操作在到达 Linux 的 VFS 层后，会根据相应的 IO 操作标志确定是 DirectIO 还是BufferedIO，如果是前者则不经过 Cache，直接由块层发送到设备层，完成 IO 操作；如果是后者，则 IO 操作到达 Page Cache 之后就返回了。

在某一时刻，Linux 会启动 pdflush 线程，该线程会扫描 PageCache 中的脏页，进而找到对应的 Bio 结构，然后把 Bio 结构发送给块层的 IO 调度器，调度器会对 bio 进行合并、排序，以提高 IO 效率。

之后，调用设备层的相关函数将 Bio 转发到设备驱动程序处理，设备驱动程序函数对 IO 请求队列中每个 Bio 进行分别处理，根据 Bio 中的信息向磁盘控制器发送命令。处理完成后，调用Bio 完成函数以通知上层完成了操作。这便是一个 IO 操作的过程。

















## 附录

[What every programmer should know about memory, Part 1 [LWN.net]](https://lwn.net/Articles/250967/)
[Memory part 2: CPU caches [LWN.net]](https://lwn.net/Articles/252125/)
[Memory part 3: Virtual Memory [LWN.net]](https://lwn.net/Articles/253361/)
[Memory part 4: NUMA support [LWN.net]](https://lwn.net/Articles/254445/)
[Memory part 5: What programmers can do [LWN.net]](https://lwn.net/Articles/255364/)
[Memory part 6: More things programmers can do [LWN.net]](https://lwn.net/Articles/256433/)
[Memory part 7: Memory performance tools [LWN.net]](https://lwn.net/Articles/257209/)
[Memory part 8: Future technologies [LWN.net]](https://lwn.net/Articles/258154/)
[Memory part 9: Appendices and bibliography [LWN.net]](https://lwn.net/Articles/258188/)


