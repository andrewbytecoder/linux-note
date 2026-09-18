## 1.前提条件
### （1）确认集群相关信息
以安装机房2为例来说明，机房1的安装方式与它相同。
>集群名：testocpdc2
>基域：62dc2.com
>版本：ocp4.19 + odf4.19+local storage 4.19 + nms4.19
>操作系统：redhat9.4

机器列表：

| 机器IP          | 角色           | 域名                             | 用户名  |
| ------------- | ------------ | ------------------------------ | ---- |
| 10.161.43.94  | 跳板机，harbor   | package.testocpdc2.62dc2.com   | core |
| 10.161.43.124 | bootstrap    | bootstrap.testocpdc2.62dc2.com | core |
| 10.161.43.96  | quay仓库       | quay62.testocpdc2.62dc2.com    | root |
| 10.161.43.78  | master01     | master1.testocpdc2.62dc2.com   | core |
| 10.161.43.120 | master02     | master2.testocpdc2.62dc2.com   | core |
| 10.161.43.121 | master03     | master3.testocpdc2.62dc2.com   | core |
| 10.161.43.79  | worker1      | worker1.testocpdc2.62dc2.com   | core |
| 10.161.43.122 | worker2      | worker2.testocpdc2.62dc2.com   | core |
| 10.161.43.123 | worker3      | worker3.testocpdc2.62dc2.com   | core |
| 10.161.43.95  | pvc-1 (ODF1) | odf1.testocpdc2.62dc2.com      | core |
| 10.161.43.97  | pvc-2 (ODF2) | odf2.testocpdc2.62dc2.com      | core |
| 10.161.43.98  | pvc-3 (ODF3) | odf3.testocpdc2.62dc2.com      | core |

> 注意安装时所有机器为单IP，配置双IP可能会造成安装失败。
> bootstrap为临时使用的机器，当所有master安装成功后可以撤掉。
> 除了跳板机之外，其它机器一般使用虚拟机，方便后面的双系统引导切换硬盘。

### （2）先在跳板机上安装最新适配包。
RedHat9.4

> 正常获取

相应适配包获取
```bash
scp root@10.161.30.107:/openshift_data/os/OpenShift-Rhel-OSAdapter-1.0.01.001-nologo.run .
```
适配包安装

```
[root@localhost ~]# chmod a+x OpenShift-Rhel-OSAdapter-1.0.01.001-nologo.run 
[root@localhost ~]# ./OpenShift-Rhel-OSAdapter-1.0.01.001-nologo.run 
Verifying archive integrity...  100%   MD5 checksums are OK. All good.
Uncompressing package
Created by Einstein Wang,
at Fri Aug  1 16:49:06 CST 2025
Uncompress progress...  100%  
After finished installing adapter,the system will auto restart,do you want to continue? [y/n] y
Start to install... 
==>STEP(1/35): check_linux_release by main
9.4
==>STEP(2/35): config_reboot by main
==>STEP(3/35): prepare_source by main
==>STEP(4/35): stop_PackageKit by main
==>STEP(5/35): prepare_repo by main
Does this environment have External network? [y/n] n
Removed "/etc/systemd/system/timers.target.wants/dnf-makecache.timer".
Updating Subscription Management repositories.
Unable to read consumer identity
```
### （3）把openshift安装包拷贝到跳板机。
> openshift安装包在10.161.30.107机器的/home/openshift_data/目录下，比较大，自行拷贝到跳板机上。

## 2.在跳板机上搭建DNS服务器
配置如下：
```

[root@localhost ~]# cat /etc/named.conf
//
// named.conf
//
// Provided by Red Hat bind package to configure the ISC BIND named(8) DNS
// server as a caching only nameserver (as a localhost DNS resolver only).
//
// See /usr/share/doc/bind*/sample/ for example named configuration files.
//
acl internal_nets { 10.161.43.0/24; };
options {
        listen-on port 53 { 127.0.0.1; 10.161.43.94; };
        listen-on-v6 port 53 { ::1; };
        directory       "/var/named";
        dump-file       "/var/named/data/cache_dump.db";
        statistics-file "/var/named/data/named_stats.txt";
        memstatistics-file "/var/named/data/named_mem_stats.txt";
        secroots-file   "/var/named/data/named.secroots";
        recursing-file  "/var/named/data/named.recursing";
        allow-query     { localhost; internal_nets; };
        /*
         - If you are building an AUTHORITATIVE DNS server, do NOT enable recursion.
         - If you are building a RECURSIVE (caching) DNS server, you need to enable
           recursion.
         - If your recursive DNS server has a public IP address, you MUST enable access
           control to limit queries to your legitimate users. Failing to do so will
           cause your server to become part of large scale DNS amplification
           attacks. Implementing BCP38 within your network would greatly
           reduce such attack surface
        */
        recursion yes;
        allow-recursion { localhost; internal_nets; };
        forward first;
        forwarders { 192.168.8.10; };
        dnssec-validation yes;
        managed-keys-directory "/var/named/dynamic";
        geoip-directory "/usr/share/GeoIP";
        pid-file "/run/named/named.pid";
        session-keyfile "/run/named/session.key";
        /* https://fedoraproject.org/wiki/Changes/CryptoPolicy */
        include "/etc/crypto-policies/back-ends/bind.config";
};
logging {
        channel default_debug {
                file "data/named.run";
                severity dynamic;
        };
};
zone "." IN {
        type hint;
        file "named.ca";
};
include "/etc/named.rfc1912.zones";
include "/etc/named.root.key";
zone "testocpdc2.62dc2.com" {
    type master;
    file "testocpdc2.62dc2.com.db";
    allow-query { any; };
    allow-transfer { none; };
    allow-update { none; };
};
zone "43.161.10.in-addr.arpa" {
    type master;
    file "43.161.10.in-addr.arpa.db";
    allow-query { any; };
    allow-transfer { none; };
    allow-update { none; };
};
```

