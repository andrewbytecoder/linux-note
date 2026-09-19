
![[Pasted image 20260919095721.png]]

## 配置
### 配置服务器上的配置
#### 配置IPAddressPool
```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: internal-addr-pool
  namespace: metallb-system
spec:
  addresses:
    - 10.161.44.2-10.161.44.4
  autoAssign: true
  avoidBuggyIPs: false
```
#### 配置BGPPeer
```yaml
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: bgp-peer
  namespace: metallb-system
spec:
  disableMP: false
  dualStackAddressFamily: false
  myASN: 65580
  peerASN: 65520
  peerAddress: 10.161.43.6
  peerPort: 179
```

#### 配置BGPAdvertisement
```yaml
apiVersion: metallb.io/v1beta1
kind: BGPAdvertisement
metadata:
  name: internal-addr-pool-advertisement
  namespace: metallb-system
spec:
  aggregationLength: 32
  aggregationLengthV6: 128
  ipAddressPools:
    - internal-addr-pool
```

### 路由器上的配置
```bash
1、与bgp 建链，用默认的ovn网络的网卡，原因如下：
  a 默认路由配置在上面
  b 当数据包到达节点后，kube-proxy 负责流量路由的最后一跳，将数据包发送到服务中的某个特定 Pod。
2、建链后，只宣告metalllb的路由，通过svc查看的
```
## 效果验证
使用如下脚本 `get_metallbinfo.sh` 来检测metallb的状态
```bash
#!/bin/bash
# 优化版: get_metallbinfo.sh
# 功能: 自动收集 MetalLB BGP 配置、状态、路由、Gateway 后端 Pod 节点分布及 Pod NAD IP
#
# 用法:
#   $0 [ns1 ns2 ...]          # 指定一个或多个命名空间统计 NAD IP / LoadBalancer VIP
#   $0                        # 未指定时 NAD/LB 统计默认使用 GATEWAY_NS (nginx-gateway)
# 环境变量:
#   NAMESPACE      MetalLB 系统命名空间 (默认 metallb-system)
#   GATEWAY_NS     Gateway 命名空间 (默认 nginx-gateway)

set -uo pipefail

NAMESPACE="${NAMESPACE:-metallb-system}"
GATEWAY_NS="${GATEWAY_NS:-nginx-gateway}"
FRR_CONTAINER="frr"

# 命令行指定的 Pod NAD / LoadBalancer 统计命名空间（可多个）
if [ $# -gt 0 ]; then
    POD_NAD_NAMESPACES=("$@")
else
    POD_NAD_NAMESPACES=("$GATEWAY_NS")
fi

if command -v oc >/dev/null 2>&1; then
    KCTL=oc
elif command -v kubectl >/dev/null 2>&1; then
    KCTL=kubectl
else
    echo "错误: 未找到 oc 或 kubectl"
    exit 1
fi

echo "=========================================="
echo "MetalLB BGP 状态检查 (命名空间: $NAMESPACE)"
echo "=========================================="
echo

# 1. CRD
echo ">>> 1. MetalLB CRD 列表:"
$KCTL get crd | grep metallb.io || echo "未找到 metallb CRD"
echo

# 2. IPAddressPool
echo ">>> 2. IPAddressPool 配置:"
$KCTL get ipaddresspools -n "$NAMESPACE" -o wide || echo "未找到 IPAddressPool"
for pool in $($KCTL get ipaddresspools -n "$NAMESPACE" -o name 2>/dev/null); do
    echo "--- $pool 详情 ---"
    $KCTL describe "$pool" -n "$NAMESPACE" | grep -E "Addresses|Auto Assign|assignedIPv|availableIPv" || true
done
echo

# 3. BGPPeer
echo ">>> 3. BGPPeer 配置:"
$KCTL get bgppeers -n "$NAMESPACE" -o wide || echo "未找到 BGPPeer"
for peer in $($KCTL get bgppeers -n "$NAMESPACE" -o name 2>/dev/null); do
    echo "--- $peer 详情 ---"
    $KCTL get "$peer" -n "$NAMESPACE" -o yaml | grep -E "peerAddress|peerASN|myASN|nodeSelectors|multiHops" || true
done
echo

# 4. BGPAdvertisement
echo ">>> 4. BGPAdvertisement 配置:"
$KCTL get bgpadvertisements -n "$NAMESPACE" -o wide || echo "未找到 BGPAdvertisement"
echo

# 5. L2Advertisement
echo ">>> 5. L2Advertisement 配置 (如果有):"
$KCTL get l2advertisements -n "$NAMESPACE" -o wide 2>/dev/null || echo "无 L2 模式配置"
echo

# 6. MetalLB Pod 状态
echo ">>> 6. MetalLB Pod 运行状态:"
$KCTL get pods -n "$NAMESPACE" -o wide
echo

# 7. LoadBalancer Service
echo ">>> 7. 集群中的 LoadBalancer Service:"
$KCTL get svc -A -o wide | grep LoadBalancer || echo "未找到 LoadBalancer 类型 Service"
echo

# 7.1 Gateway-Nginx 数据面 Pod
echo ">>> 7.1 Gateway-Nginx 数据面 Pod:"
$KCTL get pods -n "$GATEWAY_NS" -o wide 2>/dev/null | grep -E 'NAME|gateway-nginx' || echo "命名空间 $GATEWAY_NS 中未找到 gateway-nginx Pod"
echo

# 7.2 Gateway 与后端 Pod 节点分布
echo ">>> 7.2 Gateway-Nginx 与后端 Pod 节点分布:"
echo "(命名空间: $GATEWAY_NS)"
echo

list_service_backend_pods() {
    local svc_ns="$1"
    local svc_name="$2"
    local seen_pods=""
    local node_lines=""

    echo "  后端 Service: ${svc_ns}/${svc_name}"

    local eps
    eps=$($KCTL get endpoints "$svc_name" -n "$svc_ns" -o jsonpath='{range .subsets[*]}{range .addresses[*]}{.targetRef.name}{"\n"}{end}{end}' 2>/dev/null || true)
    if [ -z "$eps" ]; then
        eps=$($KCTL get endpointslice -n "$svc_ns" -l "kubernetes.io/service-name=${svc_name}" \
            -o jsonpath='{range .items[*]}{range .endpoints[*]}{.targetRef.name}{"\n"}{end}{end}' 2>/dev/null || true)
    fi

    if [ -z "$eps" ]; then
        echo "    (无 Ready Endpoint)"
        return
    fi

    printf '%s\n' "$eps" | sort -u | while read -r pod_name; do
        [ -z "$pod_name" ] && continue
        pod_line=$($KCTL get pod "$pod_name" -n "$svc_ns" \
            -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP,READY:.status.containerStatuses[*].ready \
            --no-headers 2>/dev/null || true)
        if [ -n "$pod_line" ]; then
            echo "    $pod_line"
        fi
    done

    # 节点汇总（单独再查一遍，避免 subshell 丢失变量）
    printf '%s\n' "$eps" | sort -u | while read -r pod_name; do
        [ -z "$pod_name" ] && continue
        $KCTL get pod "$pod_name" -n "$svc_ns" -o jsonpath='{.spec.nodeName}{"\n"}' 2>/dev/null || true
    done | sort | uniq -c | sort -rn | awk '{printf "    %s: %d\n", $2, $1}' | sed '1i\  后端 Pod 节点分布:'
}

gateway_svcs=$($KCTL get svc -n "$GATEWAY_NS" -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep gateway-nginx || true)

if [ -z "$gateway_svcs" ]; then
    echo "未在 $GATEWAY_NS 找到 gateway-nginx LoadBalancer Service"
    echo
else
    for gw_svc in $gateway_svcs; do
        gw_name=$($KCTL get svc "$gw_svc" -n "$GATEWAY_NS" \
            -o jsonpath='{.metadata.labels.gateway\.networking\.k8s\.io/gateway-name}' 2>/dev/null || true)
        [ -z "$gw_svc" ] && continue

        ext_ip=$($KCTL get svc "$gw_svc" -n "$GATEWAY_NS" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
        cluster_ip=$($KCTL get svc "$gw_svc" -n "$GATEWAY_NS" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)
        ports=$($KCTL get svc "$gw_svc" -n "$GATEWAY_NS" -o jsonpath='{range .spec.ports[*]}{.port}{"/"}{.protocol}{","}{end}' 2>/dev/null | sed 's/,$//')

        echo "================================================================"
        echo "Gateway Service: ${GATEWAY_NS}/${gw_svc}"
        echo "  Gateway CR 名: ${gw_name:-(未知)}"
        echo "  MetalLB VIP:   ${ext_ip:-<pending>}"
        echo "  ClusterIP:     ${cluster_ip:-N/A}"
        echo "  端口:          ${ports:-N/A}"
        echo

        echo "[数据面 Pod - ${gw_svc}]"
        dp_pods=$($KCTL get pods -n "$GATEWAY_NS" -l "gateway.networking.k8s.io/gateway-name=${gw_name}" \
            -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP,READY:.status.containerStatuses[*].ready \
            --no-headers 2>/dev/null || true)
        if [ -z "$dp_pods" ]; then
            dp_pods=$($KCTL get pods -n "$GATEWAY_NS" -l "app.kubernetes.io/name=${gw_svc}" \
                -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP,READY:.status.containerStatuses[*].ready \
                --no-headers 2>/dev/null || true)
        fi
        if [ -n "$dp_pods" ]; then
            echo "$dp_pods" | awk '{printf "  %-50s %-28s %-18s %s\n", $1, $2, $3, $4}'
            echo "  数据面 Pod 节点分布:"
            echo "$dp_pods" | awk '{print $2}' | sort | uniq -c | sort -rn | awk '{printf "    %s: %d\n", $2, $1}'
        else
            echo "  (未找到数据面 Pod)"
        fi
        echo

        echo "[HTTPRoute 关联的后端 Service / Pod]"
        route_found=0
        for route_key in $($KCTL get httproute -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{"\n"}{end}' 2>/dev/null); do
            [ -z "$route_key" ] && continue
            route_ns="${route_key%%/*}"
            route_name="${route_key#*/}"

            parent_match=$($KCTL get httproute "$route_name" -n "$route_ns" -o json 2>/dev/null | \
                grep -E "\"name\": \"${gw_name}\"" || true)
            [ -z "$parent_match" ] && continue

            # 确认 parentRef 指向本 Gateway（namespace 默认同 HTTPRoute 或 GATEWAY_NS）
            parent_ok=$($KCTL get httproute "$route_name" -n "$route_ns" -o jsonpath="{range .spec.parentRefs[*]}{.name}{' '}{.namespace}{'\n'}{end}" 2>/dev/null | \
                awk -v gw="$gw_name" -v gwns="$GATEWAY_NS" -v rns="$route_ns" '$1==gw && ($2=="" || $2==gwns || $2==rns){found=1} END{print found+0}')
            [ "$parent_ok" != "1" ] && continue

            route_found=1
            hostnames=$($KCTL get httproute "$route_name" -n "$route_ns" -o jsonpath='{.spec.hostnames[*]}' 2>/dev/null || true)
            echo "  HTTPRoute: ${route_ns}/${route_name}"
            [ -n "$hostnames" ] && echo "    hostnames: $hostnames"

            backends=$($KCTL get httproute "$route_name" -n "$route_ns" -o jsonpath='{range .spec.rules[*]}{range .backendRefs[*]}{.namespace}{"/"}{.name}{":"}{.port}{"\n"}{end}{end}' 2>/dev/null || true)
            if [ -z "$backends" ]; then
                echo "    (无 backendRefs)"
                continue
            fi

            printf '%s\n' "$backends" | sort -u | while read -r backend; do
                [ -z "$backend" ] && continue
                if [[ "$backend" == /* ]]; then
                    b_ns="$route_ns"
                    rest="${backend#/}"
                else
                    b_ns="${backend%%/*}"
                    rest="${backend#*/}"
                fi
                b_name="${rest%%:*}"
                b_port="${rest#*:}"

                echo "    backendRef: ${b_ns}/${b_name}:${b_port}"
                list_service_backend_pods "$b_ns" "$b_name"
            done
            echo
        done

        if [ "$route_found" -eq 0 ]; then
            echo "  (未找到绑定 Gateway ${gw_name} 的 HTTPRoute)"
            echo "  提示: 可检查 GRPCRoute / TCPRoute，或 Gateway 直接引用的 Service"
            echo
        fi

        # Gateway CR spec.listeners 中引用的附加 Service（若有）
        if [ -n "$gw_name" ]; then
            gw_listeners=$($KCTL get gateway "$gw_name" -n "$GATEWAY_NS" -o yaml 2>/dev/null | grep -E "^\s+- name:|backendRef|kind: Service" || true)
            if [ -n "$gw_listeners" ]; then
                echo "[Gateway CR ${gw_name} listeners 摘要]"
                echo "$gw_listeners" | head -20
                echo
            fi
        fi
    done
fi

# 7.3 Pod NAD IP（同一 Pod 多个 NAD 合并为一行）
echo ">>> 7.3 Pod NAD IP 统计 (命名空间: ${POD_NAD_NAMESPACES[*]}):"
if ! command -v jq >/dev/null 2>&1; then
    echo "  跳过: 未安装 jq，无法解析 network-status 注解"
else
    (
        printf "NAMESPACE\tPOD\tNODE\tNAD\tINTERFACE\tIP\n"
        for ns in "${POD_NAD_NAMESPACES[@]}"; do
            $KCTL get pods -n "$ns" -o json 2>/dev/null | jq -r '
.items[]
| select(.metadata.annotations["k8s.v1.cni.cncf.io/network-status"])
| {
    namespace: .metadata.namespace,
    pod: .metadata.name,
    node: (.spec.nodeName // "-"),
    nads: (
      .metadata.annotations["k8s.v1.cni.cncf.io/network-status"]
      | fromjson[]
      | select(.default != true)
    )
  }
| select(.nads | length > 0)
| [
    .namespace,
    .pod,
    .node,
    (.nads | map(.name) | join(",")),
    (.nads | map(.interface // "-") | join(",")),
    (.nads | map((.ips // []) | join(";")) | join(","))
  ]
| @tsv
'
        done
    ) | column -t -s $'\t' 2>/dev/null || echo "  (无带 NAD 的 Pod 或命名空间不存在)"
fi
echo

# 7.4 指定命名空间的 LoadBalancer VIP
echo ">>> 7.4 LoadBalancer VIP (命名空间: ${POD_NAD_NAMESPACES[*]}):"
for ns in "${POD_NAD_NAMESPACES[@]}"; do
    echo "--- namespace: ${ns} ---"
    $KCTL get svc -n "$ns" --field-selector spec.type=LoadBalancer -o wide 2>/dev/null \
        || echo "  (命名空间不存在或无 LoadBalancer Service)"
    echo
done

# 8. BGP 会话状态和路由
echo ">>> 8. BGP 会话状态和路由 (从每个 Speaker 的 FRR 容器获取):"
SPEAKER_PODS=$($KCTL get pods -n "$NAMESPACE" --no-headers -o custom-columns=":metadata.name" 2>/dev/null | grep '^metallb-speaker-' || true)
if [ -z "$SPEAKER_PODS" ]; then
    SPEAKER_PODS=$($KCTL get pods -n "$NAMESPACE" -l app=metallb --no-headers -o custom-columns=":metadata.name" 2>/dev/null | grep speaker || true)
fi
if [ -z "$SPEAKER_PODS" ]; then
    echo "错误：无法找到任何 MetalLB Speaker Pod。"
    exit 1
fi

for pod in $SPEAKER_PODS; do
    echo "--------------- Speaker Pod: $pod ---------------"
    NODE=$($KCTL get pod -n "$NAMESPACE" "$pod" -o jsonpath='{.spec.nodeName}')
    echo "所在节点: $NODE"

    echo "--- BGP Summary ---"
    $KCTL exec -n "$NAMESPACE" "$pod" -c "$FRR_CONTAINER" -- vtysh -c "show bgp summary" 2>/dev/null || echo "无法获取 BGP 汇总"

    echo "--- BGP 路由表 (IPv4 Unicast) ---"
    $KCTL exec -n "$NAMESPACE" "$pod" -c "$FRR_CONTAINER" -- vtysh -c "show bgp ipv4 unicast" 2>/dev/null || echo "无法获取 BGP 路由表"

    echo "--- BGP 邻居发送的路由 ---"
    NEIGHBORS=$($KCTL exec -n "$NAMESPACE" "$pod" -c "$FRR_CONTAINER" -- vtysh -c "show bgp summary" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | awk '{print $1}' || true)
    if [ -z "$NEIGHBORS" ]; then
        echo "未找到 BGP 邻居"
    else
        for nb in $NEIGHBORS; do
            echo "邻居: $nb"
            $KCTL exec -n "$NAMESPACE" "$pod" -c "$FRR_CONTAINER" -- \
                vtysh -c "show bgp ipv4 unicast neighbors ${nb} advertised-routes" 2>/dev/null \
                || $KCTL exec -n "$NAMESPACE" "$pod" -c "$FRR_CONTAINER" -- \
                vtysh -c "show ip bgp neighbors ${nb} advertised-routes" 2>/dev/null \
                || echo "无法获取 advertised-routes (邻居可能未 Established)"
        done
    fi
    echo
done

# 9. 节点上抓包提示
echo ">>> 9. 节点上抓包检查建议 (如需手动测试):"
echo "在 worker 节点上执行: sudo tcpdump -i br-ex host <VIP> and port 8443 -n"
echo

echo ">>> 10. 节点 NAT 表 (需在对应 worker 上执行):"
echo "sudo iptables -t nat -L -n -v"
echo

echo ">>> 11. 路由器侧检查建议:"
echo "   - 确认 BGP 邻居: show bgp peer <worker br-ex IP>"
echo "   - 确认 VIP 路由: show ip route <MetalLB VIP>"
echo "   - 确认 ECMP: show ip routing-table protocol bgp"
echo

echo "=========================================="
echo "检查完成"
```


