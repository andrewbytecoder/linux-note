






## config.conf

### 调试配置项

nginx使用块配置项，块配置项一般由具体模块进行解析，根据具体配置快直接可以在代码里面进行查询。

```bash
配置项  配置项值1  配置项值2 ;
```

*日志格式配置项目*
如果配置项值中包括语法符号，比如空格符，那么需要使用单引号或双引号括住配置项值，否则Nginx会报语法错误，注释使用 `#` 进行注释，变量只是少数模块支持，并不是所有模块都支持
```bash
#pid  logs/nginx.pid
log_format main '$remote_addr - $remote_user [$time_local] "$request" ';
```

*是否使用守护进程方式运行*
```bash
daemon on|off;
```
*是否以master/woker方式工作*
```bash
master_process on|off;
```

- 日志

*error日志*
```bash
#          pathfile      level: debug info notice warn error crit alert emerg
error_log logs/error.log error;
```

*仅对指定客户端输出debug日志*
这个配置项，属于事件类型的配置，因此必须放在events{...}中才会生效。这个配置对修复Bug很有用，特别是定位高并发请求下才会发生的问题
```bash
events {
debug_connection 10.224.66.26;
}
```
> 使用debug_connection前，需确保在执行configure时已经加入了--with-debug参数，否则不会生效。

*启用调试点*
当遇到比较难以排查的问题时，可以通过调试点生成堆栈信息查看具体的问题，stop是通过向调试点发送sigstop信号用于调试，abort会字节在关键点生成coredunp然后用户再使用gdb查看当时运行的nginx的堆栈信息
```bash
debug_points[stop|abort];
```

*限制coredump核心转存储文件的大小*
```bash
worker_rlimit_core size;
```

*指定coredump文件生成目录*
```bash
# 该目录唯一的作用就是生成coredump
working_directory path;
```

### 正常配置项
*定义环境变量*
```bash
env VAR|VAR=VALUE;
```
*嵌入其他配置文件*
```bash
include path file;
```
*指定pid文件的路径*
```bash
pid path/file;
```
默认与configure执行时的参数“--pid-path”所指定的路径是相同的，也可以随时修改，但应确保Nginx有权在相应的目标中创建pid文件，该文件直接影响Nginx是否可以运行。
*指定worker进程运行的用户及用户组*
```bash
user username[groupname];
#user nobody nobody;
```
*指定nginx worker进程可以打开的最大句柄描述符个数*
```bash
worker_rlimit_nofile limit;
```
*限制信号队列*
设置每个用户发往nginx的信号队列的大小，也就是说当某个用户的信号队列满了的时候，再向这个用户发送的信号量将会被丢掉
```bash
worker_rlimit_sigpending limit;
```

### 优化性能的配置项
*nginx worker进程个数*
```bash
worker_processes number;
```
在master/worker运行方式下，定义worker进程的个数
*绑定nginx worker进程到指定的CPU内核*
```bash
worker_cpu_affinity cpumask[cpumask...];
# .eg
worker_processes 4;
# 只对linux系统有用
worker_cpu_affinity 1000 0100 0010 0001;
```
*SSL硬件加速*
```bash
ssl_engine device;
```
如果服务器上有SSL硬件加速设备，那么就可以进行配置以加快SSL协议的处理速度。用户可以使用OpenSSL提供的命令来查看是否有SSL硬件加速设备：
```bash
openssl engine -t
```
*系统调用gettimeofday的执行频率*
```bash
timer_resolution t;
```
默认情况下，每次内核的事件调用（如epoll、select、poll、kqueue等）返回时，都会执行一次gettimeofday，实现用内核的时钟来更新Nginx中的缓存时钟。在早期的Linux内核中，gettimeofday的执行代价不小，因为中间有一次内核态到用户态的内存复制。当需要降低
gettimeofday的调用频率时，可以使用timer_resolution配置。例如，“timer_resolution100ms；”表示至少每100ms才调用一次gettimeofday。
但在目前的大多数内核中，如x86-64体系架构，gettimeofday只是一次vsyscall，仅仅对共享内存页中的数据做访问，并不是通常的系统调用，代价并不大，一般不必使用这个配置。
*Nginx worker进程优先级设置*
```bash
worker_priority nice;
```
### 事件类配置项
*是否打开accept锁*
```bash
accept_mutex [on|off];
```
accept_mutex是Nginx的负载均衡锁，accept_mutex这把锁可以让多个worker进程轮流地、序列化地与新的客户端建立TCP连接。当某一个worker进程建立的连接数量达到worker_connections配置的最大连接数的7/8时，会大大地减小该worker进程试图建立新TCP连
接的机会，以此实现所有worker进程之上处理的客户端请求数尽量接近。