```bash
[root@localhost ~]# cd /var/named/
[root@localhost ~]# cp -a named.localhost testocpdc2.62dc2.com.db
[root@localhost ~]# cat /var/named/testocpdc2.62dc2.com.db
$TTL 1D
@       IN SOA  @ ns1.testocpdc2.62dc2.com. (
                                        2019022400      ; serial
                                        3H              ; refresh
                                        15              ; retry
                                        1W              ; expire
                                        3H )            ; minimum
@      NS ns1.testocpdc2.62dc2.com.
dns      IN A  10.161.43.94
ns1      IN A  10.161.43.94
nfs      IN A  10.161.43.94
base     IN A  10.161.43.94
package  IN A  10.161.43.94
quay62   IN A  10.161.43.96
bootstrap IN A  10.161.43.124
lb       IN A  10.161.43.94
api      IN A  10.161.43.94
api-int  IN A  10.161.43.94 #特别注意，这个一定是跳板机，否则worker安装失败，而master是正常的
*.apps   IN A  10.161.43.94
master1  IN A 10.161.43.78
master2  IN A 10.161.43.120
master3  IN A 10.161.43.121
worker1   IN A 10.161.43.79
worker2   IN A 10.161.43.122
worker3   IN A 10.161.43.123
odf1   IN A 10.161.43.95
odf2   IN A 10.161.43.97
odf3   IN A 10.161.43.98
etcd-0    IN A 10.161.43.78
etcd-1    IN A 10.161.43.120
etcd-2    IN A 10.161.43.121
_etcd-server-ssl._tcp. 8640 IN SRV 0 10 2380 etcd-0.testocpdc2.62dc2.com.
_etcd-server-ssl._tcp. 8640 IN SRV 0 10 2380 etcd-1.testocpdc2.62dc2.com.
_etcd-server-ssl._tcp. 8640 IN SRV 0 10 2380 etcd-2.testocpdc2.62dc2.com.
[root@localhost ~]#
[root@localhost ~]# cp -a named.localhost /var/named/43.161.10.in-addr.arpa.db
[root@localhost ~]# cat /var/named/43.161.10.in-addr.arpa.db
$TTL 1D
@       IN SOA  @ ns1.testocpdc2.62dc2.com. (
                                        2019022400      ; serial
                                        3h              ; refresh
                                        15              ; retry
                                        1W              ; expire
                                        3H )            ; minimum
@    NS ns1.testocpdc2.62dc2.com.
94   IN   PTR  package.testocpdc2.62dc2.com.
96   IN   PTR  auqy62.testocpdc2.62dc2.com.
94   IN   PTR  lb.testocpdc2.62dc2.com.
124   IN   PTR  bootstrap.testocpdc2.62dc2.com.
78   IN   PTR  master1.testocpdc2.62dc2.com.
120   IN   PTR  master2.testocpdc2.62dc2.com.
121   IN   PTR  master3.testocpdc2.62dc2.com.
79   IN   PTR  worker1.testocpdc2.62dc2.com.
122   IN   PTR  worker2.testocpdc2.62dc2.com.
123   IN   PTR  worker3.testocpdc2.62dc2.com.
95   IN   PTR  odf1.testocpdc2.62dc2.com.
97   IN   PTR  odf2.testocpdc2.62dc2.com.
98   IN   PTR  odf3.testocpdc2.62dc2.com.
[root@localhost ~]#
[root@localhost ~]# cat /etc/resolv.conf
# Generated by NetworkManager
search 10.161.43.94
nameserver 10.161.43.94
[root@localhost ~]#
# 检查DNS配置是否正确：
named-checkconf /etc/named.conf
named-checkzone testocpdc2.62dc2.com /var/named/testocpdc2.62dc2.com.db
named-checkzone 43.161.10 /var/named/43.161.10.in-addr.arpa.db
# 启动DNS
systemctl start named
systemctl enable named
systemctl status named
验证DNS解析正常：

nslookup master1.testocpdc2.62dc2.com
nslookup master2.testocpdc2.62dc2.com
nslookup master3.testocpdc2.62dc2.com
nslookup worker1.testocpdc2.62dc2.com
nslookup worker2.testocpdc2.62dc2.com
nslookup worker3.testocpdc2.62dc2.com
```

## 3.在跳板机上安装启动haproxy
在跳板机上执行命令：
```bash
setsebool -P haproxy_connect_any=1
```
`vi /etc/haproxy/haproxy.cfg`，在最后添加下列内容：
```bash
#-------------------------------------------------------
listen stats
    bind :9000
    mode http
    stats enable
    stats uri /
    monitor-uri /healthz
frontend ocp-api-server
    bind *:6443
    default_backend ocp-api-server
    mode tcp
    option tcplog
backend ocp-api-server
    balance source
    mode tcp
    server master1 10.161.43.78:6443 check
    server master2 10.161.43.120:6443 check
    server master3 10.161.43.121:6443 check
frontend ocp-api-server-int
    bind *:22623
    default_backend ocp-api-server-int
    mode tcp
    option tcplog
backend ocp-api-server-int
    balance source
    mode tcp
    server master1 10.161.43.78:22623 check
    server master2 10.161.43.120:22623 check
    server master3 10.161.43.121:22623 check
frontend router-http
    bind *:80
    default_backend router-http
    mode tcp
    option tcplog
backend router-http
    balance source
    mode tcp
    server router1 10.161.43.79:80 check
    server router2 10.161.43.122:80 check
    server router3 10.161.43.123:80 check
frontend router-https
    bind *:443
    default_backend router-https
    mode tcp
    option tcplog
backend router-https
    balance source
    mode tcp
    server router1 10.161.43.79:443 check
    server router2 10.161.43.122:443 check
    server router3 10.161.43.123:443 check
#-------------------------------------------------------
```
启动haproxy：

```bash
systemctl restart haproxy
systemctl enable haproxy
systemctl status haproxy
```
测试haproxy：

```bash
http://lb.testocpdc2.62dc2.com:9000/
```
## 4.在跳板机上安装harbor镜像仓库—目前推荐使用quay仓库，不使用harbor。
> 镜像仓库域名为”package.testocpdc2.62dc2.com”，和install-config.yaml中的配置保持一致，并且要把它配置在DNS服务器中。

```bash
mkdir /opt/harbor
#把harbor安装包拷贝到此目录下，执行命令：
sh /opt/harbor/install_ysp_harbor.sh 10.161.43.94 testocpdc2 62dc2.com
```
### 4-2.搭建quay仓库
搭建教程请参照quay仓库搭建文档

## 5.安装oc，kubectl和openshift-install
安装过程