执行结果如下：
```bash
[ysp-dc2@localhost ~]$ sh get_metallbinfo2.sh 
==========================================
MetalLB BGP 状态检查 (命名空间: metallb-system)
==========================================

>>> 1. MetalLB CRD 列表:
bfdprofiles.metallb.io                                            2026-09-06T08:07:30Z
bgpadvertisements.metallb.io                                      2026-09-06T08:07:30Z
bgppeers.metallb.io                                               2026-09-06T08:07:30Z
communities.metallb.io                                            2026-09-06T08:07:30Z
configurationstates.metallb.io                                    2026-09-06T08:07:30Z
ipaddresspools.metallb.io                                         2026-09-06T08:07:30Z
l2advertisements.metallb.io                                       2026-09-06T08:07:30Z
servicebgpstatuses.metallb.io                                     2026-09-06T08:07:30Z
servicel2statuses.metallb.io                                      2026-09-06T08:07:30Z

>>> 2. IPAddressPool 配置:
NAME                 AUTO ASSIGN   AVOID BUGGY IPS   ADDRESSES
external-addr-pool   true          false             ["10.161.33.65-10.161.33.80"]
internal-addr-pool   true          false             ["10.161.44.65-10.161.44.90"]
mgt-addr-pool        true          false             ["10.161.35.113-10.161.35.126"]
--- ipaddresspool.metallb.io/external-addr-pool 详情 ---
  Addresses:
  Auto Assign:       true
  assignedIPv4:   3
  assignedIPv6:   0
  availableIPv4:  13
  availableIPv6:  0
--- ipaddresspool.metallb.io/internal-addr-pool 详情 ---
  Addresses:
  Auto Assign:       true
  assignedIPv4:   2
  assignedIPv6:   0
  availableIPv4:  24
  availableIPv6:  0
--- ipaddresspool.metallb.io/mgt-addr-pool 详情 ---
  Addresses:
  Auto Assign:       true
  assignedIPv4:   1
  assignedIPv6:   0
  availableIPv4:  13
  availableIPv6:  0

>>> 3. BGPPeer 配置:
NAME                ADDRESS      ASN     BFD PROFILE   MULTI HOPS
external-bgp-peer   100.1.47.1   65520                 true
internal-bgp-peer   100.1.46.1   65520                 true
mgt-bgp-peer        100.1.31.1   65520                 true
--- bgppeer.metallb.io/external-bgp-peer 详情 ---
  myASN: 65581
  peerASN: 65520
  peerAddress: 100.1.47.1
--- bgppeer.metallb.io/internal-bgp-peer 详情 ---
  myASN: 65581
  peerASN: 65520
  peerAddress: 100.1.46.1
--- bgppeer.metallb.io/mgt-bgp-peer 详情 ---
  myASN: 65581
  peerASN: 65520
  peerAddress: 100.1.31.1

>>> 4. BGPAdvertisement 配置:
NAME                               IPADDRESSPOOLS           IPADDRESSPOOL SELECTORS   PEERS                   NODE SELECTORS
external-addr-pool-advertisement   ["external-addr-pool"]                             ["external-bgp-peer"]   [{"matchLabels":{"bgp-advertise":"true"}}]
internal-addr-pool-advertisement   ["internal-addr-pool"]                             ["internal-bgp-peer"]   [{"matchLabels":{"bgp-advertise":"true"}}]
mgt-addr-pool-advertisement        ["mgt-addr-pool"]                                  ["mgt-bgp-peer"]        [{"matchLabels":{"bgp-advertise":"true"}}]

>>> 5. L2Advertisement 配置 (如果有):

>>> 6. MetalLB Pod 运行状态:
NAME                                  READY   STATUS    RESTARTS   AGE     IP              NODE                     NOMINATED NODE   READINESS GATES
metallb-controller-84c779bc66-tl6cg   1/1     Running   0          12d     10.225.48.210   worker7.z2.ameidc2.com   <none>           <none>
metallb-speaker-8fqq5                 4/4     Running   0          2d16h   10.161.45.35    worker2.z2.ameidc2.com   <none>           <none>
metallb-speaker-d7xm7                 4/4     Running   0          12d     10.161.45.53    worker7.z2.ameidc2.com   <none>           <none>
metallb-speaker-r67wm                 4/4     Running   0          12d     10.161.45.36    worker3.z2.ameidc2.com   <none>           <none>
metallb-speaker-shh28                 4/4     Running   0          2d18h   10.161.45.50    worker4.z2.ameidc2.com   <none>           <none>
metallb-speaker-tgnw4                 4/4     Running   0          12d     10.161.45.51    worker5.z2.ameidc2.com   <none>           <none>
metallb-speaker-tv72m                 4/4     Running   0          2d15h   10.161.45.34    worker1.z2.ameidc2.com   <none>           <none>
metallb-speaker-v7xvn                 4/4     Running   0          12d     10.161.45.52    worker6.z2.ameidc2.com   <none>           <none>

>>> 7. 集群中的 LoadBalancer Service:
hytera-mcs01-trust-ruh                             bf-lb-external                                             LoadBalancer   172.31.3.141     10.161.33.68                           11106:31110/TCP                                                                           4d13h   app.kubernetes.io/svcname=bf
hytera-mcs01-trust-ruh                             pres-lb-internal                                           LoadBalancer   172.31.89.56     10.161.44.70                           8041:31752/TCP                                                                            4d13h   app.kubernetes.io/svcname=pres
hytera-mcs01-trust-ruh                             ulpproxy-lb-external                                       LoadBalancer   172.31.242.181   10.161.33.67                           11127:31824/TCP,11132:30302/TCP,11129:30676/TCP,11134:31403/TCP                           4d17h   app.kubernetes.io/svcname=ulpproxy
hytera-nginx-gateway-trust-ruh                     external-gateway-nginx                                     LoadBalancer   172.31.132.112   10.161.33.65                           8080:31086/TCP,8443:30965/TCP                                                             5d10h   app.kubernetes.io/instance=hytera-nginx-gateway-fabric,app.kubernetes.io/managed-by=hytera-nginx-gateway-fabric-nginx,app.kubernetes.io/name=external-gateway-nginx,gateway.networking.k8s.io/gateway-name=external-gateway
hytera-nginx-gateway-trust-ruh                     internal-gateway-nginx                                     LoadBalancer   172.31.89.171    10.161.44.65                           8080:30167/TCP,8443:31396/TCP                                                             5d10h   app.kubernetes.io/instance=hytera-nginx-gateway-fabric,app.kubernetes.io/managed-by=hytera-nginx-gateway-fabric-nginx,app.kubernetes.io/name=internal-gateway-nginx,gateway.networking.k8s.io/gateway-name=internal-gateway
hytera-nginx-gateway-trust-ruh                     mgt-gateway-nginx                                          LoadBalancer   172.31.176.64    10.161.35.113                          8080:30865/TCP,8443:32733/TCP                                                             5d10h   app.kubernetes.io/instance=hytera-nginx-gateway-fabric,app.kubernetes.io/managed-by=hytera-nginx-gateway-fabric-nginx,app.kubernetes.io/name=mgt-gateway-nginx,gateway.networking.k8s.io/gateway-name=mgt-gateway

>>> 7.1 Gateway-Nginx 数据面 Pod:
NAME                                          READY   STATUS    RESTARTS   AGE     IP              NODE                     NOMINATED NODE   READINESS GATES
external-gateway-nginx-cf57cd4f4-p6rlj        1/1     Running   0          2d19h   10.225.56.7     worker4.z2.ameidc2.com   <none>           <none>
external-gateway-nginx-cf57cd4f4-qcjdm        1/1     Running   0          2d19h   10.225.56.12    worker4.z2.ameidc2.com   <none>           <none>
external-gateway-nginx-cf57cd4f4-s8ncr        1/1     Running   0          5d10h   10.225.73.110   worker6.z2.ameidc2.com   <none>           <none>
internal-gateway-nginx-5d47866bb6-gfb8t       1/1     Running   0          2d19h   10.225.56.8     worker4.z2.ameidc2.com   <none>           <none>
internal-gateway-nginx-5d47866bb6-mtchf       1/1     Running   0          2d18h   10.225.56.6     worker4.z2.ameidc2.com   <none>           <none>
internal-gateway-nginx-5d47866bb6-slzq9       1/1     Running   0          5d10h   10.225.73.108   worker6.z2.ameidc2.com   <none>           <none>
mgt-gateway-nginx-744479dcbb-46kfl            1/1     Running   0          5d10h   10.225.73.109   worker6.z2.ameidc2.com   <none>           <none>
mgt-gateway-nginx-744479dcbb-8kpdt            1/1     Running   0          2d19h   10.225.56.5     worker4.z2.ameidc2.com   <none>           <none>
mgt-gateway-nginx-744479dcbb-h65lv            1/1     Running   0          2d19h   10.225.73.168   worker6.z2.ameidc2.com   <none>           <none>

>>> 7.2 Gateway-Nginx 与后端 Pod 节点分布:
(命名空间: hytera-nginx-gateway-trust-ruh)

================================================================
Gateway Service: hytera-nginx-gateway-trust-ruh/external-gateway-nginx
  Gateway CR 名: external-gateway
  MetalLB VIP:   10.161.33.65
  ClusterIP:     172.31.132.112
  端口:          8080/TCP,8443/TCP

[数据面 Pod - external-gateway-nginx]
  external-gateway-nginx-cf57cd4f4-p6rlj             worker4.z2.ameidc2.com       10.225.56.7        true
  external-gateway-nginx-cf57cd4f4-qcjdm             worker4.z2.ameidc2.com       10.225.56.12       true
  external-gateway-nginx-cf57cd4f4-s8ncr             worker6.z2.ameidc2.com       10.225.73.110      true
  数据面 Pod 节点分布:
    worker4.z2.ameidc2.com: 2
    worker6.z2.ameidc2.com: 1

[HTTPRoute 关联的后端 Service / Pod]
  HTTPRoute: hytera-mcs01-trust-ruh/alpxy-public-route
    backendRef: hytera-mcs01-trust-ruh/alpxy:8080
  后端 Service: hytera-mcs01-trust-ruh/alpxy
    alpxy-c9544c6f9-mr8w7   worker3.z2.ameidc2.com   10.225.25.29   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/dms-public-route
    backendRef: hytera-mcs01-trust-ruh/dms:8080
  后端 Service: hytera-mcs01-trust-ruh/dms
    dms-363-7f67c4ff9-rwlrk   worker2.z2.ameidc2.com   10.225.40.20   true
    dms-396-6f569d6c94-2v4vb   worker3.z2.ameidc2.com   10.225.25.14   true
    dms-429-cbf646f64-vvs5g   worker2.z2.ameidc2.com   10.225.40.40   true
  后端 Pod 节点分布:
    worker2.z2.ameidc2.com: 2
    worker3.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/dui-public-route
    backendRef: hytera-mcs01-trust-ruh/dui:8080
  后端 Service: hytera-mcs01-trust-ruh/dui
    dui-78d954d47d-gzh9r   worker1.z2.ameidc2.com   10.225.32.11   true
    dui-78d954d47d-j2whj   worker3.z2.ameidc2.com   10.225.25.75   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker1.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/frs-public-route
    backendRef: hytera-mcs01-trust-ruh/frs:8080
  后端 Service: hytera-mcs01-trust-ruh/frs
    frs-627-598865c786-xlh2j   worker2.z2.ameidc2.com   10.225.40.26   true
    frs-660-6d899f4f5b-ksgwt   worker3.z2.ameidc2.com   10.225.25.60   true
    frs-693-cc5c84d5f-2dcz8   worker2.z2.ameidc2.com   10.225.40.38   true
  后端 Pod 节点分布:
    worker2.z2.ameidc2.com: 2
    worker3.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/idms-public-route
    backendRef: hytera-mcs01-trust-ruh/idms:8080
  后端 Service: hytera-mcs01-trust-ruh/idms
    idms-0   worker3.z2.ameidc2.com   10.225.25.32   true
    idms-1   worker2.z2.ameidc2.com   10.225.40.68   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/kms-public-route
    backendRef: hytera-mcs01-trust-ruh/kms:8080
  后端 Service: hytera-mcs01-trust-ruh/kms
    kms-0   worker3.z2.ameidc2.com   10.225.25.9   true
    kms-1   worker2.z2.ameidc2.com   10.225.40.49   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/n5i-public-route
    backendRef: hytera-mcs01-trust-ruh/n5i:8080
  后端 Service: hytera-mcs01-trust-ruh/n5i
    n5i-0   worker3.z2.ameidc2.com   10.225.25.1   true
    n5i-1   worker2.z2.ameidc2.com   10.225.40.59   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/ums-public-route
    backendRef: hytera-mcs01-trust-ruh/ums:8080
  后端 Service: hytera-mcs01-trust-ruh/ums
    ums-0   worker2.z2.ameidc2.com   10.225.40.43   true
    ums-1   worker3.z2.ameidc2.com   10.225.25.18   true
    ums-2   worker2.z2.ameidc2.com   10.225.40.57   true
    ums-3   worker2.z2.ameidc2.com   10.225.40.69   true
    ums-4   worker3.z2.ameidc2.com   10.225.25.19   true
    ums-5   worker3.z2.ameidc2.com   10.225.25.66   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 3
    worker2.z2.ameidc2.com: 3

  HTTPRoute: hytera-mrps01-trust-ruh/idms-public-route
    backendRef: hytera-mrps01-trust-ruh/idms:8080
  后端 Service: hytera-mrps01-trust-ruh/idms
    idms-68121-7dd4cfbf4c-75njq   worker5.z2.ameidc2.com   10.225.65.179   true
    idms-68154-7d5c445979-wpw6x   worker6.z2.ameidc2.com   10.225.73.149   true
  后端 Pod 节点分布:
    worker6.z2.ameidc2.com: 1
    worker5.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/mrpsui-public-route
    backendRef: hytera-mrps01-trust-ruh/mrpsui:8080
  后端 Service: hytera-mrps01-trust-ruh/mrpsui
    mrpsui-6bbb4f7696-pq652   worker5.z2.ameidc2.com   10.225.65.167   true
  后端 Pod 节点分布:
    worker5.z2.ameidc2.com: 1

================================================================
Gateway Service: hytera-nginx-gateway-trust-ruh/internal-gateway-nginx
  Gateway CR 名: internal-gateway
  MetalLB VIP:   10.161.44.65
  ClusterIP:     172.31.89.171
  端口:          8080/TCP,8443/TCP

[数据面 Pod - internal-gateway-nginx]
  internal-gateway-nginx-5d47866bb6-gfb8t            worker4.z2.ameidc2.com       10.225.56.8        true
  internal-gateway-nginx-5d47866bb6-mtchf            worker4.z2.ameidc2.com       10.225.56.6        true
  internal-gateway-nginx-5d47866bb6-slzq9            worker6.z2.ameidc2.com       10.225.73.108      true
  数据面 Pod 节点分布:
    worker4.z2.ameidc2.com: 2
    worker6.z2.ameidc2.com: 1

[HTTPRoute 关联的后端 Service / Pod]
  HTTPRoute: hytera-mcs01-trust-ruh/cdwgw-internal-route
    backendRef: hytera-mcs01-trust-ruh/cdwgw:8080
  后端 Service: hytera-mcs01-trust-ruh/cdwgw
    cdwgw-6979f954f9-lkbdt   worker2.z2.ameidc2.com   10.225.40.34   true
    cdwgw-6979f954f9-r74x8   worker3.z2.ameidc2.com   10.225.24.252   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/dms-internal-route
    backendRef: hytera-mcs01-trust-ruh/dms:8080
  后端 Service: hytera-mcs01-trust-ruh/dms
    dms-363-7f67c4ff9-rwlrk   worker2.z2.ameidc2.com   10.225.40.20   true
    dms-396-6f569d6c94-2v4vb   worker3.z2.ameidc2.com   10.225.25.14   true
    dms-429-cbf646f64-vvs5g   worker2.z2.ameidc2.com   10.225.40.40   true
  后端 Pod 节点分布:
    worker2.z2.ameidc2.com: 2
    worker3.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/dui-internal-route
    backendRef: hytera-mcs01-trust-ruh/dui:8080
  后端 Service: hytera-mcs01-trust-ruh/dui
    dui-78d954d47d-gzh9r   worker1.z2.ameidc2.com   10.225.32.11   true
    dui-78d954d47d-j2whj   worker3.z2.ameidc2.com   10.225.25.75   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker1.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/embms-internal-route
    backendRef: hytera-mcs01-trust-ruh/embms:8080
  后端 Service: hytera-mcs01-trust-ruh/embms
    embms-0   worker3.z2.ameidc2.com   10.225.25.24   true
    embms-1   worker2.z2.ameidc2.com   10.225.40.60   true
    embms-2   worker3.z2.ameidc2.com   10.225.25.70   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 2
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/frs-internal-route
    backendRef: hytera-mcs01-trust-ruh/frs:8080
  后端 Service: hytera-mcs01-trust-ruh/frs
    frs-627-598865c786-xlh2j   worker2.z2.ameidc2.com   10.225.40.26   true
    frs-660-6d899f4f5b-ksgwt   worker3.z2.ameidc2.com   10.225.25.60   true
    frs-693-cc5c84d5f-2dcz8   worker2.z2.ameidc2.com   10.225.40.38   true
  后端 Pod 节点分布:
    worker2.z2.ameidc2.com: 2
    worker3.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/idms-internal-route
    backendRef: hytera-mcs01-trust-ruh/idms:8080
  后端 Service: hytera-mcs01-trust-ruh/idms
    idms-0   worker3.z2.ameidc2.com   10.225.25.32   true
    idms-1   worker2.z2.ameidc2.com   10.225.40.68   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/kms-internal-route
    backendRef: hytera-mcs01-trust-ruh/kms:8080
  后端 Service: hytera-mcs01-trust-ruh/kms
    kms-0   worker3.z2.ameidc2.com   10.225.25.9   true
    kms-1   worker2.z2.ameidc2.com   10.225.40.49   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/n5i-internal-route
    backendRef: hytera-mcs01-trust-ruh/n5i:8080
  后端 Service: hytera-mcs01-trust-ruh/n5i
    n5i-0   worker3.z2.ameidc2.com   10.225.25.1   true
    n5i-1   worker2.z2.ameidc2.com   10.225.40.59   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/ums-internal-route
    backendRef: hytera-mcs01-trust-ruh/ums:8080
  后端 Service: hytera-mcs01-trust-ruh/ums
    ums-0   worker2.z2.ameidc2.com   10.225.40.43   true
    ums-1   worker3.z2.ameidc2.com   10.225.25.18   true
    ums-2   worker2.z2.ameidc2.com   10.225.40.57   true
    ums-3   worker2.z2.ameidc2.com   10.225.40.69   true
    ums-4   worker3.z2.ameidc2.com   10.225.25.19   true
    ums-5   worker3.z2.ameidc2.com   10.225.25.66   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 3
    worker2.z2.ameidc2.com: 3

  HTTPRoute: hytera-mcs01-trust-ruh/wscf-internal-route
    backendRef: hytera-mcs01-trust-ruh/wscf:8080
  后端 Service: hytera-mcs01-trust-ruh/wscf
    wscf-0   worker2.z2.ameidc2.com   10.225.40.54   true
    wscf-1   worker3.z2.ameidc2.com   10.225.25.6   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/ahs-internal-route
    backendRef: hytera-mrps01-trust-ruh/ahs:8080
  后端 Service: hytera-mrps01-trust-ruh/ahs
    ahs-0   worker5.z2.ameidc2.com   10.225.65.187   true
    ahs-1   worker5.z2.ameidc2.com   10.225.65.149   true
    ahs-2   worker6.z2.ameidc2.com   10.225.73.126   true
  后端 Pod 节点分布:
    worker5.z2.ameidc2.com: 2
    worker6.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/cdwgw-internal-route
    backendRef: hytera-mrps01-trust-ruh/cdwgw:8080
  后端 Service: hytera-mrps01-trust-ruh/cdwgw
    cdwgw-d96b469dc-nmx5t   worker6.z2.ameidc2.com   10.225.73.178   true
    cdwgw-d96b469dc-xkvn8   worker4.z2.ameidc2.com   10.225.56.21   true
  后端 Pod 节点分布:
    worker6.z2.ameidc2.com: 1
    worker4.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/idms-internal-route
    backendRef: hytera-mrps01-trust-ruh/idms:8080
  后端 Service: hytera-mrps01-trust-ruh/idms
    idms-68121-7dd4cfbf4c-75njq   worker5.z2.ameidc2.com   10.225.65.179   true
    idms-68154-7d5c445979-wpw6x   worker6.z2.ameidc2.com   10.225.73.149   true
  后端 Pod 节点分布:
    worker6.z2.ameidc2.com: 1
    worker5.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/mrpsui-internal-route
    backendRef: hytera-mrps01-trust-ruh/mrpsui:8080
  后端 Service: hytera-mrps01-trust-ruh/mrpsui
    mrpsui-6bbb4f7696-pq652   worker5.z2.ameidc2.com   10.225.65.167   true
  后端 Pod 节点分布:
    worker5.z2.ameidc2.com: 1

  HTTPRoute: hytera-ysp01-trust-ruh/dp-inspect-internal-route
    backendRef: hytera-ysp01-trust-ruh/dp-inspect:8080
  后端 Service: hytera-ysp01-trust-ruh/dp-inspect
    dp-inspect-5647984f7d-xgpgb   worker7.z2.ameidc2.com   10.225.49.0   true
  后端 Pod 节点分布:
    worker7.z2.ameidc2.com: 1

  HTTPRoute: hytera-ysp01-trust-ruh/gui-internal-route
    backendRef: hytera-ysp01-trust-ruh/gui:8080
  后端 Service: hytera-ysp01-trust-ruh/gui
    gui-7c464b85f8-s7c56   worker1.z2.ameidc2.com   10.225.32.24   true
  后端 Pod 节点分布:
    worker1.z2.ameidc2.com: 1

================================================================
Gateway Service: hytera-nginx-gateway-trust-ruh/mgt-gateway-nginx
  Gateway CR 名: mgt-gateway
  MetalLB VIP:   10.161.35.113
  ClusterIP:     172.31.176.64
  端口:          8080/TCP,8443/TCP

[数据面 Pod - mgt-gateway-nginx]
  mgt-gateway-nginx-744479dcbb-46kfl                 worker6.z2.ameidc2.com       10.225.73.109      true
  mgt-gateway-nginx-744479dcbb-8kpdt                 worker4.z2.ameidc2.com       10.225.56.5        true
  mgt-gateway-nginx-744479dcbb-h65lv                 worker6.z2.ameidc2.com       10.225.73.168      true
  数据面 Pod 节点分布:
    worker6.z2.ameidc2.com: 2
    worker4.z2.ameidc2.com: 1

[HTTPRoute 关联的后端 Service / Pod]
  HTTPRoute: hytera-mcs01-trust-ruh/cdwgw-nms-route
    backendRef: hytera-mcs01-trust-ruh/cdwgw:8080
  后端 Service: hytera-mcs01-trust-ruh/cdwgw
    cdwgw-6979f954f9-lkbdt   worker2.z2.ameidc2.com   10.225.40.34   true
    cdwgw-6979f954f9-r74x8   worker3.z2.ameidc2.com   10.225.24.252   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 1
    worker2.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/dms-nms-route
    backendRef: hytera-mcs01-trust-ruh/dms:8080
  后端 Service: hytera-mcs01-trust-ruh/dms
    dms-363-7f67c4ff9-rwlrk   worker2.z2.ameidc2.com   10.225.40.20   true
    dms-396-6f569d6c94-2v4vb   worker3.z2.ameidc2.com   10.225.25.14   true
    dms-429-cbf646f64-vvs5g   worker2.z2.ameidc2.com   10.225.40.40   true
  后端 Pod 节点分布:
    worker2.z2.ameidc2.com: 2
    worker3.z2.ameidc2.com: 1

  HTTPRoute: hytera-mcs01-trust-ruh/ums-nms-route
    backendRef: hytera-mcs01-trust-ruh/ums:8080
  后端 Service: hytera-mcs01-trust-ruh/ums
    ums-0   worker2.z2.ameidc2.com   10.225.40.43   true
    ums-1   worker3.z2.ameidc2.com   10.225.25.18   true
    ums-2   worker2.z2.ameidc2.com   10.225.40.57   true
    ums-3   worker2.z2.ameidc2.com   10.225.40.69   true
    ums-4   worker3.z2.ameidc2.com   10.225.25.19   true
    ums-5   worker3.z2.ameidc2.com   10.225.25.66   true
  后端 Pod 节点分布:
    worker3.z2.ameidc2.com: 3
    worker2.z2.ameidc2.com: 3

  HTTPRoute: hytera-mrps01-trust-ruh/ahs-nms-route
    backendRef: hytera-mrps01-trust-ruh/ahs:8080
  后端 Service: hytera-mrps01-trust-ruh/ahs
    ahs-0   worker5.z2.ameidc2.com   10.225.65.187   true
    ahs-1   worker5.z2.ameidc2.com   10.225.65.149   true
    ahs-2   worker6.z2.ameidc2.com   10.225.73.126   true
  后端 Pod 节点分布:
    worker5.z2.ameidc2.com: 2
    worker6.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/cdwgw-nms-route
    backendRef: hytera-mrps01-trust-ruh/cdwgw:8080
  后端 Service: hytera-mrps01-trust-ruh/cdwgw
    cdwgw-d96b469dc-nmx5t   worker6.z2.ameidc2.com   10.225.73.178   true
    cdwgw-d96b469dc-xkvn8   worker4.z2.ameidc2.com   10.225.56.21   true
  后端 Pod 节点分布:
    worker6.z2.ameidc2.com: 1
    worker4.z2.ameidc2.com: 1

  HTTPRoute: hytera-mrps01-trust-ruh/idms-nms-route
    backendRef: hytera-mrps01-trust-ruh/idms:8080
  后端 Service: hytera-mrps01-trust-ruh/idms
    idms-68121-7dd4cfbf4c-75njq   worker5.z2.ameidc2.com   10.225.65.179   true
    idms-68154-7d5c445979-wpw6x   worker6.z2.ameidc2.com   10.225.73.149   true
  后端 Pod 节点分布:
    worker6.z2.ameidc2.com: 1
    worker5.z2.ameidc2.com: 1

  HTTPRoute: hytera-ysp01-trust-ruh/dp-inspect-nms-route
    backendRef: hytera-ysp01-trust-ruh/dp-inspect:8080
  后端 Service: hytera-ysp01-trust-ruh/dp-inspect
    dp-inspect-5647984f7d-xgpgb   worker7.z2.ameidc2.com   10.225.49.0   true
  后端 Pod 节点分布:
    worker7.z2.ameidc2.com: 1

  HTTPRoute: hytera-ysp01-trust-ruh/gui-nms-route
    backendRef: hytera-ysp01-trust-ruh/gui:8080
  后端 Service: hytera-ysp01-trust-ruh/gui
    gui-7c464b85f8-s7c56   worker1.z2.ameidc2.com   10.225.32.24   true
  后端 Pod 节点分布:
    worker1.z2.ameidc2.com: 1

>>> 7.3 Pod NAD IP 统计 (命名空间: hytera-nginx-gateway-trust-ruh):
NAMESPACE  POD  NODE  NAD  INTERFACE  IP

>>> 7.4 LoadBalancer VIP (命名空间: hytera-nginx-gateway-trust-ruh):
--- namespace: hytera-nginx-gateway-trust-ruh ---
NAME                     TYPE           CLUSTER-IP       EXTERNAL-IP     PORT(S)                         AGE     SELECTOR
external-gateway-nginx   LoadBalancer   172.31.132.112   10.161.33.65    8080:31086/TCP,8443:30965/TCP   5d10h   app.kubernetes.io/instance=hytera-nginx-gateway-fabric,app.kubernetes.io/managed-by=hytera-nginx-gateway-fabric-nginx,app.kubernetes.io/name=external-gateway-nginx,gateway.networking.k8s.io/gateway-name=external-gateway
internal-gateway-nginx   LoadBalancer   172.31.89.171    10.161.44.65    8080:30167/TCP,8443:31396/TCP   5d10h   app.kubernetes.io/instance=hytera-nginx-gateway-fabric,app.kubernetes.io/managed-by=hytera-nginx-gateway-fabric-nginx,app.kubernetes.io/name=internal-gateway-nginx,gateway.networking.k8s.io/gateway-name=internal-gateway
mgt-gateway-nginx        LoadBalancer   172.31.176.64    10.161.35.113   8080:30865/TCP,8443:32733/TCP   5d10h   app.kubernetes.io/instance=hytera-nginx-gateway-fabric,app.kubernetes.io/managed-by=hytera-nginx-gateway-fabric-nginx,app.kubernetes.io/name=mgt-gateway-nginx,gateway.networking.k8s.io/gateway-name=mgt-gateway

>>> 8. BGP 会话状态和路由 (从每个 Speaker 的 FRR 容器获取):
--------------- Speaker Pod: metallb-speaker-8fqq5 ---------------
所在节点: worker2.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

--------------- Speaker Pod: metallb-speaker-d7xm7 ---------------
所在节点: worker7.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

--------------- Speaker Pod: metallb-speaker-r67wm ---------------
所在节点: worker3.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

--------------- Speaker Pod: metallb-speaker-shh28 ---------------
所在节点: worker4.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

--------------- Speaker Pod: metallb-speaker-tgnw4 ---------------
所在节点: worker5.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

--------------- Speaker Pod: metallb-speaker-tv72m ---------------
所在节点: worker1.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

--------------- Speaker Pod: metallb-speaker-v7xvn ---------------
所在节点: worker6.z2.ameidc2.com
--- BGP Summary ---
% BGP instance not found
--- BGP 路由表 (IPv4 Unicast) ---
Default BGP instance not found
--- BGP 邻居发送的路由 ---
未找到 BGP 邻居

>>> 9. 节点上抓包检查建议 (如需手动测试):
在 worker 节点上执行: sudo tcpdump -i br-ex host <VIP> and port 8443 -n

>>> 10. 节点 NAT 表 (需在对应 worker 上执行):
sudo iptables -t nat -L -n -v

>>> 11. 路由器侧检查建议:
   - 确认 BGP 邻居: show bgp peer <worker br-ex IP>
   - 确认 VIP 路由: show ip route <MetalLB VIP>
   - 确认 ECMP: show ip routing-table protocol bgp

==========================================
检查完成
```