*lock文件的路径*
```bash
lock_file path/file;
```
accept锁可能需要这个lock文件，如果accept锁关闭，lock_file配置完全不生效。如果打开了accept锁，并且由于编译程序、操作系统架构等因素导致Nginx不支持原子锁，这时才会用文件锁实现accept锁，这样lock_file指定的lock文件才会生效。
*使用accept锁后到真正建立连接之间的延迟时间*
```bash
accept_mutex_delay Nms;
```
在使用accept锁后，同一时间只有一个worker进程能够取到accept锁。这个accept锁不是阻塞锁，如果取不到会立刻返回。如果有一个worker进程试图取accept锁而没有取到，它至少要等accept_mutex_delay定义的时间间隔后才能再次试图取锁。
*批量建立新连接*
```bash
multi_accept [on|off];
```
*选择事件模型*
```bash
use[kqueue|rtsig|epoll|/dev/poll|select|poll|eventport];
```
>Nginx会自动使用最适合的事件模型

*每个worker的最大连接数*
```bash
worker_connections number;
```

### 用HTTP核心模块配置一个静态Web服务器
*监听端口*
配置块 server
```bash
listen address:port[default(deprecated in 0.8.21)|default_server|
# eg
listen 8000;
listen *:8000;
listen localhost:8000;
# ipv6
listen [::]:8000;
listen [fe80::1];
listen [:::a8c9:1234]:80;
# 在地址和端口后，还可以加上其他参数，例如：
listen 443 default_server ssl;
listen 127.0.0.1 default_server accept_filter=dataready backlog=1024;
```
*主机名称*
```bash
server_name name[...];
```

server_name后可以跟多个主机名称，如server_name www.testweb.com 、download.testweb.com;。
在开始处理一个HTTP请求时，Nginx会取出header头中的Host，与每个server中的server_name进行匹配，以此决定到底由哪一个server块来处理这个请求。有可能一个Host与多个server块中的server_name都匹配，这时就会根据匹配优先级来选择实际处理的server块。
server_name与Host的匹配优先级如下：
1. 首先选择所有字符串完全匹配的server_name，如www.testweb.com 。
2. 其次选择通配符在前面的server_name，如*.testweb.com。
3. 再次选择通配符在后面的server_name，如www.testweb.* 。
4. 最后选择使用正则表达式才匹配的server_name，如~^\.testweb\.com$。

*重定向主机名称的处理*
```bash
server_name_in_redirect on|off;
```
该配置需要配合server_name使用。在使用on打开时，表示在重定向请求时会使用server_name里配置的第一个主机名代替原先请求中的Host头部，而使用off关闭时，表示在重定向请求时使用请求本身的Host头部s

*location*
```bash
location [=|~|~*|^~|@]/uri/{...};
```
location会尝试根据用户请求中的URI来匹配上面的/uri表达式，如果可以匹配，就选择location{}块中的配置来处理用户请求

1. `=` 表示把URI作为字符串，以便与参数中的uri做完全匹配
```bash
location = / {

}
```

2. `~` 表示匹配URI时是字母大小写敏感的
3. `~*` 表示匹配URI时忽略字母大小写问题
4. `^~` 表示匹配URI时只需要其前半部分与uri参数匹配即可
```bash
location ^~ images {}
```
5. `@` 表示仅用于Nginx服务内部请求之间的重定向，带有@的location不直接处理用户请求
6. 在uri参数里是可以用正则表达式的
```bash
location ~* \.(gif|jpg|jpeg)$ {
# 用以匹配以 .gif   .jpg结尾的请求
}
```
> ocation是有顺序的，当一个请求有可能匹配多个location时，实际上这个请求会被第一个location处理。

### 文件路径的定义
*以Root方式设置资源路径*
```bash
root path;
# eg
root html;
```
配置块： http, server, location, if
定义资源文件相对于HTTP请求的根目录。
```bash
location /download/ {
	root optwebhtml;
}
```
在上面的配置中，如果有一个请求的URI是 `/download/index/test.html`，那么Web服务器将会返回服务器上`optwebhtmldownload/index/test.html` 文件的内容。