```bash
mkdir /root/install_openshift_pkg
把包传到该目录下
cd /root/install_openshift_pkg
scp root@10.161.30.107:/openshift_data/openshift/ocp4.19/openshift-client-linux-amd64-rhel9-4.19.4.tar.gz .
tar -xzvf openshift-client-linux-amd64-rhel9-4.19.4.tar.gz
mv oc kubectl /usr/local/bin/
rm README.md
scp root@10.161.30.107:/openshift_data/openshift/ocp4.19/openshift-install-linux-4.19.4.tar.gz .
tar -zxvf openshift-install-linux-4.19.4.tar.gz
mv openshift-install /usr/local/bin/
rm README.md
```
确认一下客户端版本：
```

oc version
--
Client Version: 4.19.4
Kustomize Version: v5.5.0
kubectl version
--
Client Version: v1.32.1
Kustomize Version: v5.5.0
The connection to the server localhost:8080 was refused - did you specify the right host or port?
```
## 6.上传ocp419到镜像仓库。
```bash
mkdir /root/openshift
cd /root/openshift
把ocp419.tar.gz拷贝到该目录下，解压：
scp root@10.161.30.107:/openshift_data/openshift/ocp4.19/ocp419.tar.gz .
tar -zxvf ocp419.tar.gz
```
quay仓库验证是否正常
```bash
a.docker下配置
sudo mkdir -p /etc/docker/certs.d/10.161.43.96:8443/  #注意：必须是quay地址
配置本地信任自签证书
scp root@10.161.43.96:/root/quay-install/cert/ca.crt /etc/docker/certs.d/10.161.43.96:8443/
重启docker
sudo systemctl restart docker
登录验证
docker login quay62.testocpdc2.62dc2.com:8443 -u admin -p admin@123
b.podman下配置
配置本地信任自签证书
将 Quay 的 CA 证书拷贝到本地：
scp root@quay62-podman:/root/quay-install/cert/ca.crt /etc/pki/ca-trust/source/anchors/quay62-ca.crt
更新系统证书信任：
sudo update-ca-trust
登录验证
podman login quay62.testocpdc2.62dc2.com:8443 --username admin --password admin@123
```
### 先在harbor或者quay页面上创建工程ocp419
```
harbor：
web页面登录https://10.161.40.177:11036，
 用户名/密码: admin/HaRb0r@1993
quay:
web页面登录https://10.161.43.96:8443，
用户名/密码: admin/admin@123

```

### 执行命令上传ocp镜像
上传到harbor

```
oc image mirror --insecure-skip-tls-verify=true --from-dir=/root/openshift/data/offlineocp/mirror 'file://openshift/release:4.18.1-x86_64*' quay62.testocpdc2.62dc2.com:11036/ocp419/release
新版本:
oc image mirror --insecure-skip-tls-verify=true --from-dir=/root/openshift/ocp-install/ 'file://openshift/release:4.19.4-x86_64*' quay62.testocpdc2.62dc2.com:11036/ocp419/release
```
上传到quay

```
oc image mirror --from-dir=/root/openshift/data/offlineocp/mirror 'file://openshift/release:4.18.1-x86_64*' quay62.testocpdc2.62dc2.com:8443/ocp419/release
新版本:
oc image mirror --from-dir=/root/openshift/ocp-install/ 'file://openshift/release:4.19.4-x86_64*' quay62.testocpdc2.62dc2.com:8443/ocp419/release
```
>特别注意:
>如果写成
>quay62.testocpdc2.62dc2.com:8443/ocp419，是无效的，缺少仓库名字,会上传到library/ocp419，和预期不符。
> quay62.testocpdc2.62dc2.com:8443/ocp419/release 才是有效的

## 7.在跳板机上安装web server。
>web server，存放系统引导盘和点火配置。

```
把httpd的Listen端口修改为8080：
vi /etc/httpd/conf/httpd.conf
Listen 8080
cat << EOF > /etc/httpd/conf.d/repos.conf
Alias /repos "/opt/repos"
<Directory "/opt/repos">
  Options +Indexes +FollowSymLinks
  Require all granted
</Directory>
<Location ></Location>
  SetHandler None
</Location>
EOF
启动web server：
systemctl enable httpd
systemctl restart httpd
systemctl status httpd
```
```
把引导系统盘存放到指定目录，注意该目录下文件需要有读权限才能被下载。
[root@localhost ~]#
[root@localhost ~]# mkdir -p /opt/repos/rhcos
# 手动上传iso、img文件到/opt/repos/rhcos目录
scp root@10.161.30.107:/openshift_data/openshift/ocp4.19/rhcos-4.19.0-x86_64-live-iso.x86_64.iso /opt/repos/rhcos
scp root@10.161.30.107:/openshift_data/openshift/ocp4.19/rhcos-4.19.0-x86_64-live-rootfs.x86_64.img /opt/repos/rhcos
[root@localhost ~]# chmod 755 /opt/repos/rhcos/*
[root@localhost ~]# ll  /opt/repos/rhcos
total 2387988
-rw-r--r-- 1 root root 1166027776 Feb 28 11:02 rhcos-4.18.1-x86_64-live-rootfs.x86_64.img
-rw-r--r-- 1 root root 1279262720 Mar 20 20:03 rhcos-4.18.1-x86_64-live.x86_64.iso
[root@localhost ~]#
```
## 8.在跳板机上安装ntp服务。
```
安装NTP服务，用于各服务节点同步时间。
vi /etc/chrony.conf
--------------------
allow 10.161.0.0/16
local stratum 10 #这个一定要加
启动NTP服务器：
systemctl enable chronyd
systemctl start chronyd
systemctl status chronyd
timedatectl status
timedatectl set-ntp true
chronyc -n sources -v
```
## 9.准备安装配置install-config.yaml，创建点火配置，并存放到web-server中。
> openshift技术支持说安装证书是12小时，从产生点火文件的时间，oc-install create manifest这一步开始算，12小时内要装好。

在跳板机上生成免密密钥：