### 排查BGP是否正常
```bash
 METALLB_NS="metallb-system"
[ysp-dc3@localhost ~]$ kubectl get pods -n $METALLB_NS -o wide
NAME                                  READY   STATUS    RESTARTS   AGE     IP              NODE                     NOMINATED NODE   READINESS GATES
metallb-controller-65dd57d79f-qm84v   1/1     Running   0          5d15h   10.226.24.32    worker3.z3.ameidc3.com   <none>           <none>
metallb-speaker-drrzm                 4/4     Running   0          93m     10.161.43.155   worker2.z3.ameidc3.com   <none>           <none>
metallb-speaker-lqzfz                 4/4     Running   0          19h     10.161.43.154   worker1.z3.ameidc3.com   <none>           <none>
metallb-speaker-xj6qq                 4/4     Running   0          19h     10.161.43.156   worker3.z3.ameidc3.com   <none>           <none>
[ysp-dc3@localhost ~]$ kubectl exec -n metallb-system metallb-speaker-drrzm -c frr -- vtysh -c "show bgp neighbors 10.161.43.6"
BGP neighbor is 10.161.43.6, remote AS 65520, local AS 65580, external link
  Local Role: undefined
  Remote Role: undefined
  BGP version 4, remote router ID 10.161.41.253, local router ID 10.226.32.2
  BGP state = Established, up for 00:31:03
  Last read 00:00:03, Last write 00:00:03
  Hold time is 180 seconds, keepalive interval is 60 seconds
  Configured hold time is 180 seconds, keepalive interval is 60 seconds
  Configured tcp-mss is 0, synced tcp-mss is 1460
  Configured conditional advertisements interval is 60 seconds
  Neighbor capabilities:
    4 Byte AS: advertised and received
    Extended Message: advertised
    AddPath:
      IPv4 Unicast: RX advertised
    Long-lived Graceful Restart: advertised
    Route refresh: advertised and received
    Enhanced Route Refresh: advertised
    Address Family IPv4 Unicast: advertised and received
    Hostname Capability: advertised (name: worker2.z3.ameidc3.com,domain name: n/a) not received
    Version Capability: not advertised not received
    Graceful Restart Capability: advertised
  Graceful restart information:
    Local GR Mode: Helper*
    Remote GR Mode: Disable
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
    Opens:                  1          1
    Notifications:          0          0
    Updates:                1         23
    Keepalives:            32         32
    Route Refresh:          1          0
    Capability:             0          0
    Total:                 35         56
  Minimum time between advertisement runs is 0 seconds
 For address family: IPv4 Unicast
  Update group 5, subgroup 5
  Packet Queue length 0
  Community attribute sent to this neighbor(all)
  Inbound path policy configured
  Outbound path policy configured
  Route map for incoming advertisements is *10.161.43.6-in
  Route map for outgoing advertisements is *10.161.43.6-out
  0 accepted prefixes
  Connections established 1; dropped 0
  Last reset 00:31:07,   Waiting for peer OPEN (n/a)
  External BGP neighbor may be up to 1 hops away.
Local host: 10.161.43.155, Local port: 51702
Foreign host: 10.161.43.6, Foreign port: 179
Nexthop: 10.161.43.155
Nexthop global: ::
Nexthop local: ::
BGP connection: shared network
BGP Connect Retry Timer in Seconds: 120
Estimated round trip time: 77 ms
Read thread: on  Write thread: on  FD used: 22
[ysp-dc3@localhost ~]$
```


