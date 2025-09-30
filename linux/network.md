




## 网卡











## nf_conntrack
确认连接跟踪表是否出现问题，一般是连接跟踪表溢出
```bash
dmesg |grep nf_conntrack
```
如果输出值中有“nf_conntrack: table full, dropping packet”，说明服务器nf_conntrack表已经被打满。

```bash
# 查看nf_conntrack表最大连接数
$ cat /proc/sys/net/netfilter/nf_conntrack_max
65536
# 查看nf_conntrack表当前连接数
$ cat /proc/sys/net/netfilter/nf_conntrack_count
7611
```

如果确认服务器因连接跟踪表溢出而开始丢包，首先需要查看具体连接判断是否正遭受DOS攻击，如果是正常的业务流量造成，可以考虑调整nf_conntrack的参数：

nf_conntrack_max决定连接跟踪表的大小，默认值是65535，可以根据系统内存大小计算一个合理值：CONNTRACK_MAX = RAMSIZE(in bytes)/16384/(ARCH/32)，如32G内存可以设置1048576；

nf_conntrack_buckets决定存储conntrack条目的哈希表大小，默认值是nf_conntrack_max的1/4，延续这种计算方式：BUCKETS = CONNTRACK_MAX/4，如32G内存可以设置262144；

nf_conntrack_tcp_timeout_established决定ESTABLISHED状态连接的超时时间，默认值是5天，可以缩短到1小时，即3600。

```bash
$ sysctl -w net.netfilter.nf_conntrack_max=1048576
$ sysctl -w net.netfilter.nf_conntrack_buckets=262144
$ sysctl -w net.netfilter.nf_conntrack_tcp_timeout_established=3600
```







## wget

```bash
wget --no-check-certificate https://example.com/path/to/file
```






## epoll

![[Pasted image 20250911225411.png]]

