```
ssh-keygen -t rsa -b 4096 -N '' -f ~/.ssh/id_rsa
[root@package ~]#
[root@package ~]# ll .ssh
total 8
-rw------- 1 root root 3401 Jun  6 15:57 id_rsa
-rw-r--r-- 1 root root  759 Jun  6 15:57 id_rsa.pub
[root@package ~]#
[root@package ~]# cat /root/.ssh/id_rsa.pub
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDoP45vw5TFtMdtRa6n0TvuPcNslChIzQLkoFT4eWLRFw/OkWgfGxzQWXvC8o3ckZg6N5u10cs0YvKPeU0ET5Z1HDlxpmITQBEsaLEfYtqb7Rp8B/fWmiuXnm0cKT7VFOsT9x0nlJzciz5Rqnsa5yIdMtP5lzO5FLNSQGF6iBjRToBxjEkQqzda4cU+sxVh9ld8UyFh379rTweEdZ+LFPVM4IxbPIPmHrQlo54OUDbQD44YCnPfKpUWINxuRXPmsB/7WhQeXslht/iSy/tqVYmtkRWz2H5s7kcWlbHf1/U7EllrNemFPEfAqzIbgDctrlBo/NifXWl8zmM0nn4LgQVsF0o1qNt1rkrtXsyl/sGbvCaIfrl4Rvn2U6dyhj53mAXg58P0V9s2NBbsooq7WdiH4VPaaeD8+z3JAGbVtUQJ+zA10t+bt+Yw6uRzRmX4LLeLC2IPZz0OA4dspQMZ+aVW8lMvCUXQqCaYiJBRZ7P/r+qu+xtlJxqeuh6XkrJ3Oq1Mvsc7ERa80aUuUgZDL0nVMI1yMv4vbvJ3IiuQKKtjj7ziYIX6iWrBFL87jGNNLUcJZTs+TTT8KJS7IKbYr9ytyeNdll6f0U8ySO8x5r8f0kXRCws7LhnVpntS0xkoxcs3BjUcnkH/9D5UA4owBATFaPyAz8oFJQUGhS5oHwJ+ww== root@package.testocpdc2.shdc2.com
[root@package ~]#
```
分别填入install-config.yaml的sshKey和additionalTrustBundle字段中：

```
cat /root/.ssh/id_rsa.pub # 填入sshKey
如果本机安装了harbor，则把如下文件内容填入
cat /etc/harbor/cert/ca.crt # 填入additionalTrustBundle
如果使用quay，则把对应的quay的配置文件填入，如我的quay 10.161.43.96
cat /root/quay-install/cert/ca.crt # 填入additionalTrustBundle
```
创建/root/ocp-install，准备好install-config.yaml：

```
mkdir -p /root/ocp-install
cd /root/ocp-install
```
生成时间同步配置chrony.conf：

```
cat <<EOF > chrony.conf
server 10.161.43.94 iburst
stratumweight 0s
driftfile /var/lib/chrony/drift
rtcsync
makestep 10 3
local stratum 10
bindcmdaddress 0.0.0.0
keyfile /etc/chrony.keys
noclientlog
logchange 0.5
stratumweight 0.05
logdir /var/log/chrony
EOF
```
因为启动一次安装程序后会把install-config.yaml删除，需要对其进行备份以备后续可能的多次安装。最终配置好的install-config.yaml请参考后面的附录。

```
[root@package ocp-install]#
[root@package ocp-install]# ll
total 12
-rw-r--r-- 1 root root  232 Jun  6 16:02 chrony.conf
-rw-r--r-- 1 root root 6505 Jun  6 16:00 install-config.yaml
[root@package ocp-install]#
以下是install-config.yaml文件进行详细说明
apiVersion: v1
baseDomain: 62dc2.com
compute:
- architecture: amd64
  hyperthreading: Enabled
  name: worker
  replicas: 3
controlPlane:
  architecture: amd64
  hyperthreading: Enabled
  name: master
  replicas: 3
metadata:
  name: testocpdc2
networking:
  clusterNetwork:
  - cidr: 10.224.0.0/11
    hostPrefix: 21
  networkType: OVNKubernetes
  serviceNetwork:
  - 172.30.0.0/16
platform:
  none: {}
# auth 通过echo -n 'admin:HaRb0r@1993' | base64 计算出来，用户名和密码填写真实的，quay、Harbor，计算方式一样
# email 不校验，随意填写
pullSecret: '{"auths":{"quay62.testocpdc2.62dc2.com:8443":{"auth":"YWRtaW46YWRtaW5AMTIz","email":"suibianxie@163.com"}}}'
# sshKey cat /root/.ssh/id_rsa.pub 
sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC9LFgBDFRtvA/YQL2XiP8QTfq+80JX9kGUlPR+ASi7W35x+x0xcDDal7gtY6se/0XRpm22xzoY0LznV//VOExheUI7vt+1vWtfjVV/gz4ghAFWHF9CHeiFC2lxbiDlUqspOpam9KmSct92PyOcISuX5y6NoVC9MivvNPcIkPlpooOhoWe8zC7wuDnGfViYUhyZnTkI1owHR5fqtMwBoLCYqeMhc0OkQXHjh+sH9iDCMbDVkPQZ1zoZf0HPHj5NBPcYtcD0b371Xha2hO0AzCZsZNVGCMzbY1o8zkW9a+dYxiYneQFdZbag1xBzg8llPn9hTbcHeP85XiJrgJ2+ebxE2icKWKvvx6xIxSMoNUsQWaiUK4kNwMmtZVUww0sgo2pSNAgA0e/Mbx80KUGT5yjtUKCPYvzSyLT4DSLi9RYV7ppObc4ZDwJO5SfhgGrJDjaFSZEol1D+1qQF697wTt7L4h1gpErd1r4O5JCyYlJRRujgKrZdSadKwWaV0Nep7x+cS19KkMaQIWP9PRoOTaQ+vkJ6D5O0X1jzbrbuq8EPlfgo1hjgbvyIuJXMVZjiCpy4fRccrLRz/ZmoIjwTk9fNG9Fwp5KAJ9M4FoIH4I0ldXKOYFAhSBuFjAHJLtWUS3pfLsff5LVhXldXLQFELmlD19lJzjnkujz3OU76iBRD/Q== root@62bastion'
# additionalTrustBundle ，填写仓库的 ca.crt，适合quay、Harbor
additionalTrustBundle: |
  -----BEGIN CERTIFICATE-----
  MIIFFzCCAv+gAwIBAgIUJC6+A31HdfB7ypknc8env0Yct6YwDQYJKoZIhvcNAQEL
  BQAwGzEZMBcGA1UEAwwQcXVheTYyLXBvZG1hbi1DQTAeFw0yNTExMDgwNDM1MDFa
  Fw0zNTExMDYwNDM1MDFaMBsxGTAXBgNVBAMMEHF1YXk2Mi1wb2RtYW4tQ0EwggIi
  MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDNgbcnI0Ot2tPbM5QOJk/ouKB0
  jgHXlv4UmjrXLJi4Q2MMX0CYBNJ1E9wjTRgu2SMPtRLk/TpeY6SIOjANQkQFcDF/
  wrdNac9yQIhFFwM1SmnhmWfHh8URsFn+4d6JX2u1ocvD8R90H/zc4LWPZMdiM/s1
  EcrmSBtasNkUyIH/nDzVYlK3hWohOCdovNhlEqa/c0dl/Dw0H+p67QOABDTpp1HN
  x4+IINX4hr3woBI/pme1vYxM45/Tr3jy2NlSZZC5Wf6o5n5WJAwbHp6ezmJQOJVz
  loCRnXXdLWlfHcVQ5dYHfD3eMbayMDKc27hF5tE1Dte4uZLi2oP2y78+WEOgRM11
  zMgv3j3BxTyTnk5lZW0WBblWRu8HkdvvZjGKTE4eIX1VfHyEIyS8F1+75+PfLhd/
  DulXaMcHnbSUqbvPoaqc3ooc4aGSOsrxYo5ENHBIWf5nYPLgGkInF6XS9J/0g2MB
  Z9uV2304EI/7oPBB5BmUXfT5x+eCeWejSQ8GIyMJCmBar/Dw2E0Nl6WnBmPTT96l
  iYZiAZA/vAzE+azUviRrwaRmEd7m7sKWMkTtHUKeUUSA+ZkRW1ZGBIjXEVosFDI8
  0egBFvU0NlyzsGJZx8TEWa4U5IeaWZu8xN0qZAdDZ/+xEfvwH2yEYwIoISybmHCq
  0nQuTAOoxxUA2v0AnwIDAQABo1MwUTAdBgNVHQ4EFgQUvUhRaQtSNyaZsDAaback
  Uwc6r4owHwYDVR0jBBgwFoAUvUhRaQtSNyaZsDAabackUwc6r4owDwYDVR0TAQH/
  BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAgEAtUeA/mTz8TSO/5XIlqLEVh18t7Xo
  43UQBQtq0tozE8r1wxuXqcoZOd/xB/jpd6cE2FD1JpYJU9K12oOGoxzbQ5AOyDSK
  H8SYFpKK4Z/3//co1J8BGTxdCpQPipcSe3uH2LSQzCNSMQdF7IvLoAZN9O7KtRYK
  2xX0VIjRE2Ob44J07CW6q1TMEj45u/1E3pJSIubHCeKpDEvDW0v9AUgK4pAm9m6R
  ZEoyVVJAi6LUtLlcYkmGG59gErpoPzLSdTLp4iZi6T2pRYoC7lyv+tsLKmirPW09
  2Or7UDn9nEHRb5B1dt1nyw0YK9e+sfr6GCUWwSF92hQVvhuGJBOYsUvfpfP4netK
  Z+saQuiJ/RIALKdjLwytRPat1ok85ExPvdmO+R29IAXuX9zlQrxu0STO2pfBZQjq
  0orDMJfsN8jYtUq3qAXCgRhMn7ZbLw9Uii74Fqtf0PsBOP4avG9tSBpyCO9Y+drq
  HQq08G8wRRBMiSzrdBwk3BLqIjbbqw8oTcY6zAUbyZIFWzJ31+uA07Jt9gInBFQc
  +gyzlEOMMa83tx0L0PAQ+RY4WOb9p97lDknzwONyGb6Oxdg56FsoBahlf8/fUM+W
  SxJn8eQ0Ot11uqR1A2VXhj7GUPwJ8BBMuY6tx1YWObWxMgOOAOnmHgwAEyrN/Gwl
  3JxaPM3V4wqalxU=
  -----END CERTIFICATE-----
imageContentSources:
- mirrors:
  - quay62.testocpdc2.62dc2.com:8443/ocp419/release #填写仓库真实路径
  source: quay.io/openshift-release-dev/ocp-release #需要映射的官网数据，官网该目录文件从本地仓库找
- mirrors:
  - quay62.testocpdc2.62dc2.com:8443/ocp419/release #同理
  source: quay.io/openshift-release-dev/ocp-v4.0-art-dev #同理
```
特别说明

