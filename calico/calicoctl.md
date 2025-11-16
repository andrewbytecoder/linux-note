

## 命令
### 查看ip池

```bash
$ calicoctl get ippool -o wide
NAME                  CIDR            NAT    IPIPMODE   VXLANMODE   DISABLED   DISABLEBGPEXPORT   SELECTOR   
default-ipv4-ippool   10.224.0.0/11   true   Always     Never       false      false              all()  

$ calicoctl get ippool default-ipv4-ippool  -o yaml 
apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
  creationTimestamp: "2025-07-21T05:42:42Z"
  name: default-ipv4-ippool
  resourceVersion: "604"
  uid: 2ee0a31f-a694-409b-834a-b78422eb9f28
spec:
  allowedUses:
  - Workload
  - Tunnel
  blockSize: 21
  cidr: 10.224.0.0/11
  ipipMode: Always
  natOutgoing: true
  nodeSelector: all()
  vxlanMode: Never
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


### 查看pod的绑定的interface接口
知道了对应的接口方便进行抓包
```bash
# wep ==> workloadEndpoint
[root@k8smaster-1 ~]# calicoctl get wep  -n calico-system -o wide 
NAMESPACE       NAME                                                                 WORKLOAD                                   NODE          NETWORKS            INTERFACE         PROFILES                                                      NATS   
calico-system   k8smaster--1-k8s-calico--kube--controllers--7c8b4f9f84--7n9t2-eth0   calico-kube-controllers-7c8b4f9f84-7n9t2   k8smaster-1   100.70.244.201/32   cali6f5ba009fe3   kns.calico-system,ksa.calico-system.calico-kube-controllers          
calico-system   k8smaster--1-k8s-csi--node--driver--ph22g-eth0                       csi-node-driver-ph22g                      k8smaster-1   100.70.244.254/32   calic2eeda9bb38   kns.calico-system,ksa.calico-system.default  
```