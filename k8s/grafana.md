


## 设置

### 支持的数据库
grafana需要一个数据库来存储其配置数据，例如用户、数据源和仪表盘
Grafana 支持以下数据库：
- [SQLite 3](https://www.sqlite.org/index.html)
- [MySQL 8.0+](https://www.mysql.com/support/supportedplatforms/database.html)
- [PostgreSQL 12+](https://www.postgresql.org/support/versioning/)
默认情况下，Grafana 使用嵌入式 SQLite 数据库，该数据库存储在 Grafana 安装位置。

### 日志级别
默认情况下grafana日志级别是 `info` 
```ini
[log]
; # Either "debug", "info", "warn", "error", "critical", default is "info"
; # we change from info to debug level
level = debug
```

```bash
kubectl create configmap ge-config --from-file=/path/to/file/grafana.ini --namespace=my-grafana
```

### `ini` 配置
。 grafana使用 `;`注释配置，如果想要注释掉某个配置，只需要在其前添加上`;`
```ini
;http_port = 3000
```

### 使用环境变量覆盖配置
其中 _`<SECTION NAME>`_ 是配置文件中方括号（ `[` 和 `]` ）内的文本。所有字母必须大写，句点 ( `.` ) 和破折号 ( `-` ) 必须替换为下划线 ( `_` )。
```bash
GF_<SECTION NAME>_<KEY>
```
加入有如下 `ini` 配置
```ini
# default section
instance_name = ${HOSTNAME}

[security]
admin_user = admin

[auth.google]
client_secret = 0ldS3cretKey

[plugin.grafana-image-renderer]
rendering_ignore_https_errors = true

[feature_toggles]
enable = newNavigation
```
替换成环境变量之后
```bash
export GF_DEFAULT_INSTANCE_NAME=my-instance
export GF_SECURITY_ADMIN_USER=owner
export GF_AUTH_GOOGLE_CLIENT_SECRET=newS3cretKey
export GF_PLUGIN_GRAFANA_IMAGE_RENDERER_RENDERING_IGNORE_HTTPS_ERRORS=true
export GF_FEATURE_TOGGLES_ENABLE=newNavigation
```

### 变量扩展
如果您的任何选项包含表达式 `$__<PROVIDER>{<ARGUMENT>}` 或 `${<ENVIRONMENT VARIABLE>}` ，Grafana 会对其进行求值。求值过程会使用提供的参数运行提供程序，以获取该选项的最终值。
`PROVIDER` 有三种类型： `env`、`file`和`vault`

#### `env provider`
`env provider` 可以用来扩展环境变量，如果将某个选项设置为 `$__env{PORT}` grafana将会使用`PORT`环境变量替换它。如果在环境变量里面配置你可以简写为 `${PORT}`

```ini
[paths]
logs = $__env{LOGDIR}/grafana
```

#### `file provider`
`file provider` 从指定文件中读取文件内容，并剔除文件开头和结尾的空格
```ini
[database]
; 从/etc/secrets/gf_sql_password读取内容，剔除开头和结尾空格，然后将内容赋值给password
password = $__file{/etc/secrets/gf_sql_password}
```

#### `vault provider`
`vault provider` 允许你使用hashicorp vault管理你的 `secrets`
> `vault provider` 仅在 Grafana Enterprise 中可用

### 配置项

#### `instance_name``
设置 Grafana 服务器实例的名称。用于日志记录、内部指标和集群信息。默认值为： `${HOSTNAME}` ，使用环境变量 `HOSTNAME` 的值。如果该变量为空或不存在，Grafana 会尝试使用系统调用来获取机器名称。

#### `[paths]`
- `data`
此路径通常通过 init.d 脚本或 systemd 服务文件中的命令行指定，用于存储sqlite3数据库和基于文件的会话和其他数据的路径
- `temp_data_lifetime`
`data` 目录中的临时图像应保留多长时间。默认值为： `24h` 。支持的修饰符： `h` （小时）。 `m` （分钟），例如： `168h` 、 `30m` 、 `10h30m` 。使用 `0` 表示从不清理临时文件。

-  `logs`
Grafana 存储日志的路径。此路径通常通过 init.d 脚本或 systemd 服务文件中的命令行指定。您可以在配置文件或默认环境变量文件中覆盖它。

- `plugins`
Grafana 自动扫描并查找插件的目录

- `provisioning`
包含 Grafana 启动时应用的[预配](https://grafana.com/docs/grafana/latest/administration/provisioning/)配置文件的目录。

#### `[server]`
-  `protocol`
`http` 、 `https` 、 `h2` 或 `socket`
- `min_tls_version`
TLS 握手需要最低 TLS 版本。可用选项为 TLS 1.2 和 TLS 1.3。如果您未指定版本，系统将使用 TLS 1.2。
- `http_addr`
默认 `0.0.0.0`
- `http_port`
绑定的端口默认为 `3000` 。要使用端口 80 ，您需要授予 Grafana 权限
```bash
sudo setcap 'cap_net_bind_service=+ep' /usr/sbin/grafana-server
```
或者使用以下命令将端口 80 重定向到 Grafana 端口
```bash
# grafana监听3000端口，但是浏览器可以访问80端口，访问80端口服务器会把对应的端口重定向到3000端口
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```
- `domain`
此设置仅作为 `root_url` 设置的一部分使用（见下文）。如果您使用 GitHub 或 Google OAuth，则此设置非常重要。
- `enforce_domain`
如果主机头与域名不匹配，则重定向到正确的域名。防止 DNS 重绑定攻击。默认值为 `false` 。
- `root_url`
这是用于从 Web 浏览器访问 Grafana 的完整 URL。如果您使用 Google 或 GitHub OAuth 身份验证，这一点很重要（以确保回调 URL 正确）。
>如果您在 Grafana 前面有一个通过子路径公开它的反向代理，则此设置也很重要。
在这种情况下，请将子路径添加到此 URL 设置的末尾。

- `serve_from_sub_path`
是否使能，通过 `root_url` 设置中指定的子路径来提供 Grafana 服务
启用此设置并在 `root_url` 中使用子路径（例如 `root_url = http://localhost:3000/grafana` ），即可通过 `http://localhost:3000/grafana` 访问 Grafana。如果访问时不使用子路径，Grafana 会将请求重定向到子路径。

- `router_logging`
类似gin的打屏日志，记录所有进来的http请求(不仅仅是错误请求)
 `static_root_path`
 前端文件（HTML、JS 和 CSS 文件）所在目录的路径。默认为 `public`

-  `enable_gzip`
提高传输效率，默认false
- `cert_file`
证书文件的路径（如果 `protocol` 设置为 `https` 或 `h2` ）
- `cert_key`
证书密钥文件的路径（如果 `protocol` 设置为 `https` 或 `h2` ）
- `cert_pass`
可选。解密加密证书的密码
- `certs_watch_interval`
控制是否定期监视 `cert_key` 和 `cert_file` 的更改。默认禁用。启用后， `cert_key` 和 `cert_file` 监视证书是否发生变化。如果有变化，则会自动加载新的证书。
 - `socket_gid`
 当 `protocol=socket` 时，套接字应设置的 GID。更改此设置之前，请确保目标组位于 Grafana 进程所属组中，并且 Grafana 进程是文件所有者。建议将 GID 设置为 HTTP 服务器用户 GID。值为 `-1` 时无需设置
- `socket_mode`
当 `protocol=socket` 时应设置套接字的模式。在更改此设置之前，请确保 Grafana 进程是文件所有者。
- `socket`
当 `protocol=socket` 时应创建套接字的路径。在更改此设置之前，请确保 Grafana 对该路径具有适当的权限。
- `cdn_url`
指定 Grafana CDN 资源根目录的完整 HTTP URL 地址。Grafana 会添加版本号和版本路径。
例如，给定一个 CDN URL，如 `https://cdn.myserver.com` ，Grafana 会尝试从 `http://cdn.myserver.com/grafana-oss/7.4.0/public/build/app.<HASH>.js` 加载javascript
-  `read_timeout`
使用持续时间格式（5s/5m/5ms）设置在超时读取传入请求和关闭空闲连接之前的最长时间。 `0` 表示读取请求没有超时。

#### `[server.custom_response_headers]`
此设置使您能够指定服务器添加到 HTTP(S) 响应的附加标头。
```bash
exampleHeader1 = exampleValue1
exampleHeader2 = exampleValue2
```

#### `[database]`
Grafana 需要一个数据库来存储用户、仪表板（以及其他数据）。默认情况下，它配置为使用 [`sqlite3`](https://www.sqlite.org/index.html) ，这是一个嵌入式数据库（包含在 Grafana 主二进制文件中）。
- `type`
 `mysql` 、 `postgres` 或`sqlite3`

- `path`
仅适用于 `sqlite3`数据库，数据库文件的路径。
- `cache_mode`
仅适用于“sqlite3”。用于连接数据库的[共享缓存](https://www.sqlite.org/sharedcache.html)设置。（private，shared）默认为 `private` 。
- `wal`
仅适用于“sqlite3”。设置启用/禁用[预写式日志记录](https://sqlite.org/wal.html) 。默认值为 `false` （禁用）。
- `query_retries`
此设置仅适用于 `sqlite` ，用于控制数据库锁定时系统重试查询的次数。默认值为 `0` （禁用）。
- `transaction_retries`
此设置仅适用于 `sqlite` ，用于控制数据库锁定时系统重试事务的次数。默认值为 `5` 。
- `instrument_queries`
设置为 `true` 可为数据库查询添加指标和跟踪。默认值为 `false` 。

####  `[remote_cache]`
>此设置不控制用户会话的存储。无论您的 `[remote_cache]` 设置如何，用户会话_始终_存储在 `[database]` 中配置的主数据库中。

- `type`
`redis` 、 `memcached` 或 `database` 。默认为 `database`
-  `connstr`
远程缓存连接字符串。格式取决于远程缓存的 `type` 。选项包括 `database` 、 `redis` 和 `memcache` 。
- `database`
- `redis` 
连接字符串示例： `addr=127.0.0.1:6379,pool_size=100,db=0,username=grafana,password=grafanaRocks,ssl=false`  
    `addr` 是 Redis 服务器的 `host:port`。
    `pool_size` （可选）是可以与 Redis 建立的底层连接的数量。  
    `db` （可选）是您要使用的 Redis 数据库的数字标识符。  
    `username` （可选）是用于验证当前连接的连接标识符。  
    `password` （可选）是用于验证当前连接的连接密码。  
    `ssl` （可选）表示是否应使用 SSL 连接到 Redis 服务器。其值可以是 `true` 、 `false` 或 `insecure` 。将值设置为 `insecure` 会在建立连接时跳过证书链和主机名的验证。
- `memcache`
示例连接字符串： `127.0.0.1:11211`

#### `dataproxy`
- `logging`
这将启用数据代理日志记录，默认值为 `false` ，正常情况下只记录了grafana的日志，没有记录代理的日志
- `timeout`
- `keep_alive_seconds`
- `tls_handshake_timeout_seconds`
- `expect_continue_timeout_seconds`
- `max_conns_per_host`
- `max_idle_connections`
- `idle_conn_timeout_seconds`
- `send_user_header`
如果启用且用户不是匿名用户，数据代理会在请求中添加包含用户名的 `X-Grafana-User` 标头。默认值为 `false` 。
- `response_limit`
限制 Grafana 从传出 HTTP 请求的响应中读取的字节数。默认值为 `0` ，表示禁用。
- `row_limit`
限制 Grafana 从 SQL 数据源处理的行数。默认值为 `1000000` 。
#### `[analytics]`
- `enabled`
此选项也称为_使用情况分析_ 。如果设置为 `false` ，则禁用写入 Grafana 数据库的写入器以及相关功能，例如仪表板和数据源洞察、状态指示器和高级仪表板搜索。默认值为 `true` 。
- `reporting_enabled`
启用后，Grafana 会将匿名使用情况统计信息发送到 `stats.grafana.org` 。
- `check_for_updates`
- `check_for_plugin_updates`

#### `[security]`
- `disable_initial_admin_creation`
首次启动 Grafana 时禁用创建 Grafana 管理员用户。默认值为 `false` 。
- `admin_user`
默认 Grafana 管理员用户的名称，具有完全权限。默认值为 `admin` 。
- `admin_password`
- `admin_email`
- `secret_key`
用于对某些数据源设置（例如机密和密码）进行签名，使用的加密格式为 CFB 模式下的 AES-256。如果不更新数据源设置并重新编码，则无法更改。
- `disable_gravatar`
设置为 `true` 可禁用 Gravatar 作为用户个人资料图片。默认值为 `false` 。
- `data_source_proxy_whitelist`
定义一个带有端口的 IP 地址或域的允许列表，可以在 Grafana 数据源代理的数据源 URL 中使用。
格式为 `<IP>` 或 `<DOMAIN>:<PORT>` 以空格分隔。PostgreSQL、MySQL 和 MSSQL 数据源不使用代理，因此不受此设置的影响。
- `disable_brute_force_login_protection`
禁止暴力登录保护
- `brute_force_login_protection_max_attempts`
尝试登录次数
-  `disable_ip_address_login_protection`
设置为 `true` 可禁用[针对 IP 地址的暴力登录保护](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout) 。默认值为 `true` 。
- `cookie_secure`
如果您使用 HTTPS 托管 Grafana，请设置为 `true` 。默认值为 `false` 。
- `cookie_samesite`
设置 Cookie 的 `SameSite` 属性，并阻止浏览器将此 Cookie 与跨站请求一起发送。主要目的是降低跨域信息泄露的风险。此设置还提供了一些针对跨站请求伪造攻击 (CSRF) 的保护， [请在此处阅读有关 SameSite 的更多信息](https://owasp.org/www-community/SameSite) 。有效值为 `lax` 、 `strict` 、 `none` 和 `disabled` 。默认值为 `lax` 。使用值 `disabled` 不会向 Cookie 添加任何 `SameSite` 属性
- `allow_embedding`
当设置为 `false` 时，Grafana HTTP 响应中会设置 HTTP 标头 `X-Frame-Options: deny` 指示浏览器不允许在 `<frame>` 、 `<iframe>` 、 `<embed>` 或 `<object>` 中渲染 Grafana。主要目的是降低[点击劫持 (Clickjacking)](https://owasp.org/www-community/attacks/Clickjacking) 的风险。默认值为 `false` 。
- `strict_transport_security`
如果要启用 HTTP `Strict-Transport-Security` (HSTS) 响应标头，请设置为 `true` 。仅当您的配置中启用了 HTTPS，或者有其他上游系统确保您的应用程序使用 HTTPS（例如前端负载均衡器）时才使用此选项。HSTS 会告知浏览器该站点只能使用 HTTPS 访问。
- `strict_transport_security_max_age_seconds`
设置浏览器缓存 HSTS 的时间（以秒为单位）。仅在启用 `strict_transport_security` 时生效。默认值为 `86400` 。
- `strict_transport_security_preload`
设置为 `true` 以启用 HSTS `preloading` 选项。仅在启用 `strict_transport_security` 时有效。默认值为 `false` 。
- `content_security_policy`
设置为 `true` 即可将 `Content-Security-Policy` 标头添加到您的请求中。内容安全策略 (CSP) 控制用户代理可以加载哪些资源，并有助于防止 XSS 攻击。
-  `angular_support_enabled`
默认设置为 false，表示不会加载 Angular 框架及其支持组件。这意味着所有依赖 Angular 支持的[插件](https://grafana.com/docs/grafana/latest/developers/angular_deprecation/angular-plugins/)和核心功能都将无法使用。
依赖 Angular的核心特性有：旧图形面板，旧表盘

#### `[snapshots]`
- `enable`
- `external_enabled`
设置为 `false` 以禁用外部快照发布端点（默认为 `true` ）。
- `external_snapshot_url`
- `external_snapshot_name`
- `public_mode`
设置为 true 可使此 Grafana 实例充当外部快照服务器，并允许未经身份验证的创建和删除快照请求。默认值为 `false`

#### `dashboards`
- `versions_to_keep`
每个仪表板保留的仪表板版本数量。默认值： `20` ，最小值： `1` 。
- `min_refresh_interval`
此功能可防止用户将仪表板刷新间隔设置为低于给定间隔值的值。默认间隔值为 5 秒。间隔字符串是一个可能有符号的十进制数序列，后跟单位后缀（ `ms` 、 `s` 、 `m` 、 `h` 、 `d` ）。例如 `30s` 或 `1m` 。
>当grafana刷新数据导致I/O比较高的时候可以使用

- `default_home_dashboard_path`
默认主仪表板的路径。如果此值为空，则 Grafana 使用 StaticRootPath + “dashboards/home.json”。

#### `[dashboard_cleanup]`
如果通过 /apis 删除了仪表板，则设置清理相关仪表板信息。
- `interval`
运行作业以清理相关资源的频率。默认间隔为 `30s` 。为确保系统不过载，允许的最小值为 `10s`
- `batch_size`

#### `[datasources]`
- `default_manage_alerts_ui_toggle`

#### `[users]`
- `allow_sign_up`
设置为 `false` 禁止用户注册或创建用户账户。默认值为 `false` 管理员仍然可以创建用户。
- `allow_org_create`
设置为 `false` 则禁止用户创建新组织。默认值为 `false` 。
- `login_hint`
登录页面用作登录/用户名输入的占位符文本
- `password_hint`
密码占位符
- `default_theme`
设置默认 UI 主题： `dark` 、 `light` 或 `system` 。默认主题为 `dark` 。
- `default_language`
- `home_page`
- `External user management`

#### `[auth]`
- `login_cookie_name`
用于存储身份验证令牌的 Cookie 名称。默认值为 `grafana_session` 。
- `login_maximum_inactive_lifetime_duration`
已验证用户在下次访问时需要登录之前可以处于非活动状态的最长生命周期（时长）。默认值为 7 天 (7d)。此设置应以时长表示，例如 `5m` （分钟）、 `6h` （小时）、 `10d` （天）、 `2w` （周）或 `1M` （月）。每次成功轮换令牌后，生命周期都会重置 ( `token_rotation_interval_minutes` )。
- `login_maximum_lifetime_duration`
经过身份验证的用户自登录后可登录的最长有效期（时长），之后才需要登录。默认值为 30 天 (30d)。此设置应以时长表示，例如 `5m` （分钟）、 `6h` （小时）、 `10d` （天）、 `2w` （周）或 `1M` （月）。
- `token_rotation_interval_minutes`
当用户处于活动状态时，已验证用户的授权令牌轮换频率。默认值为每 10 分钟一次。

#### `[auth.anonymous]`
#### `[auth.basic]`
#### `[auth.proxy]`
#### `[auth.jwt]`

#### `[log]`
- `mode`
选项包括 `console` 、 `file` 和 `syslog` 。默认为 `console` 和 `file` 。多个模式之间使用空格分隔，例如 `console file` 。
- `level`
选项包括 `debug` 、 `info` 、 `warn` 、 `error` 和 `critical` 。默认为 `info` 。

#### `[log.console]`
- `level`
- `format`
#### `[log.file]`
- `level`
- `format`
- `log_rotate`
- `max_lines`
每个文件最大行数
- `max_size_shift`
旋转前文件的最大大小。默认值为 `28` ，即 `1 << 28` , `256MB`
- `daily_rotate`
启用文件的每日轮换，有效选项为 `false` 或 `true` 。默认为 `true` 。
-  `max_days`
日志文件保留的最长天数。默认值为 `7`

#### `[explore]`
- `enabled`
启用或禁用“探索”部分。默认为 `enabled`
- `defaultTimeOffset`
设置时间选择器上相对于现在的默认时间偏移量。默认值为 1 小时。此设置应以持续时间表示。示例：1h（小时）、1d（天）、1w（周）、1M（月）。
- [hide_logs_download](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#hide_logs_download)
显示或隐藏 Explore 中下载日志的按钮。默认值为 `false` ，表示按钮可见

#### `[help]`
-  `enabled`
启用或禁用“帮助”部分。默认为 `enabled`

#### `[profile]`
- `enable`
启用或禁用个人资料部分，默认是enabled
#### `[news]`
- `enable`
启用新闻推送部分。默认为 `true`

#### `[query]`
- `concurrent_query_limit`
设置混合数据源面板中可并发执行的查询数。默认值为 CPU 数量
- `query_history`
在探索中配置查询历史记录。
- `enabled`
启用或禁用查询历史记录。默认为 `enabled` 。
#### `[panels]
- `enable_alpha``
Set to `true` if you want to test alpha panels that are not yet ready for general usage. Default is `false`.
#### `[date_formats]`
- `full_date`
- `intervals`
```bash
interval_second = HH:mm:ss
interval_minute = HH:mm
interval_hour = MM/DD HH:mm
interval_day = MM/DD
interval_month = YYYY-MM
interval_year = YYYY
```
- `use_browser_locale`
- `default_timezone`
- `default_week_start`

### profiling and tracing
当遇到难以确定和定位的问题时，可以启用pprof分析
```bash
./grafana server -profile -profile-addr=0.0.0.0 -profile-port=8080
```
启用块和互斥锁分析
```bash
./grafana server -profile -profile-addr=0.0.0.0 -profile-port=8080 -profile-block-rate=5 -profile-mutex-rate=5
```
请注意， `pprof` 调试端点与 Grafana HTTP 服务器使用不同的端口。浏览 `http://<profile-addr><profile-port>/debug/pprof` 即可查看可用的调试端点。

当然如果不方便使用启动命令分析，可以使用环境变量
```bash
export GF_DIAGNOSTICS_PROFILING_ENABLED=true
export GF_DIAGNOSTICS_PROFILING_ADDR=0.0.0.0
export GF_DIAGNOSTICS_PROFILING_PORT=8080
export GF_DIAGNOSTICS_PROFILING_BLOCK_RATE=5
export GF_DIAGNOSTICS_PROFILING_MUTEX_RATE=5
```

排查内存泄露，可以对两个不同时间点的内存堆栈进行对比

```bash
curl http://<profile-addr>:<profile-port>/debug/pprof/heap > heap1.pprof
sleep 30
curl http://<profile-addr>:<profile-port>/debug/pprof/heap > heap2.pprof
# 然后使用pprof工具对堆栈内存进行对比
go tool pprof -http=localhost:8081 --base heap1.pprof heap2.pprof
```

高CPU内存情况，收集一段时间CPU使用情况，例如30s
```bash
curl 'http://<profile-addr>:<profile-port>/debug/pprof/profile?seconds=30' > profile.pprof
go tool pprof -http=localhost:8081 profile.pprof
```

#### using tracing
可以使用参数 `-tracing` 启动 `grafana-server` 来启用跟踪，并 `-tracing-file` 覆盖默认的跟踪文件 ( `trace.out` )，跟踪结果将写入该文件。
```bash
./grafana server -tracing -tracing-file=/tmp/trace.out
```
使用环境变量的方式如下
```bash
export GF_DIAGNOSTICS_TRACING_ENABLED=true
export GF_DIAGNOSTICS_TRACING_FILE=/tmp/trace.out
```
使用go的trace工具分析
```bash
go tool trace <trace file>
2019/11/24 22:20:42 Parsing trace...
2019/11/24 22:20:42 Splitting trace...
2019/11/24 22:20:42 Opening browser. Trace viewer is listening on http://127.0.0.1:39735
```
### 使用https进行访问
1. 运行以下命令生成 2048 位 RSA 私钥：
```bash
sudo openssl genrsa -out /etc/grafana/grafana.key 2048
```
2. 运行以下命令，使用上一步中的私钥生成证书
```bash
sudo openssl req -new -key /etc/grafana/grafana.key -out /etc/grafana/grafana.csr
```
3. 运行以下命令使用私钥对证书进行自签名，有效期为365天：
```bash
sudo openssl x509 -req -days 365 -in /etc/grafana/grafana.csr -signkey /etc/grafana/grafana.key -out /etc/grafana/grafana.crt
```
4. 运行以下命令为文件设置适当的权限
```bash
sudo chown grafana:grafana /etc/grafana/grafana.crt
sudo chown grafana:grafana /etc/grafana/grafana.key
sudo chmod 400 /etc/grafana/grafana.key /etc/grafana/grafana.crt
```

#### 配置grafana https
在本部分中，您将编辑 `grafana.ini` 文件，使其包含您创建的证书。
1. 打开 `grafana.ini` 文件并编辑以下配置参数：
```ini
[server]
http_addr =
http_port = 3000
domain = mysite.com
root_url = https://subdomain.mysite.com:3000
cert_key = /etc/grafana/grafana.key
cert_file = /etc/grafana/grafana.crt
enforce_domain = False
protocol = https
```

### 设置图像渲染
Grafana 支持将面板自动渲染为 PNG 图像。这使得 Grafana 可以自动生成面板图像，以包含在警报通知、 [PDF 导出](https://grafana.com/docs/grafana/latest/dashboards/create-reports/#export-dashboard-as-pdf)和[报告](https://grafana.com/docs/grafana/latest/dashboards/create-reports/)中。
渲染图形需要用专用的渲染插件

## Data sources 
### Alertmanager

#### 添加alertmanager数据源

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
      # Valid options for implementation include mimir, cortex and prometheus
      implementation: prometheus
      # Whether or not Grafana should send alert instances to this Alertmanager
      handleGrafanaManagedAlerts: false
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    secureJsonData:
      basicAuthPassword: test_password
```

[Alertmanager数据源配置](https://grafana.com/docs/grafana/latest/datasources/alertmanager/)

### prometheus

#### 添加prometheus数据源

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    # Access mode - proxy (server in the UI) or direct (browser in the UI).
    url: http://localhost:9090
    jsonData:
      httpMethod: POST
      manageAlerts: true
      prometheusType: Prometheus
      prometheusVersion: 2.44.0
      cacheLevel: 'High'
      disableRecordingRules: false
      incrementalQueryOverlapWindow: 10m
      exemplarTraceIdDestinations:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          name: traceID

        # Field with external link.
        - name: traceID
          url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Jaeger%22,%7B%22query%22:%22$${__value.raw}%22%7D%5D'
```

#### 使用区间和范围变量

您可以在查询变量中使用一些全局内置变量，例如 `$__interval` 、 `$__interval_ms` 、 `$__range` 、 `$__range_s` 和 `$__range_ms` 。 有关详细信息，请参阅 [全局内置变量](https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables) ，`label_values` 函数不支持查询，因此您可以将这些变量与 `query_result` 函数结合使用，以筛选变量查询。


#### 使用示例

1. 使用 `$__rate_interval`
我们建议在 `rate` 和 `increase` 函数中使用 `$__rate_interval` 而不是 `$__interval` 或固定间隔值。由于 `$__rate_interval` 始终至少为 Scrape 间隔值的四倍，因此可以避免 Prometheus 特有的问题。
不要使用
```bash
rate(http_requests_total[5m])
```
或者
```bash
rate(http_requests_total[$__interval])
```
建议使用
```bash
rate(http_requests_total[$__rate_interval])
```
`$__rate_interval` 的值定义为 _max( `$__interval` + _Scrape interval_ , 4 * _Scrape interval_ )_ ，其中 _Scrape interval_ 是“最小步长”设置（也称为 `query*interval` ，每个 PromQL 查询的设置）（如果已设置）。否则，Grafana 将使用 Prometheus 数据源的“Scrape interval”设置。
rate在进行计算的过程中至少要提供两个以上才能进行计算，因此interval选择至少要2倍的抓取间隔

见博客 : [使用 rate interval](https://grafana.com/blog/2020/09/28/new-in-grafana-7.2-__rate_interval-for-prometheus-rate-queries-that-just-work/)

#### 变量语法

Prometheus 数据源支持两种在**查询**字段中使用的变量语法：
- `$<varname>` ，例如 `rate(http_requests_total{job=~"$job"}[$_rate_interval])` ，这更易于读写，但不允许在单词中间使用变量。
- `[[varname]]` ，例如 `rate(http_requests_total{job=~"[[job]]"}[$_rate_interval])`


## Dashboards

### 添加标签
标签是整理仪表板的绝佳方式，尤其是在仪表板数量不断增长的情况下。
1. 在界面上可以点击 **设置** 然后 在tags里面添加
2. 在json中可以在根目录的tags对象中添加
```json
"tags": [
	"Kubernetes",
	"Prometheus"
],
```
tags可以用于在主仪表盘界面过滤仪表盘，和k8s里面的label差不多，因此最好每个一类仪表盘都有自己的独特的tag


### 变量

变量让您能够创建更具交互性和动态性的仪表板。
在设置界面变量页面可以查看已有变量和添加新变量。
变量是值的占位符。您可以在指标查询和面板标题中使用变量。因此，当您使用仪表板顶部的下拉菜单更改值时，面板的指标查询将会更改以反映新值。
对于希望允许 Grafana 查看器调整可视化效果但不授予其完全编辑权限的管理员来说，变量非常有用。Grafana 查看器可以使用变量。
查询变量可让您编写数据源查询，该查询可返回指标名称、标签值或键的列表。例如，查询变量可能返回服务器名称、传感器 ID 或数据中心的列表。变量值会随着数据源查询动态获取选项而变化。


*变量使用*
首先定义个变量，变量可以是根据查询语句查询出来的，然后变量的值是可以在面板直接选择的，一旦选择其他表格里面的查询语句直接可以根据需要指定变量的名字，比如定义的有Node变量，那么查询的时候直接就可以指定表格到指定的Node，当更改变量指向的Node时，对应的表格数据也会跟着改变。
```bash
1 - avg by(instance)(irate(node_cpu_seconds_total{origin_prometheus="$origin_prometheus", mode="idle", instance=~"^$Node$"}[5m]))
```

#### 全局变量
- `__dashboard`
此变量代表当前仪表盘的名称

- `__from` 和 `__to`

Grafana 有两个内置的时间范围变量： `$__from` 和 `$__to` 。它们目前默认总是以纪元毫秒为单位进行插值，但您可以控制日期格式。

Expand table  展开表格

| Syntax  句法               | Example result                                     | Description                                                                                                                                                      |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${__from}`              | 1594671549254                                      | Unix millisecond epoch  Unix                                                                                                                                     |
| `${__from:date}`         | 2020-07-13T20:19:09.254Z  2020-07-13T20：19：09.254Z | No arguments, defaults to ISO 8601/RFC 3339                                                                                                                      |
| `${__from:date:iso}`     | 2020-07-13T20:19:09.254Z  2020-07-13T20：19：09.254Z | ISO 8601/RFC 3339                                                                                                                                                |
| `${__from:date:seconds}` | 1594671549                                         | Unix seconds epoch  Unix                                                                                                                                         |
| `${__from:date:YYYY-MM}` | 2020-07                                            | Any custom [date format](https://momentjs.com/docs/#/displaying/) that does not include the `:` character. Uses browser time. Use `:date` or `:date:iso` for UTC |
 
上述语法也适用于 `${__to}` 。

- `__interval`
Grafana 会自动计算查询中按时间分组的时间间隔。当数据点数量超过图表所能显示的数量时，按较大时间间隔分组可以提高查询效率。例如，查看 3 个月的数据时，按 1 天分组比按 10 秒分组更高效。图表看起来相同，查询速度也更快。 `$__interval` 是根据时间范围和图表宽度（像素数）计算得出的。

-  `__interval_ms`
以毫秒为单位的interval变量

- `__name`
此变量仅在 **Singlestat** 面板中可用，可在“选项”选项卡上的前缀或后缀字段中使用。该变量将被替换为系列名称或别名。

- `__org`
该变量是当前组织的 ID。 `${__org.name}` 是当前组织的名称
- `__user`
`${__user.id}` 是当前用户的 ID。 `${__user.login}` 是当前用户的登录句柄。 `${__user.email}` 是当前用户的电子邮件。

- `__range`
目前仅支持 Prometheus 和 Loki 数据源。此变量表示当前仪表板的范围。它通过 `to - from` 计算得出。它以毫秒和秒为单位，分别称为 `$__range_ms` 和 `$__range_s` 。

- `__rate_interval`
目前仅支持 Prometheus 数据源。 `$__rate_interval` 变量用于 rate 函数。请参阅 [Prometheus 查询变量](https://grafana.com/docs/grafana/latest/datasources/prometheus/template-variables/#use-**rate_interval)以了解详细信息。

- `__rate_interval_ms`
`$__rate_interval` 为 `20m` ，则 `$__rate_interval_ms` 为 `1200000` 。

- `timeFilter` 或 `__timeFilter`
`$timeFilter` 变量以表达式形式返回当前选定的时间范围。例如，时间范围间隔 `Last 7 days` 的表达式为 `time > now() - 7d` 。

- `__timezone`
`$__timezone` 变量返回当前选定的时区，可以是 `utc` 或 IANA 时区数据库的条目（例如 `America/New_York` ）。

[仪表盘变量](https://grafana.com/docs/grafana/latest/dashboards/variables/)

#### 链式变量
_链式变量_ （也称为_链接变量_或_嵌套变量_ ）是指在其变量查询中包含一个或多个其他变量的查询变量。

#### 变量语法
面板标题和指标查询可以使用两种不同的语法引用变量：
`$varname` 这种语法很容易阅读，但它不允许你在单词中间使用变量。 **例如：** apps.frontend.$server.requests.count
`${var_name}` 当您想在表达式中间插入变量时使用此语法。
`${var_name:<format>}` 此格式可让您更好地控制 Grafana 插值的方式。有关所有格式类型的更多详细信息，请参阅[高级变量格式选项](https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/#advanced-variable-format-options) 。
`[[varname]]` 请勿使用。旧语法已弃用，将在后续版本中删除。
在将查询发送到数据源之前，查询会_进行插值_ ，这意味着变量会被替换为其当前值。在插值过程中，变量值可能会_进行转义_ ，以符合查询语言的语法及其使用位置。

#### 高级变量格式选项
变量插值的格式取决于数据源，但在某些情况下您可能需要更改默认格式

- General syntax  常规语法
语法： `${var_name:option}`

- CSV
将具有多个值的变量格式化为逗号分隔的字符串。
```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:csv}'
Interpolation result: 'test1,test2'
```
- Distributed - OpenTSDB  分布式——OpenTSDB
为 OpenTSDB 以自定义格式格式化具有多个值的变量。
```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:distributed}'
Interpolation result: 'test1,servers=test2'
```
- Doublequote
将单值和多值变量格式化为逗号分隔的字符串，用 `\"` 转义每个值中的 `"` ，并用 `"` 引用每个值。
```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:doublequote}'
Interpolation result: '"test1","test2"'
```
- Glob - Graphite 
将具有多个值的变量格式化为一个 glob（用于 Graphite 查询）。
```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:glob}'
Interpolation result: '{test1,test2}'
```
- JSON
将具有多个值的变量格式化为逗号分隔的字符串
```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:json}'
Interpolation result: '["test1", "test2"]'
```
- Percentencode
格式化单值和多值变量以用于 URL 参数
```bash
servers = ['foo()bar BAZ', 'test2']
String to interpolate: '${servers:percentencode}'
Interpolation result: 'foo%28%29bar%20BAZ%2Ctest2'
```
- Pipe
将具有多个值的变量格式化为以竖线分隔的字符串。
```bash
servers = ['test1.', 'test2']
String to interpolate: '${servers:pipe}'
Interpolation result: 'test1.|test2'
```
- Raw
不对变量进行任何操作
例如，在本例中，有一个包含 Prometheus 数据源和多值变量的仪表板。Grafana 通常会按如下方式转换变量值以适应 Prometheus：
```bash
servers = ['test1.', 'test2']
String to interpolate: '${servers}'
Interpolation result: '(test1 | test2)'
```
使用原始格式，返回的值不带该格式：
```bash
servers = ['test1.', 'test2']
String to interpolate: '${servers:raw}'
Interpolation result: 'test1,test2'
```
- Regex
将具有多个值的变量格式化为正则表达式字符串。
```bash
servers = ['test1.', 'test2']
String to interpolate: '${servers:regex}'
Interpolation result: '(test1\.|test2)'
```
- Singlequote
将单值和多值变量格式化为逗号分隔的字符串，用 `\'` 转义每个值中的 `'` ，并用 `'` 引用每个值。
```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:singlequote}'
Interpolation result: "'test1','test2'"
```

- Sqlstring
将单值和多值变量格式化为逗号分隔的字符串，用 `'` `''` 转义每个值中的 ' ，并用 `'` 引用每个值。
```bash
servers = ["test'1", "test2"]
String to interpolate: '${servers:sqlstring}'
Interpolation result: "'test''1','test2'"
```

- Text
将单值变量和多值变量格式化为其文本表示形式。对于单值变量，它将仅返回文本表示形式。对于多值变量，它将返回文本表示形式加上 `+` 。
```bash
servers = ["test1", "test2"]
String to interpolate: '${servers:text}'
Interpolation result: "test1 + test2"
```
- Query parameters
将单值变量和多值变量格式化为查询参数表示形式。例如： `var-foo=value1&var-foo=value2`
```bash
servers = ["test1", "test2"]
String to interpolate: '${servers:queryparam}'
Interpolation result: "var-servers=test1&var-servers=test2"
```

### playlist
grafana支持播放列表，添加之后可以在大屏或者其他设备上全屏显示监控内容


## Panels and visualizations