- imageContentSources（ICSP）：在 集群安装阶段 使用。集群安装完成后，imageContentSources 将被写入集群的 ImageDigestMirrorSet（IDMS）对象中，因此它会持续影响以后集群里的镜像拉取。（OCP 4.6–4.11使用，每个 cluster 只能有一个）
- ImageDigestMirrorSet（IDMS）：4.12–4.19使用，拉取待md5格式的镜像名字使用，主要是这个。每个集群允许多个 IDMS共存，如果冲突，则按照顺序来执行。
- ImageTagMirrorSet（ITMS）：4.14+（额外配置），带标签拉取镜像的时候使用。每个集群允许多个共存
### 创建点火配置
```
#创建安装配置
openshift-install create manifests --dir=/root/ocp-install
#创建基本点火配置
openshift-install create ignition-configs --dir=/root/ocp-install
#生成的文件：
[root@localhost ocp-install]# ll
total 308
drwxr-x--- 2 root root   4096 Jun  6 16:15 auth
-rw-r----- 1 root root 293506 Jun  6 16:15 bootstrap.ign
-rw-r--r-- 1 root root    232 Jun  6 16:02 chrony.conf
-rw-r----- 1 root root   1722 Jun  6 16:15 master.ign
-rw-r----- 1 root root    148 Jun  6 16:15 metadata.json
-rw-r----- 1 root root   1722 Jun  6 16:15 worker.ign
[root@localhost ocp-install]#
```
通过filetranspiler工具分别生成bootstrap, master和worker的点火配置。
```bash
先加载filetranspiler镜像：
#手动上传filetranspiler.tar到/root/install_openshift_pkg
scp root@10.161.30.107:/openshift_data/openshift/filetranspiler.tar /root/install_openshift_pkg
docker load -i /root/install_openshift_pkg/filetranspiler.tar
bootstrap点火配置：
mkdir -p /root/ocp-install/bootstrap/etc/
cp chrony.conf bootstrap/etc/
mv bootstrap.ign bootstrap.ign.bak
docker run -it --rm --volume $(pwd):/srv:z filetranspiler:latest -i bootstrap.ign.bak -f bootstrap -o bootstrap.ign
master点火配置：
mkdir -p /root/ocp-install/master/etc/
cp chrony.conf master/etc/
mv master.ign master.ign.bak
docker run -it --rm --volume $(pwd):/srv:z filetranspiler:latest -i master.ign.bak -f master -o master.ign
worker点火配置：
mkdir -p /root/ocp-install/worker/etc/
cp chrony.conf worker/etc/
mv worker.ign worker.ign.bak
docker run -it --rm --volume $(pwd):/srv:z filetranspiler:latest -i worker.ign.bak -f worker -o worker.ign
生成结果：
[root@localhost ocp-install]#
[root@localhost ocp-install]# ll
total 620
drwxr-x--- 2 root root   4096 Jun  6 16:15 auth
drwxr-xr-x 3 root root   4096 Jun  6 16:16 bootstrap
-rw-r--r-- 1 root root 295225 Jun  6 16:16 bootstrap.ign
-rw-r----- 1 root root 293506 Jun  6 16:15 bootstrap.ign.bak
-rw-r--r-- 1 root root    232 Jun  6 16:02 chrony.conf
drwxr-xr-x 3 root root   4096 Jun  6 16:16 master
-rw-r--r-- 1 root root   2199 Jun  6 16:17 master.ign
-rw-r----- 1 root root   1722 Jun  6 16:15 master.ign.bak
-rw-r----- 1 root root    148 Jun  6 16:15 metadata.json
drwxr-xr-x 3 root root   4096 Jun  6 16:17 worker
-rw-r--r-- 1 root root   2199 Jun  6 16:17 worker.ign
-rw-r----- 1 root root   1722 Jun  6 16:15 worker.ign.bak
[root@localhost ocp-install]#
[root@localhost ocp-install]#
```
把点火配置存放到Web Server。
```bash
mkdir -p /opt/repos/ignition
cp bootstrap.ign master.ign worker.ign /opt/repos/ignition/
[root@localhost ocp-install]#
[root@localhost ocp-install]# ll /opt/repos/ignition
total 300
-rw-r--r-- 1 root root 295225 Jun  6 16:17 bootstrap.ign
-rw-r--r-- 1 root root   2199 Jun  6 16:17 master.ign
-rw-r--r-- 1 root root   2199 Jun  6 16:17 worker.ign
[root@localhost ocp-install]#
```
## 10.初始化节点
```
方法一：通过bootstrap引导
初始化引导机器
机器不可有多网卡，需要使用单网卡。
在引导机器的过程中，需要在虚拟机软件中检查机器是否真正启动了。当启动成功了，再继续引导下一个节点。
（1）初始化引导bootstrap机器
ssh root@10.161.40.94
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
####其中，10.161.40.1是网关。bootstrap.testocpdc2.shdc2.com是bootstrap的域名。
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/bootstrap.ign ip=10.161.40.94::10.161.40.1:255.255.255.0:bootstrap.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#通过grub方式写入重新引导成coreos。
#加一个大硬盘，然后重启，选择Re-Install RHEL CoreOS选项，然后等待。会再次自动重启，此时赶紧关机，更改硬盘顺序，把大硬盘放第一位，然后重启
#在bootstrap机器上执行重启：
reboot
（2）初始化引导master01
ssh root@10.161.41.167
yum -y install wget
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/master.ign ip=10.161.41.167::10.161.41.1:255.255.255.0:master01.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#在该机器上执行重启
reboot
（3）初始化引导master02
ssh root@10.161.41.148
yum -y install wget
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/master.ign ip=10.161.41.148::10.161.41.1:255.255.255.0:master02.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#在该机器上执行重启
reboot
（4）初始化引导master03
ssh root@10.161.41.149
yum -y install wget
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/master.ign ip=10.161.41.149::10.161.41.1:255.255.255.0:master03.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#在该机器上执行重启
reboot
（5）初始化引导worker1
ssh root@10.161.41.160
yum -y install wget
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/worker.ign ip=10.161.41.160::10.161.41.1:255.255.255.0:worker1.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#在该机器上执行重启
reboot
（6）初始化引导worker2
ssh root@10.161.41.161
yum -y install wget
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/worker.ign ip=10.161.41.161::10.161.41.1:255.255.255.0:worker2.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#在该机器上执行重启
reboot
（7）初始化引导worker3
ssh root@10.161.41.162
yum -y install wget
wget http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live.x86_64.iso
mkdir iso
mount -o loop rhcos-4.18.1-x86_64-live.x86_64.iso iso/
cd iso
mkdir /tmp/iso
cp -r * /tmp/iso/
cd /tmp/iso
rm ./images/pxeboot/rootfs.img -f
cp -r * /boot/
cat << EOF > /root/add1.txt
set default="0"
set timeout=3
EOF
cat << "EOF" > /root/add2.txt
menuentry 'Re-Install RHEL CoreOS' --class fedora --class gnu-linux --class gnu --class os {
        linux /images/pxeboot/vmlinuz random.trust_cpu=on rd.luks.options=discard coreos.inst=yes coreos.inst.install_dev=sdb coreos.live.rootfs_url=http://10.161.40.177:8080/repos/rhcos/rhcos-4.18.1-x86_64-live-rootfs.x86_64.img coreos.inst.ignition_url=http://10.161.40.177:8080/repos/ignition/worker.ign ip=10.161.41.162::10.161.41.1:255.255.255.0:worker3.testocpdc2.shdc2.com::none nameserver=10.161.40.177
        initrd /images/pxeboot/initrd.img /images/ignition.img
}
EOF
sed -i '68 r /root/add1.txt' /boot/grub2/grub.cfg
sed -i "91 r /root/add2.txt" /boot/grub2/grub.cfg
#在该机器上执行重启
reboot
```
### 方法二：直接安装镜像包
```
1、在节点上选择rhcos系统启动
2、在网卡上配置ip，gateway，dns（dns为跳板机的地址）
3、继续执行sudo coreos-installer install -n --insecure-ignition -I http://10.161.43.71:8080/repos/ignition/bootstrap.ign  /dev/sda
4、reboot
5、等待bootstrap引导完成之后，按2-4的步骤依次引导master1-3，worker1-3，odf1-3,其中第3步按节点类型分别修改成master.ign  worker.ign worker.ign
特别注意,需要等待bootstrap 引导完成才能安装worker

#未引导完成
[root@localhost ocp-install1]# openshift-install wait-for bootstrap-complete --dir=/root/ocp-install1/ --log-level=debug
DEBUG OpenShift Installer 4.19.4                   
DEBUG Built from commit 5551ca303f8a657f4525157ef156369252f1eb4f 
INFO Waiting up to 20m0s (until 7:05PM CST) for the Kubernetes API at https://api.2z1.ameidc1.com:6443... 
DEBUG Loading Agent Config...                      
DEBUG Still waiting for the Kubernetes API: Get "https://api.2z1.ameidc1.com:6443/version": EOF 
#引导完成
[root@localhost ocp-install1]# openshift-install wait-for bootstrap-complete --dir=/root/ocp-install2/ --log-level=debug
DEBUG OpenShift Installer 4.19.4                   
DEBUG Built from commit 5551ca303f8a657f4525157ef156369252f1eb4f 
INFO Waiting up to 20m0s (until 6:07PM CST) for the Kubernetes API at https://api.2z2.ameidc2.com:6443... 
DEBUG Loading Agent Config...                      
INFO API v1.32.6 up                               
DEBUG Loading Install Config...                    
DEBUG   Loading SSH Key...                         
DEBUG   Loading Base Domain...                     
DEBUG     Loading Platform...                      
DEBUG   Loading Cluster Name...                    
DEBUG     Loading Base Domain...                   
DEBUG     Loading Platform...                      
DEBUG   Loading Pull Secret...                     
DEBUG   Loading Platform...
DEBUG Using Install Config loaded from state file  
INFO Waiting up to 45m0s (until 6:32PM CST) for bootstrapping to complete... 
DEBUG Bootstrap status: complete # 代表完成，可以正常引导master和worker
INFO Waiting for the bootstrap etcd member to be removed... 
INFO Bootstrap etcd member has been removed       
INFO It is now safe to remove the bootstrap resources 
INFO Time elapsed: 0s                             
[root@localhost ocp-install1]#
```
## 10.在跳板机上创建普通用户ysp-dc2
```
用户名可以自行定义，把ssh密钥复制给它。使用core用户ssh登录到节点机器。
#创建普通用户，普通用户$HOME目录为/home/用户名/
useradd core
cp -ar /root/.ssh/ /home/core/
chown -R core:core /home/core/.ssh/
usermod -aG docker core
#添加到ysp组，该ysp组由适配包创建好，保证后面安装dp-tool时有sudo权限。
usermod -aG ysp core
#把配置文件拷贝到用户ysp-mcs的HOME目录下，以允许使用普通用户访问openshift：
mkdir /home/core/.kube
cp -p /root/ocp-install/auth/kubeconfig /home/core/.kube/config
chown -R core:core /home/core/.kube
#切换普通用户，执行kubectl命令查看：
su - core
kubectl get node
#使用core用户ssh登录到openshift节点机器：
ssh-keygen -R 10.161.43.78
ssh core@10.161.43.78
#注意登录节点时使用core用户，是openshift规定的，我们在跳板机上创建的用户可以自行定义用户名。
ssh-keygen -R 10.161.43.78
```
## 11.回到跳板机，等待所有节点引导安装完成。
检查证书：
```bash
oc get csr
```
对Pending的证书需要执行人工审批：