以下是针对 两个BGP邻居、每个AS有3个节点 的完整网络拓扑图，覆盖 外网用户访问集群服务（入站） 与 集群Pod主动访问外网（出站） 两个场景，并包含防火墙、交换机、路由器等设备。


一、拓扑总览（ASCII 字符画）
```bash

                                 ┌─────────────────────────────────────────┐
                                 │               Internet                   │
                                 └───────────────┬─────────────────────────┘
                                                 │
                                                 │ 公网 IP: 203.0.113.10 (服务入口)
                                                 │
                                         ┌───────┴───────┐
                                         │   防火墙(FW)   │
                                         │  - DNAT规则   │
                                         │  - 出站SNAT   │
                                         │  - 安全策略   │
                                         └───────┬───────┘
                                                 │
                      ┌──────────────────────────┼──────────────────────────┐
                      │                          │                          │
                      │ (内网侧: 10.0.0.0/24)     │                          │
                      │                          │                          │
              ┌───────┴───────┐          ┌───────┴───────┐          ┌───────┴───────┐
              │  Router A     │          │   Switch      │          │  Router B     │
              │  AS 64501     │◄────────►│ (L2/L3核心)   │◄────────►│  AS 64502     │
              │ 10.0.0.1/24   │          │ 10.0.0.254/24 │          │ 10.0.0.2/24   │
              │ BGP Peer地址  │          │ (网关)        │          │ BGP Peer地址  │
              │ 10.0.0.1      │          └───────┬───────┘          │ 10.0.0.2      │
              └───────┬───────┘                  │                  └───────┬───────┘
                      │                          │                          │
                      │ eBGP会话                 │                          │ eBGP会话
                      │ (TCP 179)                │                          │ (TCP 179)
                      │                          │                          │
              ┌───────┴───────┐         ┌────────┴────────┐         ┌───────┴───────┐
              │   Node1       │         │    Node2        │         │   Node3       │
              │ 10.0.0.11     │         │  10.0.0.12      │         │ 10.0.0.13     │
              │ AS 64500      │         │  AS 64500       │         │ AS 64500      │
              │ ┌───────────┐ │         │ ┌────────────┐  │         │ ┌───────────┐ │
              │ │ MetalLB   │ │         │ │ MetalLB    │  │         │ │ MetalLB   │ │
              │ │ Speaker   │ │         │ │ Speaker    │  │         │ │ Speaker   │ │
              │ └───────────┘ │         │ └────────────┘  │         │ └───────────┘ │
              │               │         │                 │         │               │
              │ ┌───────────┐ │         │ ┌────────────┐  │         │ ┌───────────┐ │
              │ │ Pod       │ │         │ │ Pod        │  │         │ │ Pod       │ │
              │ │ (ums/kms) │ │         │ │ (ums/kms)  │  │         │ │ (ums/kms) │ │
              │ └───────────┘ │         │ └────────────┘  │         │ └───────────┘ │
              └───────────────┘         └─────────────────┘         └───────────────┘

```