*以alias方式设置资源路径*
配置块：location
```bash
alias path;
```
alias也是用来设置文件资源路径的，它与root的不同点主要在于如何解读紧跟location后面的uri参数，这将会致使alias与root以不同的方式将用户请求映射到真正的磁盘文件上。例如，如果有一个请求的URI是/conf/nginx.conf，而用户实际想访问的文件在usr/local/nginx/conf/nginx.conf，那么想要使用alias来进行设置的话，可以采用如下方式：
```bash
location conf {
    alias usr/local/nginx/conf/;
}
location ~ ^/test/(\w+)\.(\w+)$ {
    alias usrlocal/nginx/$2/$1.$2;
}
```
*访问首页*
配置块： http、server、location
```bash
index file...;
```
有时，访问站点时的URI是/，这时一般是返回网站的首页，而这与root和alias都不同。这里用ngx_http_index_module模块提供的index配置实现。index后可以跟多个文件参数，Nginx将会按照顺序来访问这些文件

```bash
location {
	root path;
	index index.html htmlindex.php /index.php;
}
```

*根据HTTP返回码重定向页面*
```bash
error_page code[code...][=|=answer-code]uri|@named_location
```
当对于某个请求返回错误码时，如果匹配上了error_page中设置的code，则重定向到新的URI中，例如：
```bash
error_page 404 404.html;
```
注意，虽然重定向了URI，但返回的HTTP错误码还是与原来的相同。用户可以通过“=”来更改返回的错误码
```bash
error_page 404 =200 empty.gif;
error_page 404 =403 forbidden.gif;
```
也可以不指定确切的返回错误码，而是由重定向后实际处理的真实结果来决定，这时，只要把“=”后面的错误码去掉即可
```bash
error_page 404 = /empty.gif;
```
如果不想修改URI，只是想让这样的请求重定向到另一个location中进行处理
```bash
location / (
	error_page 404 @fallback;
)
location @fallback (
	proxy_pass http://backend
;
)
```
这样，返回404的请求会被反向代理到http://backend 上游服务器中处理。
*是否允许递归使用error_page*
```bas
recursive_error_pages[on|off];
```
*try_files*
try_files后要跟若干路径，如path1 path2...，而且最后必须要有uri参数，意义如下：尝试按照顺序访问每一个path，如果可以有效地读取，就直接向用户返回这个path对应的文件结束请求，否则继续向下访问。如果所有的path都找不到有效的文件，就重定向到最后的参数
uri上。因此，最后这个参数uri必须存在，而且它应该是可以有效重定向的
```bash
try_files systemmaintenance.html $uri $uri/index.html $uri.html @other;
location @other {
	proxy_pass http://backend;
}
```

### 内存及磁盘资源的分配

*HTTP包体只存储到磁盘文件中*
```bash
client_body_in_file_only on|clean|off;
```
当值为非off时，用户请求中的HTTP包体一律存储到磁盘文件中，即使只有0字节也会存储为文件。当请求结束时，如果配置为on，则这个文件不会被删除（该配置一般用于调试、
定位问题），但如果配置为clean，则会删除该文件。
*HTTP包体尽量写入到一个内存buffer中*
```bash
client_body_in_single_buffer on|off;
```
用户请求中的HTTP包体一律存储到内存buffer中。当然，如果HTTP包体的大小超过了下面client_body_buffer_size设置的值
*存储HTTP头部的内存buffer大小*
```bash
client_header_buffer_size size;
# eg
client_header_buffer_size 1k;
```
*存储超大HTTP头部的内存buffer大小*
```bash
large_client_header_buffers number size;
```
*存储HTTP包体的内存buffer大小*
```bash
client_body_buffer_size size;
```
*HTTP包体的临时存放目录*
```bash
client_body_temp_path dir-path[level1[level2[level3]]]
```

*reset_timeout_connection*
```bash
reset_timeout_connection on|off;
```
连接超时后将通过向客户端发送RST包来直接重置连接。这个选项打开后，Nginx会在某个连接超时后，不是使用正常情形下的四次握手关闭TCP连接，而是直接向用户发送RST重
置包，不再等待用户的应答，直接释放Nginx服务器上关于这个套接字使用的所有缓存（如TCP滑动窗口）。相比正常的关闭方式，它使得服务器避免产生许多处于FIN_WAIT_1、
FIN_WAIT_2、TIME_WAIT状态的TCP连接。
*keepalive_disable[msie6|safari|none]...*
```bash
keepalive_disablemsie6 safari
```
*tcp_nodelay*

