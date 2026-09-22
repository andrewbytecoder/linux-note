





## 查看metalLB的BGP宣告

1. 只有打上 bgp-advertise的节点才会对外进行BGP宣告
```bash
[ysp-dc2@localhost networkpolicy]$ kubectl get nodes -l bgp-advertise=true
NAME                     STATUS   ROLES    AGE    VERSION
worker1.z2.ameidc2.com   Ready    worker   281d   v1.35.5
worker4.z2.ameidc2.com   Ready    worker   281d   v1.35.5
worker6.z2.ameidc2.com   Ready    worker   281d   v1.35.5
```

2. 保证所有的有VIP的IP的节点都在有宣告的节点上
```bash
[ysp-dc2@localhost networkpolicy]$ kubectl get pod -n hytera-nginx-gateway-trust-ruh -o wide 
NAME                                           READY   STATUS    RESTARTS   AGE   IP              NODE                     NOMINATED NODE   READINESS GATES
external-gateway-nginx-55bd587b7f-mrzsq        1/1     Running   0          23h   10.225.56.49    worker4.z2.ameidc2.com   <none>           <none>
external-gateway-nginx-55bd587b7f-pwd9j        1/1     Running   0          23h   10.225.73.185   worker6.z2.ameidc2.com   <none>           <none>
external-gateway-nginx-55bd587b7f-vcz4r        1/1     Running   0          23h   10.225.73.183   worker6.z2.ameidc2.com   <none>           <none>
hytera-nginx-gateway-fabric-6b97568cff-7qmpm   1/1     Running   0          23h   10.225.73.182   worker6.z2.ameidc2.com   <none>           <none>
hytera-nginx-gateway-fabric-6b97568cff-bkhzj   1/1     Running   1          23h   10.225.32.69    worker1.z2.ameidc2.com   <none>           <none>
internal-gateway-nginx-5db574b8c9-c79lp        1/1     Running   1          23h   10.225.32.70    worker1.z2.ameidc2.com   <none>           <none>
internal-gateway-nginx-5db574b8c9-fsz67        1/1     Running   1          23h   10.225.32.72    worker1.z2.ameidc2.com   <none>           <none>
internal-gateway-nginx-5db574b8c9-fz4pw        1/1     Running   1          23h   10.225.32.71    worker1.z2.ameidc2.com   <none>           <none>
mgt-gateway-nginx-559768df67-7c9bd             1/1     Running   0          23h   10.225.56.48    worker4.z2.ameidc2.com   <none>           <none>
mgt-gateway-nginx-559768df67-nlv4b             1/1     Running   0          23h   10.225.73.184   worker6.z2.ameidc2.com   <none>           <none>
mgt-gateway-nginx-559768df67-t5gfk             1/1     Running   0          23h   10.225.56.47    worker4.z2.ameidc2.com   <none>           <none>
```

3. 在对应的节点上查看BGP宣告信息
注意这里的 nei_bgp_vrf  要指定，比如这里只有 internal gateway有这个 nei_bgp_vrf  其他的指定其他的 vrf
```bash
[ysp-dc2@localhost networkpolicy]$ kubectl exec -n metallb-system -c frr metallb-speaker-tv72m -- vtysh -c "show bgp vrf nei_bgp_vrf ipv4 unicast"
BGP table version is 2, local router ID is 100.1.46.2, vrf id 18
Default local pref 100, local AS 65581
Status codes:  s suppressed, d damped, h history, u unsorted, * valid, > best, = multipath,
               i internal, r RIB-failure, S Stale, R Removed
Nexthop codes: @NNN nexthop's vrf id, < announce-nh-self
Origin codes:  i - IGP, e - EGP, ? - incomplete
RPKI validation codes: V valid, I invalid, N Not found

     Network          Next Hop            Metric LocPrf Weight Path
 *>  10.161.44.65/32  0.0.0.0                  0         32768 i
 *>  10.161.44.70/32  0.0.0.0                  0         32768 i

Displayed 2 routes and 2 total paths
[ysp-dc2@localhost networkpolicy]$ 
[ysp-dc2@localhost networkpolicy]$ kubectl exec -n metallb-system -c frr metallb-speaker-shh28 --   vtysh -c "show bgp vrf nei_bgp_vrf ipv4 unicast"
BGP table version is 1, local router ID is 100.1.46.5, vrf id 19
Default local pref 100, local AS 65581
Status codes:  s suppressed, d damped, h history, u unsorted, * valid, > best, = multipath,
               i internal, r RIB-failure, S Stale, R Removed
Nexthop codes: @NNN nexthop's vrf id, < announce-nh-self
Origin codes:  i - IGP, e - EGP, ? - incomplete
RPKI validation codes: V valid, I invalid, N Not found

     Network          Next Hop            Metric LocPrf Weight Path
 *>  10.161.44.70/32  0.0.0.0                  0         32768 i

Displayed 1 routes and 1 total paths
```