>图例说明

>1. Router A / B：企业边缘路由器，与 MetalLB 建立 eBGP 会话，接收服务 VIP 路由。
>2.Switch：核心交换机，提供集群内部及节点到路由器的二层连通性（也可承担三层网关功能）。
>3.防火墙：连接互联网与内部网络，执行 DNAT（入站）和 SNAT（出站）。
>4.K8s 节点：运行 MetalLB Speaker（FRR）和业务 Pod。


##  二、入站流量：外网用户访问集群内 LoadBalancer 服务
### 2.1 流量路径图

```bash
  外网用户 (客户端)
       │
       │ 访问 https://service.example.com (公网IP 203.0.113.10:16211)
       v
   ┌─────────────────┐
   │     防火墙       │
   │ DNAT:           │
   │ 203.0.113.10:16211 → 192.168.10.100:8443
   │ (保留原始源IP可选)│
   └────────┬────────┘
            │ 内网目的IP: 192.168.10.100:8443
            v
   ┌─────────────────────────────────────┐
   │       核心交换机                     │
   │ 路由表：192.168.10.0/24 下一跳？      │
   │ 实际上通过BGP路由器转发               │
   └────────┬────────────────────────────┘
            │
            v
   ┌──────────────────────────────────────────────────────────────┐
   │  Router A (AS64501) / Router B (AS64502)                     │
   │  从MetalLB收到BGP路由：                                       │
   │  192.168.10.100/32 → 下一跳 10.0.0.11, 10.0.0.12, 10.0.0.13   │
   │  ECMP开启，哈希选择其中一个下一跳                               │
   └────────┬─────────────────────────────────────────────────────┘
            │ 例如选中 Node2 (10.0.0.12)
            v
   ┌─────────────────┐
   │     Node2       │
   │  iptables/IPVS  │
   │  转发至 Service │
   │  Cluster IP     │
   └────────┬────────┘
            │
            v
   ┌─────────────────┐
   │   Pod (UMS)     │
   │   处理请求并返回 │
   └─────────────────┘

```

