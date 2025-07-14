


## 设置

### 支持的数据库
grafana需要一个数据库来存储其配置数据，例如用户、数据源和仪表盘
Grafana 支持以下数据库：
- [SQLite 3](https://www.sqlite.org/index.html)
- [MySQL 8.0+](https://www.mysql.com/support/supportedplatforms/database.html)
- [PostgreSQL 12+](https://www.postgresql.org/support/versioning/)
默认情况下，Grafana 使用嵌入式 SQLite 数据库，该数据库存储在 Grafana 安装位置。