比如查看wai_bgp_vrf
```bash
[ysp-dc2@localhost networkpolicy]$ kubectl exec -n metallb-system -c frr metallb-speaker-shh28 -- vtysh -c "show bgp vrf wai_bgp_vrf ipv4 unicast"
BGP table version is 3, local router ID is 100.1.47.5, vrf id 18
Default local pref 100, local AS 65581
Status codes:  s suppressed, d damped, h history, u unsorted, * valid, > best, = multipath,
               i internal, r RIB-failure, S Stale, R Removed
Nexthop codes: @NNN nexthop's vrf id, < announce-nh-self
Origin codes:  i - IGP, e - EGP, ? - incomplete
RPKI validation codes: V valid, I invalid, N Not found

     Network          Next Hop            Metric LocPrf Weight Path
 *>  10.161.33.65/32  0.0.0.0                  0         32768 i
 *>  10.161.33.67/32  0.0.0.0                  0         32768 i
 *>  10.161.33.68/32  0.0.0.0                  0         32768 i

Displayed 3 routes and 3 total paths
```

## 查看对应网络的BGP addr
```bash
[ysp-dc2@localhost networkpolicy]$ kubectl -n metallb-system exec metallb-speaker-tv72m -c frr -- ip -br -4 addr
lo               UNKNOWN        127.0.0.1/8 
ovn-k8s-mp0      UNKNOWN        10.225.32.2/21 
wai_bgp@ens160   UP             100.1.47.2/24 
nei_out@ens160   UP             100.1.49.2/24 
m_out@ens160     UP             100.1.48.2/24 
nei_bgp@ens160   UP             100.1.46.2/24 
m_bgp@ens160     UP             100.1.31.2/24 
wai_out@ens160   UP             100.1.50.2/24 
br-ex            UNKNOWN        10.161.45.34/24 169.254.0.2/17 
```


查看自己的AS号码
```bash
[ysp-dc2@localhost networkpolicy]$ kubectl exec -n metallb-system -c frr metallb-speaker-tv72m -- vtysh -c "show bgp vrf nei_bgp_vrf neighbors 100.1.46.1"
BGP neighbor is 100.1.46.1, remote AS 65520, local AS 65581, external link
  Local Role: undefined
  Remote Role: undefined
  BGP version 4, remote router ID 0.0.0.0, local router ID 100.1.46.2
  BGP state = Active
  Last read 05:55:16, Last write never
  Hold time is 180 seconds, keepalive interval is 60 seconds
  Configured hold time is 180 seconds, keepalive interval is 60 seconds
  Configured tcp-mss is 0, synced tcp-mss is 0
  Configured conditional advertisements interval is 60 seconds
  Graceful restart information:
    Local GR Mode: Helper*
    Remote GR Mode: NotApplicable

    R bit: False
    N bit: False
    Timers:
      Configured Restart Time(sec): 120
      Received Restart Time(sec): 0
      Configured LLGR Stale Path Time(sec): 0
  Message statistics:
    Inq depth is 0
    Outq depth is 0
                         Sent       Rcvd
    Opens:                  0          0
    Notifications:          0          0
    Updates:                0          0
    Keepalives:             0          0
    Route Refresh:          0          0
    Capability:             0          0
    Total:                  0          0

  Prefix statistics:
    Inbound filtered: 0
    AS-PATH loop: 0
    Originator loop: 0
    Cluster loop: 0
    Invalid next-hop: 0
    Withdrawn: 0
    Attributes discarded: 0

  Minimum time between advertisement runs is 0 seconds
  Update delay timer is 0 seconds (remaining: 0)

 For address family: IPv4 Unicast
  Not part of any update group
  Community attribute sent to this neighbor(all)
  Inbound path policy configured
  Outbound path policy configured
  Route map for incoming advertisements is *100.1.46.1-nei_bgp_vrf-in
  Route map for outgoing advertisements is *100.1.46.1-nei_bgp_vrf-out
  0 accepted prefixes

  Connections established 0; dropped 0
  Last reset 05:55:16,  No path to specified Neighbor (n/a)
  External BGP neighbor may be up to 255 hops away.
Local host: 100.1.46.2, Local port: 55568
Foreign host: 100.1.46.1, Foreign port: 179
Nexthop: 0.0.0.0
Nexthop global: ::
Nexthop local: ::
BGP connection: non shared network
BGP Connect Retry Timer in Seconds: 120
Next connect timer due in 6 seconds
Read thread: off  Write thread: off  FD used: -1
```