### 2.2 关键配置要点

| 组件                           | 配置                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| **MetalLB IPAddressPool**    | `192.168.10.0/24`，分配给 Service 的 VIP 为 `192.168.10.100`                                                  |
| **MetalLB BGPPeer**          | 两个：  <br>- peerAddress `10.0.0.1` (Router A, AS64501)  <br>- peerAddress `10.0.0.2` (Router B, AS64502) |
| **MetalLB BGPAdvertisement** | 将 `192.168.10.100/32` 通告给两个邻居，`aggregationLength: 32`                                                   |
| **路由器 ECMP**                 | 开启，保证多下一跳负载均衡                                                                                           |
| **防火墙 DNAT**                 | `203.0.113.10:16211` → `192.168.10.100:8443`；  <br>`203.0.113.10:16210` → `192.168.10.100:8080`         |
| **Service**                  | `type: LoadBalancer`，自动获得 `192.168.10.100`                                                              |

## 三、出站流量：集群内 Pod 主动访问外网
### 3.1 流量路径图
```bash
   ┌─────────────────────────────┐
   │   Pod (UMS)                 │
   │  curl api.github.com        │
   │  源IP: Pod IP (10.244.x.x)  │
   └────────┬────────────────────┘
            │
            v
   ┌─────────────────┐
   │   Node2         │
   │  网络命名空间    │
   │  iptables SNAT  │
   │  源IP改为节点IP  │
   │  (10.0.0.12)    │
   └────────┬────────┘
            │
            v
   ┌─────────────────┐
   │  核心交换机      │
   └────────┬────────┘
            │
            v
   ┌─────────────────┐
   │  Router A/B     │
   │ 根据目的路由     │
   │ 转发至防火墙     │
   └────────┬────────┘
            │
            v
   ┌─────────────────┐
   │    防火墙        │
   │  源NAT (SNAT)   │
   │  将10.0.0.12    │
   │  转换为公网IP    │
   │  203.0.113.10   │
   └────────┬────────┘
            │
            v
   ┌─────────────────┐
   │   Internet      │
   │  api.github.com │
   └─────────────────┘
```

