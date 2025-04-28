

## Upper and Lower

An overlay filesystem combines two filesystems - an 'upper' filesystem  and a 'lower' filesystem.  When a name exists in both filesystems, the object in the 'upper' filesystem is visible while the object in the 'lower' filesystem is either hidden or, in the case of directories, merged with the 'upper' object.

> 文件覆盖，目录合并

The lower filesystem can be any filesystem supported by Linux and does not need to be writable.  The lower filesystem can even be another overlayfs.  The upper filesystem will normally be writable and if it is it must support the creation of trusted.* extended attributes, and must provide valid d_type in readdir responses, so NFS is not suitable.

> lower层文件系统可以是任何文件系统，甚至可以是其他的overlayfs，upper层文件系统必须是可写的，并且必须支持trusted.*扩展属性，OverlayFS 使用 trusted.overlay.* 扩展属性来管理文件的元数据（如文件的来源层，如果上层目录不支持扩展属性，OverlayFS 将无法正常工作，而NFS则不能使用OverlayFS。


### whiteouts and opaque directories(白色和不透明目录)

In order to support rm and rmdir without changing the lower filesystem, an overlay filesystem needs to record in the upper filesystem that files have been removed.  This is done using whiteouts and opaque directories (non-directories are always opaque).

A whiteout is created as a character device with 0/0 device number.  When a whiteout is found in the upper level of a merged directory, any matching name in the lower level is ignored, and the whiteout itself is also hidden.

> 通过创建一个 0/0 的特殊字符设备文件来实现对 lower层文件的隐藏。

A directory is made opaque by setting the xattr "trusted.overlay.opaque"
to "y".  Where the upper filesystem contains an opaque directory, any
directory in the lower filesystem with the same name is ignored.

When a 'readdir' request is made on a merged directory, the upper and  lower directories are each read and the name lists merged in the obvious way (upper is read first, then lower - entries that already exist are not re-added). This merged name list is cached in the 'struct file' and so remains as long as the file is kept open.  If the directory is opened and read by two processes at the same time, they
will each have separate caches.  A seekdir to the start of the directory (offset 0) followed by a readdir *will cause the cache to be discarded and rebuilt*.

> 如果两个进程同时打开一个目录，它们会分别拥有自己的缓存，如果其中一个进程通过seekdir将目录移动到开头，然后通过readdir来读取目录，就会导致缓存被丢弃并重建。

###  workdir

- 支持文件重命名操作：在OverlayFS中，当你尝试对merged视图中的文件进行重命名操作时（例如，使用 mv 命令），这些操作需要 workdir 来临时存放数据。这是因为OverlayFS需要一种方式来处理可能跨越不同层（如从 upperdir 到 lowerdir 或反之）的文件移动或重命名操作。
- 确保文件系统的稳定性：通过提供一个专门的工作空间，workdir 有助于保持文件系统的一致性和稳定性，特别是在执行复杂操作时。

### eg

```bash
#!/bin/bash

umount ./merged
rm upper lower merged work -r

mkdir -p upper/both_dir lower/both_dir merged work
echo "I'm from lower!" > lower/in_lower.txt
echo "I'm from upper!" > upper/in_upper.txt
# `in_both` is in both directories
echo "I'm from lower!" > lower/in_both.txt
echo "I'm from upper!" > upper/in_both.txt

sudo mount -t overlay overlay \
 -o lowerdir=./lower,upperdir=./upper,workdir=./work \
 ./merged
```

- lower && upper 的合并过程

```bash
[root@k8smaster-ims temp]# tree .
.
├── lower
│   ├── both_dir
│   │   └── lower_both.txt
│   ├── in_both.txt
│   └── in_lower.txt
├── merged
│   ├── both_dir
│   │   ├── lower_both.txt
│   │   └── upper_both.txt
│   ├── in_both.txt
│   ├── in_lower.txt
│   └── in_upper.txt
├── test.sh
├── upper
│   ├── both_dir
│   │   └── upper_both.txt
│   ├── in_both.txt
│   └── in_upper.txt
└── work
    └── work

8 directories, 12 files
```

> 1. 文件upper覆盖lower
2. 目录upper和lower合并


- 删除lower文件只是标记为特殊文件(without)并不是真的删除lower文件