```bash
tcp_nodelay on;
```
### 文件操作的优化
*sendfile系统调用*
```bash
sendfile on|off;
```
可以启用Linux上的sendfile系统调用来发送文件，它减少了内核态与用户态之间的两次内存复制，这样就会从磁盘中读取文件后直接在内核态发送到网卡设备，提高了发送文件的
效率。
*AIO系统调用*
```bash
aio on|off;
```
此配置项表示是否在FreeBSD或Linux系统上启用内核级别的异步文件I/O功能。注意，
它与sendfile功能是互斥的。

*directio*
```bash
directio size|off;
```
此配置项在FreeBSD和Linux系统上使用O_DIRECT选项去读取文件，缓冲区大小为size，通常对大文件的读取速度有优化作用。注意，它与sendfile功能是互斥的。
*directio_alignment*
```bash
directio_alignment size;
# eg
directio_alignment 512;
```
它与directio配合使用，指定以directio方式读取文件时的对齐方式。一般情况下，512B已经足够了，但针对一些高性能文件系统，如Linux下的XFS文件系统，可能需要设置到4KB
作为对齐方式。
*open_file_cache max=N[inactive=time]|off;*
```bash
open_file_cache off;
```
文件缓存会在内存中存储以下3种信息：
- 文件句柄、文件大小和上次修改时间。
- 已经打开过的目录结构。
- 没有找到的或者没有权限操作的文件信息。
这样，通过读取缓存就减少了对磁盘的操作。
### 对客户端请求的特殊处理
*ignore_invalid_headers on|off;*
```bash
ignore_invalid_headers on;
```
*HTTP头部是否允许下划线*
```bash
underscores_in_headers on|off;
```
默认为off，表示HTTP头部的名称中不允许带 `_`（下划线）。

*对If-Modified-Since头部的处理策略*
```bash
if_modified_since[off|exact|before];
# eg
if_modified_since exact;
```
*文件未找到时是否记录到error日志*
```bash
log_not_found on|off;
```
*merge_slashes*
```bash
merge_slashes on|off;
# eg 
merge_slashes on;
```
此配置项表示是否合并相邻的“”，例如，/test///a.txt，在配置为on时，会将其匹配为location/test/a.txt；如果配置为off，则不会匹配，URI将仍然是//test///a.txt。

*设置DNS名字解析服务器地址*
设置的地址用来对域名进行解析
```bash
resolver address...;
```
*DNS解析的超时时间*
```bash
resolver_timeout time;
# eg 
resolver_timeout 30s;
```
*返回错误页面时是否在Server中注明Nginx版本*
```bash
server_tokens on|off;
```

### ngx_http_core_module模块提供的变量

`ngx_http_core_module` 是 Nginx 中非常重要的一个模块，它提供了许多用于配置和控制 HTTP 请求处理过程的指令。此外，该模块还提供了一系列预定义变量，这些变量可以在 Nginx 配置文件中使用，以获取请求的各种信息或控制请求处理的行为。以下是一些常用的由 `ngx_http_core_module` 提供的变量：