### 3.2 关键配置要点

|组件|配置|
|---|---|
|**节点 iptables**|Kubernetes 默认 Masquerade 规则，Pod 访问外部时 SNAT 为节点 IP|
|**路由器**|普通转发，无需特殊 BGP 配置（但需要路由表有默认路由指向防火墙）|
|**防火墙 SNAT**|将内网节点 IP 段（10.0.0.0/24）转换为公网 IP（203.0.113.10）|
|**安全策略**|允许 Pod 访问外网特定目的（如 HTTPS 443），并允许返回流量|


## 四、BGP 会话细节（两个邻居）
```bash
┌─────────────────────────────────────────────────────────────────┐
│                      BGP 对等关系                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Node1 (10.0.0.11, AS64500)                                     │
│    ├── eBGP ──► Router A (10.0.0.1, AS64501)                    │
│    └── eBGP ──► Router B (10.0.0.2, AS64502)                    │
│                                                                 │
│  Node2 (10.0.0.12, AS64500)                                     │
│    ├── eBGP ──► Router A (10.0.0.1, AS64501)                    │
│    └── eBGP ──► Router B (10.0.0.2, AS64502)                    │
│                                                                 │
│  Node3 (10.0.0.13, AS64500)                                     │
│    ├── eBGP ──► Router A (10.0.0.1, AS64501)                    │
│    └── eBGP ──► Router B (10.0.0.2, AS64502)                    │
│                                                                 │
│  每个 Speaker 维护两条 BGP 会话（共 6 条会话）                    │
│  路由器收到的路由：192.168.10.100/32 具有三个等价的下一跳          │
└─────────────────────────────────────────────────────────────────┘

# 以上topo等同于
Node1 10.0.0.11  AS64500
Node2 10.0.0.12  AS64500
Node3 10.0.0.13  AS64500
        │
        ├── eBGP ──► Router A 10.0.0.1  AS64501
        └── eBGP ──► Router B 10.0.0.2  AS64502

```