```bash
[root@k8smaster-ims temp]# cd  merged/
[root@k8smaster-ims merged]# rm in_lower.txt
[root@k8smaster-ims merged]# cd ../
[root@k8smaster-ims temp]# tree .
.
├── lower
│   ├── both_dir
│   │   └── lower_both.txt
│   ├── in_both.txt
│   └── in_lower.txt
├── merged
│   ├── both_dir
│   │   ├── lower_both.txt
│   │   └── upper_both.txt
│   ├── in_both.txt
│   └── in_upper.txt
├── test.sh
├── upper
│   ├── both_dir
│   │   └── upper_both.txt
│   ├── in_both.txt
│   ├── in_lower.txt
│   └── in_upper.txt
└── work
    └── work
        └── #f0d

8 directories, 13 files
[root@k8smaster-ims temp]# ls -al upper/
total 20
drwxr-xr-x 3 root root 4096 Feb 17 10:14 .
drwxr-xr-x 6 root root 4096 Feb 17 10:09 ..
drwxr-xr-x 2 root root 4096 Feb 17 10:09 both_dir
-rw-r--r-- 1 root root   16 Feb 17 10:09 in_both.txt
c--------- 2 root root 0, 0 Feb 17 10:14 in_lower.txt
-rw-r--r-- 1 root root   16 Feb 17 10:09 in_upper.txt
```

- mv或者对公共文件操作会在work生成临时文件

```bash
[root@k8smaster-ims temp]# mv ./merged/both_dir/ ./merged/mv_dir
[root@k8smaster-ims temp]# tree .
.
├── lower
│   ├── both_dir
│   │   └── lower_both.txt
│   ├── in_both.txt
│   └── in_lower.txt
├── merged
│   ├── in_both.txt
│   ├── in_lower.txt
│   ├── in_upper.txt
│   └── mv_dir
│       ├── lower_both.txt
│       └── upper_both.txt
├── test.sh
├── upper
│   ├── both_dir
│   ├── in_both.txt
│   ├── in_upper.txt
│   └── mv_dir
│       ├── lower_both.txt
│       └── upper_both.txt
└── work
    └── work
        └── #f1b

8 directories, 15 files
```

从上面的操作可以看出，向merged中写入文件其实就是向本地磁盘写入文件

### 用验证prometheus的pod进行验证

- 使用 `kubectl describe pod prometheus-k8s-0 -n base-services ` 查看prometheus的容器ID

- 查看对应容器的挂载信息

`cat /proc/mounts |grep 3f7a1307348a597f2ea8abc82f45d4d12c3e8851197a657a82f1daba51d5dd43`

```bash
[root@k8smaster-ims ~]# cat /proc/mounts |grep 3f7a1307348a597f2ea8abc82f45d4d12c3e8851197a657a82f1daba51d5dd43
overlay /run/containerd/io.containerd.runtime.v2.task/k8s.io/3f7a1307348a597f2ea8abc82f45d4d12c3e8851197a657a82f1daba51d5dd43/rootfs overlay rw,relatime,
lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/912/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/911/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/910/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/909/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/908/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/907/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/906/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/905/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/904/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/903/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/902/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/901/fs,
upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1216/fs,
workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1216/work 0 0
```

- 对比mount文件和容器的挂载信息

```bash
[root@k8smaster-ims prometheus]# pwd
/run/containerd/io.containerd.runtime.v2.task/k8s.io/3f7a1307348a597f2ea8abc82f45d4d12c3e8851197a657a82f1daba51d5dd43/rootfs/etc/prometheus
[root@k8smaster-ims prometheus]# ls
certs  config_out  console_libraries  consoles  prometheus.yml  rules  web_config
[root@k8smaster-ims prometheus]# kubectl exec -it prometheus-k8s-0  -n base-services -- sh
/prometheus $ cd  /etc/prometheus/
/etc/prometheus $ ls
certs              console_libraries  prometheus.yml     web_config
config_out         consoles           rules
```

经过对比可以看到挂在目录和文件目录本身中的文件是相同的。

### 为什么直接在容器中写文件比宿主机上写文件性能差

虽然都是在写到宿主机上，但是容器中的文件系统是overlayfs，overlayfs需要每次在打开或者查询文件时先从upper目录，然后再遍历各个lower子目录，最终确定文件的操作方式（是否需要创建临时文件，是否需要创建without文件等），特别是频繁的创建或者读取小文件时，性能会比直接在宿主机上操作较低。详情参见： https://www.kernel.org/doc/Documentation/filesystems/overlayfs.txt[kernel overlayfs]



















