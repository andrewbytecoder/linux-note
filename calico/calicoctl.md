

## 命令
### 查看ip池

```bash
calicoctl get ippool -o wide
NAME                  CIDR            NAT    IPIPMODE   VXLANMODE   DISABLED   DISABLEBGPEXPORT   SELECTOR   
default-ipv4-ippool   10.224.0.0/11   true   Always     Never       false      false              all()  
```



### 查看使用模式
因为使用的是IPIP 模式因此这里的BGP状态为空
```bash
$ calicoctl node status
Calico process is running.

IPv4 BGP status
No IPv4 peers found.

IPv6 BGP status
No IPv6 peers found.
```