- 集群侧统一用 **AS 64500**
- Router A / Router B 是不同 AS（64501 / 64502）
- 3 个节点 × 2 个路由器 = **6 条 eBGP 会话**
- Service VIP 比如 `192.168.10.100`
- MetalLB 每个节点都通告：`192.168.10.100/32 via 本节点IP`
- 路由器收到 3 个等价下一跳 → **ECMP**


### MetalLB 配置文件示例 (部分)：
1️⃣ BGPPeer：告诉 speaker 和谁建 BGP
```yaml
# BGPPeer for Router A
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: router-a
  namespace: metallb-system
spec:
  myASN: 64500
  peerASN: 64501
  peerAddress: 10.0.0.1
  # 默认情况下所有节点都需要和 A/B 建邻 因此这里的nodeselect可以不写
#  nodeSelectors:
#    - matchLabels:
#     kubernetes.io/hostname: node1
---
# BGPPeer for Router B
apiVersion: metallb.io/v1beta2
kind: BGPPeer
metadata:
  name: router-b
  namespace: metallb-system
spec:
  myASN: 64500
  peerASN: 64502
  peerAddress: 10.0.0.2
```

## 五、高可用与冗余设计
- 路由器冗余：两个路由器独立，任何一台故障不影响服务（仍有一台可转发流量）。
- 节点冗余：MetalLB 通过 BGP 同时通告三个节点的路由，任一节点故障后，路由器自动从路由表中移除该下一跳（BGP 会话中断或路由撤销），流量继续由剩余节点处理。
- 防火墙冗余：生产环境通常部署主备或双活防火墙，此处为简化只绘一台。

## 六、总结
本拓扑完整展示了：

1. 两个 BGP 邻居 与 Kubernetes 集群节点建立 eBGP 会话。
2. 入站：外网用户 → 防火墙 DNAT → 路由器（ECMP 负载均衡）→ 节点 → Service → Pod。
3. 出站：Pod → 节点 SNAT → 路由器 → 防火墙 SNAT → 互联网。
4. 关键设备：防火墙、核心交换机、BGP 路由器均清晰标注。

此架构充分利用 BGP 多路径实现入站负载均衡，同时通过 SNAT 解决出站访问问题，适合生产级裸机 Kubernetes 集群。