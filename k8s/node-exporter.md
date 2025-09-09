node-exporter的工作原理太简单了，简单到市面上无法找到一本知名的书籍来讲解node-exporter的工作原理，但这并不意味着node-exporter不重要，相反基本上有prometheus的地方都会存在node-exporter

## Collectors 
通过提供 `--collector.<name>` 标志可以启用收集器。默认启用的收集器可以通过提供 `--no-collector.<name>` 标志来禁用。如需仅启用部分特定收集器，请使用 `--collector.disable-defaults --collector.<name> ...` 。

如果嫌指标太多，可以通过 `./node_exporter -h` 查看支持的flags参数


### Include & Exclude flags  
  
A few collectors can be configured to include or exclude certain patterns using dedicated flags. The exclude flags are used to indicate "all except", while the include flags are used to say "none except". Note that these flags are mutually exclusive on collectors that support both.

  
```txt  
--collector.filesystem.mount-points-exclude=^/(dev|proc|sys|var/lib/docker/.+|v
```

| Collector  | Scope        | Include Flag                                | Exclude Flag                                |
| ---------- | ------------ | ------------------------------------------- | ------------------------------------------- |
| arp        | device       | --collector.arp.device-include              | --collector.arp.device-exclude              |
| cpu        | bugs         | --collector.cpu.info.bugs-include           | N/A                                         |
| cpu        | flags        | --collector.cpu.info.flags-include          | N/A                                         |
| diskstats  | device       | --collector.diskstats.device-include        | --collector.diskstats.device-exclude        |
| ethtool    | device       | --collector.ethtool.device-include          | --collector.ethtool.device-exclude          |
| ethtool    | metrics      | --collector.ethtool.metrics-include         | N/A                                         |
| filesystem | fs-types     | --collector.filesystem.fs-types-include     | --collector.filesystem.fs-types-exclude     |
| filesystem | mount-points | --collector.filesystem.mount-points-include | --collector.filesystem.mount-points-exclude |
| hwmon      | chip         | --collector.hwmon.chip-include              | --collector.hwmon.chip-exclude              |
| hwmon      | sensor       | --collector.hwmon.sensor-include            | --collector.hwmon.sensor-exclude            |
| interrupts | name         | --collector.interrupts.name-include         | --collector.interrupts.name-exclude         |
| netdev     | device       | --collector.netdev.device-include           | --collector.netdev.device-exclude           |
| qdisk      | device       | --collector.qdisk.device-include            | --collector.qdisk.device-exclude            |
| slabinfo   | slab-names   | --collector.slabinfo.slabs-include          | --collector.slabinfo.slabs-exclude          |
| sysctl     | all          | --collector.sysctl.include                  | N/A                                         |
| systemd    | unit         | --collector.systemd.unit-include            | --collector.systemd.unit-exclude            |
### Enabled by default