```
# 审批单个证书：
oc adm certificate approve csr-6jmqv
# 批量审批所有Pending的证书：
oc get csr | grep Pending | awk '{print $1}' | xargs oc adm certificate approve
# 查询证书
[core@package ~]$ oc get csr; # 查看节点证书是否正常,批准oc adm certificate approve csr-XXXXX
NAME                                             AGE     SIGNERNAME                                    REQUESTOR                                                                         REQUESTEDDURATION   CONDITION
csr-2cw95                                        9h      kubernetes.io/kube-apiserver-client-kubelet   system:serviceaccount:openshift-machine-config-operator:node-bootstrapper         <none>              Approved,Issued
csr-49dxj                                        9h      kubernetes.io/kubelet-serving                 system:node:master3.testocpdc2.62dc2.com                                          <none>              Approved,Issued
csr-5qf8t                                        10h     kubernetes.io/kubelet-serving                 system:node:master1.testocpdc2.62dc2.com                                          <none>              Approved,Issued
csr-6c6g8                                        9h      kubernetes.io/kubelet-serving
```
> 注意：此过程可能需要反复检查，直到全部证书为Approved。

等一段时间，大约1小时左右所有节点和服务启动正常：

```
[ysp-dc2@package ~]$
[ysp-dc2@package ~]$ oc get node
NAME                            STATUS   ROLES                  AGE     VERSION
master01.testocpdc2.shdc2.com   Ready    control-plane,master   42m     v1.31.5
master02.testocpdc2.shdc2.com   Ready    control-plane,master   39m     v1.31.5
master03.testocpdc2.shdc2.com   Ready    control-plane,master   36m     v1.31.5
worker1.testocpdc2.shdc2.com    Ready    worker                 17m     v1.31.5
worker2.testocpdc2.shdc2.com    Ready    worker                 13m     v1.31.5
worker3.testocpdc2.shdc2.com    Ready    worker                 2m41s   v1.31.5
[ysp-dc2@package ~]$
[ysp-dc2@package ~]$ oc get co
NAME                                       VERSION   AVAILABLE   PROGRESSING   DEGRADED   SINCE   MESSAGE
authentication                             4.18.1    True        False         False      5m9s
baremetal                                  4.18.1    True        False         False      39m
cloud-controller-manager                   4.18.1    True        False         False      46m
cloud-credential                           4.18.1    True        False         False      50m
cluster-autoscaler                         4.18.1    True        False         False      39m
config-operator                            4.18.1    True        False         False      40m
console                                    4.18.1    True        False         False      10m
control-plane-machine-set                  4.18.1    True        False         False      39m
csi-snapshot-controller                    4.18.1    True        False         False      40m
dns                                        4.18.1    True        False         False      39m
etcd                                       4.18.1    True        False         False      35m
image-registry                             4.18.1    True        False         False      23m
ingress                                    4.18.1    True        False         False      12m
insights                                   4.18.1    True        False         False      39m
kube-apiserver                             4.18.1    True        False         False      34m
kube-controller-manager                    4.18.1    True        False         False      34m
kube-scheduler                             4.18.1    True        False         False      35m
kube-storage-version-migrator              4.18.1    True        False         False      28m
machine-api                                4.18.1    True        False         False      39m
machine-approver                           4.18.1    True        False         False      40m
machine-config                             4.18.1    True        False         False      39m
marketplace                                4.18.1    True        False         False      39m
monitoring                                 4.18.1    True        False         False      5m23s
network                                    4.18.1    True        False         False      43m
node-tuning                                4.18.1    True        False         False      119s
olm                                        4.18.1    True        False         False      19m
openshift-apiserver                        4.18.1    True        False         False      9m21s
openshift-controller-manager               4.18.1    True        False         False      33m
openshift-samples                          4.18.1    True        False         False      22m
operator-lifecycle-manager                 4.18.1    True        False         False      39m
operator-lifecycle-manager-catalog         4.18.1    True        False         False      39m
operator-lifecycle-manager-packageserver   4.18.1    True        False         False      33m
service-ca                                 4.18.1    True        False         False      40m
storage                                    4.18.1    True        False         False      40m
[ysp-dc2@package ~]$
[ysp-dc2@package ~]$
[ysp-dc2@package ~]$ oc get mcp
NAME     CONFIG                                             UPDATED   UPDATING   DEGRADED   MACHINECOUNT   READYMACHINECOUNT   UPDATEDMACHINECOUNT   DEGRADEDMACHINECOUNT   AGE
master   rendered-master-570eec33124c8f226214ae1de28dfa46   True      False      False      3              3                   3                     0                      37m
worker   rendered-worker-2c7b8273c39e2b74cc513fda02b00d20   True      False      False      3              3                   3                     0                      37m
[ysp-dc2@package ~]$
[ysp-dc2@package ~]$
```
## 12.配置openshift环境
>主要是设置应用层的容器镜像仓库地址，加载sctp模块，端口预留等操作。
> 在研发和测试环境中，当我们安装完openshift之后、需要进行配置。