1. **$args**：这个变量包含请求行中的参数，即URL查询字符串。
2. **$binary_remote_addr**：客户端地址的二进制表示，长度总是4个字节（对于IPv4地址）或16个字节（对于IPv6地址）。
3. **$body_bytes_sent**：发送给客户端的字节数，不包括响应头的大小。
4. **$content_length**：HTTP请求头中的"Content-Length"字段。
5. **$content_type**：HTTP请求头中的"Content-Type"字段。
6. **$document_root**：当前请求的root目录。
7. **$document_uri / $uri**：与请求相关的当前URI（不带请求参数），可被内部重写。
8. **$host**：请求中的Host（主机名），如果请求中没有Host，则为按照server_name指令进行匹配后得到的值。
9. **$http_HEADER**：匹配任意请求头，将HEADER替换为要获取的头部字段名称，注意字段名称应全部大写，并用下划线替代连字符。
10. **$https**：如果连接使用SSL/TLS则值为"on"，否则为空字符串。
11. `$is_args`：如果$args设置则返回"?"，否则返回空字符串。
12. **$limit_rate**：设置对客户端输出数据的速率限制，单位是字节/秒。
13. **$msec**：当前时间戳，单位是秒，精度达到毫秒级。
14. **$nginx_version**：Nginx版本号。
15. **$pid**：worker进程的PID。
16. `$query_string`：等同于$args。
17. **$realpath_root**：基于root或者alias指令计算出来的当前请求的真实文件系统路径。
18. **$remote_addr**：客户端地址。
19. **$remote_port**：客户端端口号。
20. **$remote_user**：使用basic认证时的用户名。
21. **$request**：完整的原始请求行。
22. **$request_body**：客户端请求主体信息。
23. **$request_body_file**：临时存储客户端请求主体的文件名。
24. **$request_completion**：如果请求成功完成则为"OK"，如果客户端在完整消息接收前断开连接则为空。
25. **$request_filename**：当前请求的文件路径，由root或alias转换而来。
26. **$request_method**：请求方法（如GET、POST等）。
27. **$request_uri**：完整的原始请求URI（含查询字符串）。
28. **$scheme**：所用协议，http 或 https。
29. **$sent_http_HEADER**：对应响应头中HEADER的值，可以用来查看或记录响应头的内容。
30. **$server_addr**：接受请求的服务器IP地址。
31. **$server_name**：请求中Host首部对应的虚拟主机的名字。
32. **$server_port**：接受请求的服务器端口。
33. **$server_protocol**：请求使用的协议，通常为HTTP/1.0、HTTP/1.1或HTTP/2.0。
34. **$status**：HTTP响应状态码。
35. **$tcpinfo_rtt, $tcpinfo_rttvar, $tcpinfo_snd_cwnd, $tcpinfo_rcv_space**：TCP连接的相关信息。

### 负载均衡的基本配置
作为代理服务器，一般都需要向上游服务器的集群转发请求。这里的负载均衡是指选择一种策略，尽量把请求平均地分布到每一台上游服务器上。下面介绍负载均衡的配置项

#### *upstream块*
```bash
upstream name{...}
```

upstream块定义了一个上游服务器的集群，便于反向代理中的proxy_pass使用
```bash
upstream backend {
	server backend1.example.com;
	server backend2.example.com;
	server backend3.example.com;
}
server {
	location / {
		proxy_pass http://backend;
	}
}
```

`server name[parameters];` server配置项指定了一台上游服务器的名字，这个名字可以是域名、IP地址端口、UNIX句柄等，在其后还可以跟下列参数
- weight=number：设置向这台上游服务器转发的权重，默认为1。
- max_fails=number：该选项与fail_timeout配合使用，指在fail_timeout时间段内，如果向当前的上游服务器转发失败次数超过number，则认为在当前的fail_timeout时间段内这台上游服务器不可用。max_fails默认为1，如果设置为0，则表示不检查失败次数。
- fail_timeout=time：fail_timeout表示该时间段内转发失败多少次后就认为上游服务器暂时不可用，用于优化反向代理功能。
- down：表示所在的上游服务器永久下线，只在使用ip_hash配置项时才有用。
- backup：在使用ip_hash配置项时它是无效的。它表示所在的上游服务器只是备份服务器，只有在所有的非备份上游服务器都失效后，才会向所在的上游服务器转发请求。

```bash
upstream backend {
	server backend1.example.com weight=5;
	server 127.0.0.1:8080    max_fails=3 fail_timeout=30s;
	server unix:/tmp/backend3;;
}
```

*ip_hash*
```bash
upstream backend {
	ip_hash;
	server backend1.example.com;
	server backend2.example.com;
	server backend3.example.com down;
	server backend4.example.com;
}
```
在有些场景下，我们可能会希望来自某一个用户的请求始终落到固定的一台上游服务器中。假设上游服务器会缓存一些信息，如果同一个用户的请求任意地转发到集群中的
任一台上游服务器中，那么每一台上游服务器都有可能会缓存同一份信息，这既会造成资源的浪费，也会难以有效地管理缓存信息。ip_hash就是用以解决上述问题的，它首先根据客户端的IP地址计算出一个key，将key按照upstream集群里的上游服务器数量进行取模，然后以取模后的结果把请求转发到相应的上游服务器中。这样就确保了同一个客户端的请求只会转发到指定的上游服务器中。
ip_hash与weight（权重）配置不可同时使用。如果upstream集群中有一台上游服务器暂时不可用，不能直接删除该配置，而是要down参数标识，确保转发策略的一贯性。

*记录日志时支持的变量*