Name     | Description | OS  
---------|-------------|----  
arp | Exposes ARP statistics from `/proc/net/arp`. | Linux  
bcache | Exposes bcache statistics from `/sys/fs/bcache/`. | Linux  
bonding | Exposes the number of configured and active slaves of Linux bonding interfaces. | Linux  
btrfs | Exposes btrfs statistics | Linux  
boottime | Exposes system boot time derived from the `kern.boottime` sysctl. | Darwin, Dragonfly, FreeBSD, NetBSD, OpenBSD, Solaris  
conntrack | Shows conntrack statistics (does nothing if no `/proc/sys/net/netfilter/` present). | Linux  
cpu | Exposes CPU statistics | Darwin, Dragonfly, FreeBSD, Linux, Solaris, OpenBSD  
cpufreq | Exposes CPU frequency statistics | Linux, Solaris  
diskstats | Exposes disk I/O statistics. | Darwin, Linux, OpenBSD  
dmi | Expose Desktop Management Interface (DMI) info from `/sys/class/dmi/id/` | Linux  
edac | Exposes error detection and correction statistics. | Linux  
entropy | Exposes available entropy. | Linux  
exec | Exposes execution statistics. | Dragonfly, FreeBSD  
fibrechannel | Exposes fibre channel information and statistics from `/sys/class/fc_host/`. | Linux  
filefd | Exposes file descriptor statistics from `/proc/sys/fs/file-nr`. | Linux  
filesystem | Exposes filesystem statistics, such as disk space used. | Darwin, Dragonfly, FreeBSD, Linux, OpenBSD  
hwmon | Expose hardware monitoring and sensor data from `/sys/class/hwmon/`. | Linux  
infiniband | Exposes network statistics specific to InfiniBand and Intel OmniPath configurations. | Linux  
ipvs | Exposes IPVS status from `/proc/net/ip_vs` and stats from `/proc/net/ip_vs_stats`. | Linux  
loadavg | Exposes load average. | Darwin, Dragonfly, FreeBSD, Linux, NetBSD, OpenBSD, Solaris  
mdadm | Exposes statistics about devices in `/proc/mdstat` (does nothing if no `/proc/mdstat` present). | Linux  
meminfo | Exposes memory statistics. | Darwin, Dragonfly, FreeBSD, Linux, OpenBSD  
netclass | Exposes network interface info from `/sys/class/net/` | Linux  
netdev | Exposes network interface statistics such as bytes transferred. | Darwin, Dragonfly, FreeBSD, Linux, OpenBSD  
netisr | Exposes netisr statistics | FreeBSD  
netstat | Exposes network statistics from `/proc/net/netstat`. This is the same information as `netstat -s`. | Linux  
nfs | Exposes NFS client statistics from `/proc/net/rpc/nfs`. This is the same information as `nfsstat -c`. | Linux  
nfsd | Exposes NFS kernel server statistics from `/proc/net/rpc/nfsd`. This is the same information as `nfsstat -s`. | Linux  
nvme | Exposes NVMe info from `/sys/class/nvme/` | Linux  
os | Expose OS release info from `/etc/os-release` or `/usr/lib/os-release` | _any_  
powersupplyclass | Exposes Power Supply statistics from `/sys/class/power_supply` | Linux  
pressure | Exposes pressure stall statistics from `/proc/pressure/`. | Linux (kernel 4.20+ and/or [CONFIG\_PSI](https://www.kernel.org/doc/html/latest/accounting/psi.html))  
rapl | Exposes various statistics from `/sys/class/powercap`. | Linux  
schedstat | Exposes task scheduler statistics from `/proc/schedstat`. | Linux  
selinux | Exposes SELinux statistics. | Linux  
sockstat | Exposes various statistics from `/proc/net/sockstat`. | Linux  
softnet | Exposes statistics from `/proc/net/softnet_stat`. | Linux  
stat | Exposes various statistics from `/proc/stat`. This includes boot time, forks and interrupts. | Linux  
tapestats | Exposes statistics from `/sys/class/scsi_tape`. | Linux  
textfile | Exposes statistics read from local disk. The `--collector.textfile.directory` flag must be set. | _any_  
thermal | Exposes thermal statistics like `pmset -g therm`. | Darwin  
thermal\_zone | Exposes thermal zone & cooling device statistics from `/sys/class/thermal`. | Linux  
time | Exposes the current system time. | _any_  
timex | Exposes selected adjtimex(2) system call stats. | Linux  
udp_queues | Exposes UDP total lengths of the rx_queue and tx_queue from `/proc/net/udp` and `/proc/net/udp6`. | Linux  
uname | Exposes system information as provided by the uname system call. | Darwin, FreeBSD, Linux, OpenBSD  
vmstat | Exposes statistics from `/proc/vmstat`. | Linux  
watchdog | Exposes statistics from `/sys/class/watchdog` | Linux  
xfs | Exposes XFS runtime statistics. | Linux (kernel 4.4+)  
zfs | Exposes [ZFS](http://open-zfs.org/) performance statistics. | FreeBSD, [Linux](http://zfsonlinux.org/), Solaris  
  
### Disabled by default  
  
`node_exporter` also implements a number of collectors that are disabled by default.  Reasons for this vary by  
collector, and may include:  
* High cardinality  
* Prolonged runtime that exceeds the Prometheus `scrape_interval` or `scrape_timeout`  
* Significant resource demands on the host  
  
You can enable additional collectors as desired by adding them to your  
init system's or service supervisor's startup configuration for  
`node_exporter` but caution is advised.  Enable at most one at a time,  
testing first on a non-production system, then by hand on a single  
production node.  When enabling additional collectors, you should  
carefully monitor the change by observing the `  
scrape_duration_seconds` metric to ensure that collection completes  
and does not time out.  In addition, monitor the  
`scrape_samples_post_metric_relabeling` metric to see the changes in  
cardinality.  
  
| Name                 | Description                                                                                                                                                                   | OS                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| buddyinfo            | Exposes statistics of memory fragments as reported by /proc/buddyinfo.                                                                                                        | Linux              |
| cgroups              | A summary of the number of active and enabled cgroups                                                                                                                         | Linux              |
| cpu\_vulnerabilities | Exposes CPU vulnerability information from sysfs.                                                                                                                             | Linux              |
| devstat              | Exposes device statistics                                                                                                                                                     | Dragonfly, FreeBSD |
| drm                  | Expose GPU metrics using sysfs / DRM, `amdgpu` is the only driver which exposes this information through DRM                                                                  | Linux              |
| drbd                 | Exposes Distributed Replicated Block Device statistics (to version 8.4)                                                                                                       | Linux              |
| ethtool              | Exposes network interface information and network driver statistics equivalent to `ethtool`, `ethtool -S`, and `ethtool -i`.                                                  | Linux              |
| interrupts           | Exposes detailed interrupts statistics.                                                                                                                                       | Linux, OpenBSD     |
| ksmd                 | Exposes kernel and system statistics from `/sys/kernel/mm/ksm`.                                                                                                               | Linux              |
| lnstat               | Exposes stats from `/proc/net/stat/`.                                                                                                                                         | Linux              |
| logind               | Exposes session counts from [logind](http://www.freedesktop.org/wiki/Software/systemd/logind/).                                                                               | Linux              |
| meminfo\_numa        | Exposes memory statistics from `/sys/devices/system/node/node[0-9]*/meminfo`, `/sys/devices/system/node/node[0-9]*/numastat`.                                                 | Linux              |
| mountstats           | Exposes filesystem statistics from `/proc/self/mountstats`. Exposes detailed NFS client statistics.                                                                           | Linux              |
| network_route        | Exposes the routing table as metrics                                                                                                                                          | Linux              |
| perf                 | Exposes perf based metrics (Warning: Metrics are dependent on kernel configuration and settings).                                                                             | Linux              |
| processes            | Exposes aggregate process statistics from `/proc`.                                                                                                                            | Linux              |
| qdisc                | Exposes [queuing discipline](https://en.wikipedia.org/wiki/Network_scheduler#Linux_kernel) statistics                                                                         | Linux              |
| slabinfo             | Exposes slab statistics from `/proc/slabinfo`. Note that permission of `/proc/slabinfo` is usually 0400, so set it appropriately.                                             | Linux              |
| softirqs             | Exposes detailed softirq statistics from `/proc/softirqs`.                                                                                                                    | Linux              |
| sysctl               | Expose sysctl values from `/proc/sys`. Use `--collector.sysctl.include(-info)` to configure.                                                                                  | Linux              |
| systemd              | Exposes service and system status from [systemd](http://www.freedesktop.org/wiki/Software/systemd/).                                                                          | Linux              |
| tcpstat              | Exposes TCP connection status information from `/proc/net/tcp` and `/proc/net/tcp6`. (Warning: the current version has potential performance issues in high load situations.) | Linux              |
| wifi                 | Exposes WiFi device and station statistics.                                                                                                                                   | Linux              |
| xfrm                 | Exposes statistics from `/proc/net/xfrm_stat`                                                                                                                                 | Linux              |
| zoneinfo             | Exposes NUMA memory zone metrics.                                                                                                                                             | Linux              |

## 配置
kube-prometheus中node-exporter的配置如下
```yaml
apiVersion: apps/v1
# 使用DeamonSet类型，确保每个node上只有一个pod运行
kind: DaemonSet
metadata:
  labels:
    app.kubernetes.io/component: exporter
    app.kubernetes.io/name: node-exporter
    app.kubernetes.io/part-of: kube-prometheus
    app.kubernetes.io/version: 1.1.2
  name: node-exporter
  namespace: monitor
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: exporter
      app.kubernetes.io/name: node-exporter
      app.kubernetes.io/part-of: kube-prometheus
  template:
    metadata:
      labels:
        app.kubernetes.io/component: exporter
        app.kubernetes.io/name: node-exporter
        app.kubernetes.io/part-of: kube-prometheus
        app.kubernetes.io/version: 1.1.2
    spec:
    # 调度优先级为 **高优先级的 PriorityClass** - 在资源不足时，低优先级的 Pod 可能会被**驱逐（evicted）**，以腾出资源给高优先级 Pod。
      priorityClassName: system-cluster-critical
      containers:
      - args:
        # 只监听 127.0.0.1 eth0的 ip 留给代理进行监听，这样就能只使用一个端口，代理和node-export使用一个端口
        - --web.listen-address=127.0.0.1:9100
        # 在容器环境中，会将 /sys 挂载到 /host/sys 
        - --path.sysfs=/host/sys
        # 在容器中将 / 挂载到目录 /host/root
        - --path.rootfs=/host/root
        # wifi相关数据不采集
        - --no-collector.wifi
        # 硬件数据采集被禁止，容器环境中没有特权很多容器内部的数据无法采集 
        - --no-collector.hwmon
        # 部分文件挂载点不被采集
        - --collector.filesystem.ignored-mount-points=^/(dev|proc|sys|var/lib/docker/.+|var/lib/kubelet/pods/.+)($|/)
        # veth开头的网卡不采集数据，这些网卡时虚拟网卡
        - --collector.netclass.ignored-devices=^(veth.*)$
        # 已经采集的数据中排除对应的指标
        - --collector.netdev.device-exclude=^(veth.*)$
        image: HARBOR_ADDR/quay.io/prometheus/node-exporter:v1.1.2
        name: node-exporter
        resources:
          limits:
            cpu: 250m
            memory: 180Mi
          requests:
            cpu: 102m
            memory: 180Mi
        volumeMounts:
        - mountPath: /host/sys
          mountPropagation: HostToContainer
          name: sys
          readOnly: true
        - mountPath: /host/root
          mountPropagation: HostToContainer
          name: root
          readOnly: true
      - args:
        - --logtostderr
        # k8s 实现的环境变量注入，当启动过程中，k8s会根据需要从 fieldRef 将变量值提取出来，并进行替换
        - --secure-listen-address=[$(IP)]:9100
        - --tls-cipher-suites=TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
        # 监听的数据流
        - --upstream=http://127.0.0.1:9100/
        env:
        - name: IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        image: HARBOR_ADDR/quay.io/brancz/kube-rbac-proxy:v0.8.0
        name: kube-rbac-proxy
        ports:
        - containerPort: 9100
          hostPort: 9100
          name: https
        resources:
          limits:
            cpu: 20m
            memory: 40Mi
          requests:
            cpu: 10m
            memory: 20Mi
        securityContext:
          runAsGroup: 65532
          runAsNonRoot: true
          runAsUser: 65532
      hostNetwork: true
      hostPID: true
      nodeSelector:
        kubernetes.io/os: linux
      securityContext:
        runAsNonRoot: true
        runAsUser: 65534
      serviceAccountName: node-exporter
      tolerations:
      - operator: Exists
      volumes:
      - hostPath:
          path: /sys
        name: sys
      - hostPath:
          path: /
        name: root
  updateStrategy:
    rollingUpdate:
      maxUnavailable: 10%
    type: RollingUpdate
```


