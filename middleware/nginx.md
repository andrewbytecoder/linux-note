






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
