```
（1）先取YsP最新的YsP_V4.1.00.080版本（或者之后的版本）安装包，并解压。
使用前面新建的普通用户ysp-dc2登录跳板机，创建文件夹：
mkdir /home/ysp-dc2/init_cluster_config
把servPkg_platform_init_cluster_config.zip上传到该目录下，进行解压和设置： cd init_cluster_config
unzip servPkg_platform_init_cluster_config.zip
（2）配置应用层的容器镜像仓库
#执行如下命令：
cd app_image_registry
sh set_app_image_registry.sh package.testocpdc2.shdc2.com:11036
#说明：参数为镜像仓库地址，在跳板机上本机上安装harbor可直接填写镜像仓库地址。
如果配置失败，可以手工执行edit，修改spec下面的字段，参考下图：
oc edit image.config.openshift.io/cluster
设置完成后，节点可能会重启，需要按前面步骤去检查co和mcp都正常。
当使用oc get co看到AVAILABLE字段都为True时，oc get mcp的UPDATED字段为True时，认为openshift集群正常。
（3）下发其它machine-config配置
加载sctp模块，开启coredump文件，设置端口预留。
cd openshift_configs
sh set_machine_config.sh
节点会重启，需要等待openshift集群的co和mcp都正常。
注意：对于一个集群来说，一般配置成功后就不需要再反复配置了。
当下发一个配置时，节点可能会重启，需要等待openshift集群变为正常之后才能再次下发其它配置。
10.其它注意事项
（1）当检查集群安装成功后，需要把bootstrap的机器IP从haproxy配置中删除，并重启haproxy。这样bootstrap机器才能移作它用。
vi /etc/haproxy/haproxy.cfg  #注释掉bootstrap的IP所在行，或者删除
systemctl restart haproxy
（2）在使用"oc get co"检查集群状态时，如果发现某个co不正常，可以使用"oc get csr"看下有没有证书处于Pending，并对它们进行手工审批。
```
## 13.附录
https://drive.weixin.qq.com/s?k=APoArQcEAAonSuWxWmANcAlQYJABM
https://drive.weixin.qq.com/s?k=APoArQcEAAo0rtwvdpANcAlQYJABM