| 变量名            | 意义           |
|---|---|
| $upstream_addr | 处理请求的上游服务器地址 |     
| $upstream_cache_status | 表示是否命中缓存，取值范围：MISS、EXPIRED、PDATING、STALE、HIT |     
| $upstream_status | 上游服务器返回的响应中的 HTTP 响应码 |     
| $upstream_response_time | 上游服务器的响应时间，精度到毫秒 |
| `$upstream_http_$HEADER` | HTTP 的头部，如 upstream_http_host |
### 反向代理的基本配置
*proxy_pass*
```bash
proxy_pass URL;
```
此配置项将当前请求反向代理到URL参数指定的服务器上，URL可以是主机名或IP地址加端口的形式
```bash
proxy_pass http://localhost:8000/uri/
```
还可以如上节负载均衡中所示，直接使用upstream块
用户可以把HTTP转换成更安全的HTTPS
```bash
proxy_pass https://192.168.0.1
```
默认情况下反向代理是不会转发请求中的Host头部的。如果需要转发，那么必须加上配置
```bash
proxy_set_header Host $host;
```
*proxy_method*
```bash
proxy_method method;
# eg, 客户端发来的GET请求在转发时方法名也会改为POST
proxy_method POST;
```
此配置项表示转发时的协议方法名。
*proxy_hide_header*
```bash
proxy_hide_header the_header;
```
Nginx会将上游服务器的响应转发给客户端，但默认不会转发以下HTTP头部字段：Date、Server、`X-Pad和X-Accel-*`。使用proxy_hide_header后可以任意地指定哪些HTTP头部
字段不能被转发。
```bash
proxy_hide_header Cache-Control;
proxy_hide_header MicrosoftOfficeWebServer;
```
*proxy_pass_header*
```bash
proxy_pass_header the_header;
```
与proxy_hide_header功能相反，proxy_pass_header会将原来禁止转发的header设置为允许转发。
*proxy_pass_request_body*
```bash
proxy_pass_request_body on|off;
```
作用为确定是否向上游服务器发送HTTP包体部分。
*proxy_pass_request_headers*
```bash
proxy_pass_request_headers on|off;
```
作用为确定是否转发HTTP头部。
*proxy_redirect*
```bash
proxy_redirect[default|off|redirect replacement];
# eg
proxy_redirect default;
```
当上游服务器返回的响应是重定向或刷新请求（如HTTP响应码是301或者302）时，proxy_redirect可以重设HTTP头部的location或refresh字段。例如，如果上游服务器发出的响
应是302重定向请求，location字段的URI是http://localhost:8000/two/some/uri/ ，那么在下面的配置情况下，实际转发给客户端的location是http://frontendonesome/uri/ 。
```bash
proxy_redirect http://localhost:8000/two/ http://frontendone;
```
这里还可以使用ngx-http-core-module提供的变量来设置新的location字段。例如：
```bash
proxy_redirect http://localhost:8000/ http://$host:$server_port/;
```
也可以省略replacement参数中的主机名部分，这时会用虚拟主机名称来填充。
```bash
proxy_redirect http://localhost:8000/two/one;
```
*proxy_next_upstream*
```bash
proxy_next_upstream[error|timeout|invalid_header|http_500|http_502|http_503|http_504|http_404|off];
# eg
proxy_next_upstream error timeout;
```
此配置项表示当向一台上游服务器转发请求出现错误时，继续换一台上游服务器处理这个请求。前面已经说过，上游服务器一旦开始发送应答，Nginx反向代理服务器会立刻把应
答包转发给客户端。因此，一旦Nginx开始向客户端发送响应包，之后的过程中若出现错误也是不允许换下一台上游服务器继续处理的。这很好理解，这样才可以更好地保证客户端只
收到来自一个上游服务器的应答。proxy_next_upstream的参数用来说明在哪些情况下会继续选择下一台上游服务器转发请求。
- error：当向上游服务器发起连接、发送请求、读取响应时出错。
- timeout：发送请求或读取响应时发生超时。
- invalid_header：上游服务器发送的响应是不合法的。
- http_500：上游服务器返回的HTTP响应码是500。
- http_502：上游服务器返回的HTTP响应码是502。
- http_503：上游服务器返回的HTTP响应码是503。
- http_504：上游服务器返回的HTTP响应码是504。
- http_404：上游服务器返回的HTTP响应码是404。
- off：关闭proxy_next_upstream功能—出错就选择另一台上游服务器再次转发
