






- 使用service将数据导出到外部
使用场景：内部service需要再外部进行调试

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dp-proxy
  namespace: base-services
spec:
  ports:
    - protocol: TCP
      port: 11090  # 服务暴露的端口，可以与 Endpoints 端口相同或不同
      targetPort: 11090  # 这里指向 Endpoints 中的端口
  type: ClusterIP  # 默认类型，适用于内部访问


---
apiVersion: v1
kind: Endpoints
metadata:
  name: dp-proxy
  namespace: base-services
subsets:
  - addresses:
      - ip: 192.168.38.31   # 外部服务的IP
    ports:
      - port: 11090         # 外部服务的端口
```