## 14.quay安装
请参照相关文档

配置注意事项
镜像配置实例
```
配置完成后，可能需要重启 catalog operator 和 marketplace pods
oc delete pods -n openshift-operator-lifecycle-manager -l app=catalog-operator
oc delete pods -n openshift-marketplace -l app=catalog-operator

```
ImageContentSourcePolicy
```

apiVersion: operator.openshift.io/v1alpha1
kind: ImageContentSourcePolicy
metadata:
  creationTimestamp: '2026-01-08T08:30:46Z'
  generation: 3
  managedFields:
    - apiVersion: operator.openshift.io/v1alpha1
      fieldsType: FieldsV1
      fieldsV1:
        'f:spec': {}
      manager: cluster-bootstrap
      operation: Update
      time: '2026-01-08T08:30:46Z'
    - apiVersion: operator.openshift.io/v1alpha1
      fieldsType: FieldsV1
      fieldsV1:
        'f:spec':
          'f:repositoryDigestMirrors': {}
      manager: Mozilla
      operation: Update
      time: '2026-01-09T05:28:47Z'
  name: image-policy
  resourceVersion: '330686'
  uid: 38ff3a1f-d105-4a23-993b-2b79f4ae9d39
spec:
  repositoryDigestMirrors:
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419-red'
      source: registry.redhat.io
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419-red'
      source: registry.access.redhat.com
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-release
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419-quay-io'
      source: quay.io
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419-quay-io'
      source: docker.io
```
ImageTagMirrorSet

```
apiVersion: config.openshift.io/v1
kind: ImageTagMirrorSet
metadata:
  creationTimestamp: '2026-01-09T00:48:27Z'
  generation: 2
  managedFields:
    - apiVersion: config.openshift.io/v1
      fieldsType: FieldsV1
      fieldsV1:
        'f:spec':
          .: {}
          'f:imageTagMirrors': {}
      manager: Mozilla
      operation: Update
      time: '2026-01-09T05:48:44Z'
  name: image-tag
  resourceVersion: '335645'
  uid: 65b9f912-240b-4977-a2cb-00a42ec43721
spec:
  imageTagMirrors:
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-release
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419/release'
      source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
    - mirrors:
        - 'harbor1.quay.dc.com:8443/ocp419-quay-io'
      source: quay.io
    - mirrors:
        - 'harbor1.quay.dc.com:8443/mcx.io'
        - 'harbor2.quay.dc.com:8443/mcx.io'
      source: mcx.io
```



## 安装odf

```bash
# 首先确保有可用的存储设备
# 检查本地存储设备
oc get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}' | tr ' ' '\n'
# 安装ODF Operator
cat << EOF | oc apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: odf-operator
  namespace: openshift-operators
spec:
  channel: stable-4.13
  name: odf-operator
  source: custom-operatorhub
  sourceNamespace: openshift-marketplace
  installPlanApproval: Automatic
EOF
# 等待ODF Operator就绪
oc wait --for=condition=Available deployment/odf-operator -n openshift-operators --timeout=600s
# 创建ODF存储系统
cat << EOF | oc apply -f -
apiVersion: odf.openshift.io/v1alpha1
kind: StorageSystem
metadata:
  name: odf-storage-system
  namespace: openshift-storage
spec:
  name: odf-storage-system
  kind: storagecluster.odf.openshift.io/v1
  vendor: ODF
  version: v4.13.0
EOF
```

```bash
1. `# 检查ODF状态`
2. `oc get storagesystem -n openshift-storage`
3. `oc get storagecluster -n openshift-storage`
```


## nmsate 注意事项
安装最新版本安装失败，kubernetes-nmstate-operator.4.19.0-202510081435 可以安装成功