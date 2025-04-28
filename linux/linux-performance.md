 

## CPU

如果处理器每个CPU有连个超线程，当超过50%的使用率意味着超线程核心存在争夺，会降低性能。

可以使用 `lscpu` 或者

`cat /proc/cpuinfo` 查看CPU信息


## pcstat

用来查看一个文件当前在内核中的缓存情况，以及缓存的命中率，通常用于排查那些需要读取文件频繁的程序，这些程序经常因为文件缓存命中率低而产生性能问题。

> pcstat 命令使用go语言实现，github地址 https://github.com/tobert/pcstat[pcstat]

```bash
pcstat /tmp/test.txt
```












