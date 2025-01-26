


- 双 prometheus


```yaml
services:
  prometheus1:
    image: prom/prometheus
    container_name: prometheus1
    volumes:
      - ./yaml/prometheus1/:/etc/prometheus/
      - ./yaml/prometheus/rules/:/etc/prometheus/rules/
    ports:
      - "9091:9090"

  prometheus2:
    image: prom/prometheus
    container_name: prometheus2
    volumes:
      - ./yaml/prometheus2/:/etc/prometheus/
      - ./yaml/prometheus/rules/:/etc/prometheus/rules/
    ports:
      - "9092:9090"

```

