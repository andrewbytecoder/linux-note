

## go module




### context


```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key interface{}) interface{}
}
```

- `Deadline`：返回的第一个值是 **截止时间**，到了这个时间点，Context 会自动触发 Cancel 动作。返回的第二个值是 一个布尔值，true 表示设置了截止时间，false 表示没有设置截止时间，如果没有设置截止时间，就要手动调用 cancel 函数取消 Context。
- `Done`：返回一个只读的通道（只有在被cancel后才会返回），类型为 `struct{}`。当这个通道可读时，意味着parent context已经发起了取消请求，根据这个信号，开发者就可以做一些清理动作，退出goroutine。
- `Err`：返回 context 被 cancel 的原因。
- `Value`：返回被绑定到 Context 的值，是一个键值对，所以要通过一个Key才可以获取对应的值，这个值一般是线程安全的。

### 使用Context优雅关闭goroutine

常见的关闭协程的原因有如下几种：

1. goroutine 自己跑完结束退出 - 正常退出
2. 主进程crash退出，goroutine 被迫退出 - 异常，应当优化代码
3. 通过通道发送信号，引导协程的关闭 - 可通过context实现

.通过chan信道通知协程退出
```go
func main() {
    stop := make(chan bool)

    go func() {
        for {
            select {
            case <-stop:
                fmt.Println("监控退出，停止了...")
                return
            default:
                fmt.Println("goroutine监控中...")
                time.Sleep(2 * time.Second)
            }
        }
    }()

    time.Sleep(10 * time.Second)
    fmt.Println("可以了，通知监控停止")
    stop<- true
    //为了检测监控过是否停止，如果没有监控输出，就表示停止了
    time.Sleep(5 * time.Second)

}
```

chan+select的方式，是比较优雅的结束一个goroutine的方式，不过这种方式也有局限性，如果有很多goroutine都需要控制结束怎么办呢？如果这些goroutine又衍生了其他更多的goroutine怎么办呢？如果一层层的无穷尽的goroutine呢？这就非常复杂了，即使我们定义很多chan也很难解决这个问题，因为goroutine的关系链就导致了这种场景非常复杂。

.通过关闭通道特性退出goroutine
```go
func monitor(ch chan bool, number int)  {
    for {
        select {
        case v := <-ch:
            // 仅当 ch 通道被 close，或者有数据发过来(无论是true还是false)才会走到这个分支
            fmt.Printf("监控器%v，接收到通道值为：%v，监控结束。\n", number,v)
            return
        default:
            fmt.Printf("监控器%v，正在监控中...\n", number)
            time.Sleep(2 * time.Second)
        }
    }
}

func main() {
    stopSingal := make(chan bool)
    for i :=1 ; i <= 5; i++ {
        go monitor(stopSingal, i)
    }
    time.Sleep( 1 * time.Second)
    // 关闭所有 goroutine
    close(stopSingal)
    // 等待5s，若此时屏幕没有输出 <正在监控中> 就说明所有的goroutine都已经关闭
    time.Sleep( 5 * time.Second)
    fmt.Println("主程序退出！！")
}
```

如果不使用上面 close 通道的方式，还有没有其他更优雅的方法来实现呢？

有，那就是本文要讲的 Context

```go
func monitor(ctx context.Context, number int)  {
    for {
        select {
        // 其实可以写成 case <- ctx.Done()
        // 这里仅是为了让你看到 Done 返回的内容
        case v :=<- ctx.Done():
            fmt.Printf("监控器%v，接收到通道值为：%v，监控结束。\n", number,v)
            return
        default:
            fmt.Printf("监控器%v，正在监控中...\n", number)
            time.Sleep(2 * time.Second)
        }
    }
}

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    for i :=1 ; i <= 5; i++ {
        go monitor(ctx, i)
    }
    time.Sleep( 1 * time.Second)
    // 关闭所有 goroutine
    cancel()
    // 等待5s，若此时屏幕没有输出 <正在监控中> 就说明所有的goroutine都已经关闭
    time.Sleep( 5 * time.Second)
    fmt.Println("主程序退出！！")
}
```

- 通常 Context 都是做为函数的第一个参数进行传递（规范性做法），并且变量名建议统一叫 ctx
- Context 是线程安全的，可以放心地在多个 goroutine 中使用。
- 当你把 Context 传递给多个 goroutine 使用时，只要执行一次 cancel 操作，所有的 goroutine 就可以收到 取消的信号
- 不要把原本可以由函数参数来传递的变量，交给 Context 的 Value 来传递。
- 当一个函数需要接收一个 Context 时，但是此时你还不知道要传递什么 Context 时，可以先用 context.TODO 来代替，而不要选择传递一个 nil。
- 当一个 Context 被 cancel 时，继承自该 Context 的所有 子 Context 都会被 cancel。








## sync

## sync.WaitGroup


```go
func worker(x int, wg *sync.WaitGroup) {
    defer wg.Done()
    for i := 0; i < 5; i++ {
        fmt.Printf("worker %d: %d\n", x, i)
    }
}

func main() {
    var wg sync.WaitGroup

    wg.Add(2)
    go worker(1, &wg)
    go worker(2, &wg)

    wg.Wait()
}
```


### sync.Mutex


### sync.RWMutex

- 为了保证数据的安全，它规定了当有人还在读取数据（即读锁占用）时，不允计有人更新这个数据（即写锁会阻塞）
- 为了保证程序的效率，多个人（线程）读取数据（拥有读锁）时，互不影响不会造成阻塞，它不会像 Mutex 那样只允许有一个人（线程）读取同一个数据。



### sync.Pool

https://www.cyhone.com/articles/think-in-sync-pool/[sync.Pool 底层原理]

https://juejin.cn/post/6978688329864708126[底层实现]

https://zhuanlan.zhihu.com/p/616436531[设计]









## fmt

- 通用占位符

- `%v`：以值的默认格式打印
- `%+v`：类似%v，但输出结构体时会添加字段名
- `%#v`：值的Go语法表示
- `%T`：打印值的类型
- `%%`： 打印百分号本身

```go
type Profile struct {
    name string
    gender string
    age int
}

func main() {
    var people = Profile{name:"wangbm", gender: "male", age:27}
    fmt.Printf("%v \n", people)  // output: {wangbm male 27}
    fmt.Printf("%T \n", people)  // output: main.Profile

    // 打印结构体名和类型
    fmt.Printf("%#v \n", people) // output: main.Profile{name:"wangbm", gender:"male", age:27}
    fmt.Printf("%+v \n", people) // output: {name:wangbm gender:male age:27}
    fmt.Printf("%% \n") // output: %
}
```

- 打印布尔值

```go
func main() {
    fmt.Printf("%t \n", true)  // output: true
    fmt.Printf("%t \n", false) // output: false
}
```

- 打印字符串

- `%s`：输出字符串表示（string类型或\[\]byte)
- `%q`：双引号围绕的字符串，由Go语法安全地转义
- `%x`：十六进制，小写字母，每字节两个字符
- `%X`：十六进制，大写字母，每字节两个字符

```go
func main() {
    fmt.Printf("%s \n", []byte("Hello, Golang"))  // output: Hello, Golang
    fmt.Printf("%s \n", "Hello, Golang")     // output: Hello, Golang

    fmt.Printf("%q \n", []byte("Hello, Golang"))  // output: "Hello, Golang"
    fmt.Printf("%q \n", "Hello, Golang")     // output: "Hello, Golang"
    fmt.Printf("%q \n", `hello \r\n world`)  // output: "hello \\r\\n world"

    fmt.Printf("%x \n", "Hello, Golang")     // output: 48656c6c6f2c20476f6c616e67
    fmt.Printf("%X \n", "Hello, Golang")     // output: 48656c6c6f2c20476f6c616e67
}
```

- 打印指针

```go
func main() {
    var people = Profile{name:"wangbm", gender: "male", age:27}
    fmt.Printf("%p", &people)  // output: 0xc0000a6150
}
```

- 打印整型

- `%b`：以二进制打印
- `%d`：以十进制打印
- `%o`：以八进制打印
- `%x`：以十六进制打印，使用小写：a-f
- `%X`：以十六进制打印，使用大写：A-F
- `%c`：打印对应的的unicode码值
- `%q`：该值对应的单引号括起来的go语法字符字面值，必要时会采用安全的转义表示
- `%U`：该值对应的 Unicode格式：U+1234，等价于”U+%04X”


```go
func main() {
    n := 1024
    fmt.Printf("%d 的 2 进制：%b \n", n, n)
    fmt.Printf("%d 的 8 进制：%o \n", n, n)
    fmt.Printf("%d 的 10 进制：%d \n", n, n)
    fmt.Printf("%d 的 16 进制：%x \n", n, n)

    // 将 10 进制的整型转成 16 进制打印： %x 为小写， %X 为小写
    fmt.Printf("%x \n", 1024)
    fmt.Printf("%X \n", 1024)

    // 根据 Unicode码值打印字符
    fmt.Printf("ASCII 编码为%d 表示的字符是： %c \n", 65, 65)  // output: A

    // 根据 Unicode 编码打印字符
    fmt.Printf("%c \n", 0x4E2D)  // output: 中
    // 打印 raw 字符时
    fmt.Printf("%q \n", 0x4E2D)  // output: '中'

    // 打印 Unicode 编码
    fmt.Printf("%U \n", '中')   // output: U+4E2D
}
```

- 打印浮点数

- `%e`：科学计数法，如-1234.456e+78
- `%E`：科学计数法，如-1234.456E+78
- `%f`：有小数部分但无指数部分，如123.456
- `%F`：等价于%f
- `%g`：根据实际情况采用%e或%f格式（以获得更简洁、准确的输出）
- `%G`：根据实际情况采用%E或%F格式（以获得更简洁、准确的输出）

```go
func main() {
    fmt.Printf("%e \n", 123.456)  // output: 1.234560e+02
    fmt.Printf("%E \n", 123.456)  // output: 1.234560E+02
    fmt.Printf("%f \n", 123.456)  // output: 123.456000
    fmt.Printf("%F \n", 123.456)  // output: 123.456000
    fmt.Printf("%g \n", 123.456)  // output: 123.456
    fmt.Printf("%G \n", 123.456)  // output: 123.456
}
```

- 宽度标识符

宽度通过一个紧跟在百分号后面的十进制数指定，如果未指定宽度，则表示值时除必需之外不作填充。精度通过（可选的）宽度后跟点号后跟的十进制数指定。

如果未指定精度，会使用默认精度；如果点号后没有跟数字，表示精度为0。举例如下：

```go
func main() {
    n := 12.34
    fmt.Printf("%f\n", n)     // 以默认精度打印
    fmt.Printf("%9f\n", n)   // 宽度为9，默认精度
    fmt.Printf("%.2f\n", n)  // 默认宽度，精度2
    fmt.Printf("%9.2f\n", n)  //宽度9，精度2
    fmt.Printf("%9.f\n", n)    // 宽度9，精度0
}
```

- 占位符 `%+`

- `%+v`：若值为结构体，则输出将包括结构体的字段名。
- `%+q`：保证只输出ASCII编码的字符，非 ASCII 字符则以unicode编码表示

```go
func main() {
    // 若值为结构体，则输出将包括结构体的字段名。
    var people = Profile{name:"wangbm", gender: "male", age:27}
    fmt.Printf("%v \n", people) // output: {name:wangbm gender:male age:27}
    fmt.Printf("%+v \n", people) // output: {name:wangbm gender:male age:27}

    // 保证只输出ASCII编码的字符
    fmt.Printf("%q \n", "golang")  // output: "golang"
    fmt.Printf("%+q \n", "golang")  // output: "golang"

    // 非 ASCII 字符则以unicode编码表示
    fmt.Printf("%q \n", "中文")  // output: "中文"
    fmt.Printf("%+q \n", "中文") // output: "\u4e2d\u6587"
}
```

- 占位符：%

- `%#x`：给打印出来的是 16 进制字符串加前缀 `0x`
- `%#q`：用反引号包含，打印原始字符串
- `%#U`：若是可打印的字符，则将其打印出来
- `%#p`：若是打印指针的内存地址，则去掉前缀 0x

```go
func main() {
// 对于打印出来的是 16 进制，则加前缀 0x
fmt.Printf("%x \\n", "Hello, Golang")     // output: 48656c6c6f2c20476f6c616e67
fmt.Printf("%#x \\n", "Hello, Golang")     // output: 0x48656c6c6f2c20476f6c616e67

    // 用反引号包含，打印原始字符串
    fmt.Printf("%q \\n", "Hello, Golang")     // output: "Hello, Golang"
    fmt.Printf("%#q \\n", "Hello, Golang")     // output: \`Hello, Golang\`

    // 若是可打印的字符，则将其打印出来
    fmt.Printf("%U \\n", '中')     // output: U+4E2D
    fmt.Printf("%#U \\n", '中')     // output: U+4E2D '中'

    // 若是打印指针的内存地址，则去掉前缀 0x
    a := 1024
    fmt.Printf("%p \\n", &a)  // output: 0xc0000160e0
    fmt.Printf("%#p \\n", &a)  // output: c0000160e0
}
```

- 对齐补全

```go
# 字符串
func main() {
    // 打印的值宽度为5，若不足5个字符，则在前面补空格凑足5个字符。
    fmt.Printf("a%5sc\n", "b")   // output: a    bc
    // 打印的值宽度为5，若不足5个字符，则在后面补空格凑足5个字符。
    fmt.Printf("a%-5sc\n", "b")  //output: ab    c

    // 不想用空格补全，还可以指定0，其他数值不可以，注意：只能在前边补全，后边补全无法指定字符
    fmt.Printf("a%05sc\n", "b") // output: a0000bc
     // 若超过5个字符，不会截断
    fmt.Printf("a%5sd\n", "bbbccc") // output: abbbcccd
}
# 浮点数
func main() {
    // 保证宽度为6（包含小数点)，2位小数，右对齐
    // 不足6位时，整数部分空格补全，小数部分补零，超过6位时，小数部分四舍五入
    fmt.Printf("%6.2f,%6.2f\n", 12.3, 123.4567)

    // 保证宽度为6（包含小数点)，2位小数，- 表示左对齐
    // 不足6位时，整数部分空格补全，小数部分补零，超过6位时，小数部分四舍五入
    fmt.Printf("%-6.2f,%-6.2f\n", 12.2, 123.4567)
}
```

- 正负号占位

如果是正数，则留一个空格，表示正数

如果是负数，则在此位置，用 `-` 表示

```go
func main() {
    fmt.Printf("1% d3\n", 22)
    fmt.Printf("1% d3\n", -22)
}
```

## os 包

### `os/exec`

在 Golang 中用于执行命令的库是 `os/exec`，exec.Command 函数返回一个 `Cmd` 对象，根据不同的需求，可以将命令的执行分为三种情况

1. 只执行命令，不获取结果
2. 执行命令，并获取结果（不区分 stdout 和 stderr）
3. 执行命令，并获取结果（区分 stdout 和 stderr）

===== 只执行命令，不获取结果

```go
func main() {
    cmd := exec.Command("ls", "-l", "/var/log/")
    err := cmd.Run()
    if err != nil {
        log.Fatalf("cmd.Run() failed with %s\n", err)
    }
}
```

===== 执行命令，并获取结果

```go
func main() {
    cmd := exec.Command("ls", "-l", "/var/log/")
    out, err := cmd.CombinedOutput()
    if err != nil {
        fmt.Printf("combined out:\n%s\n", string(out))
        log.Fatalf("cmd.Run() failed with %s\n", err)
    }
    fmt.Printf("combined out:\n%s\n", string(out))
}
```

CombinedOutput 函数，只返回 out，并不区分 stdout 和 stderr。如果你想区分他们，可以直接看第三种方法

不过在那之前，我却发现一个小问题：有时候，shell 命令能执行，并不代码 exec 也能执行。

```go
ls -l /var/log/*.log # 能正常执行，但是代码 exec 却执行不了
exec.Command("ls", "-l", "/var/log/*.log") ==> ls -l "/var/log/*.log"

因为双引号的问题，会导致ls忽略通配符*，直接把输入当成文件名字查找
```

===== 执行命令，并获取结果（区分 stdout 和 stderr）

```go
func main() {
    // 执行会报错
    cmd := exec.Command("ls", "-l", "/var/log/*.log")
    var stdout, stderr bytes.Buffer
    cmd.Stdout = &stdout  // 标准输出
    cmd.Stderr = &stderr  // 标准错误
    err := cmd.Run()
    outStr, errStr := string(stdout.Bytes()), string(stderr.Bytes())
    fmt.Printf("out:\n%s\nerr:\n%s\n", outStr, errStr)
    if err != nil {
        log.Fatalf("cmd.Run() failed with %s\n", err)
    }
}
```

===== 执行多个命令，请使用管道进行组合

```go
func main() {
    c1 := exec.Command("grep", "ERROR", "/var/log/messages")
    c2 := exec.Command("wc", "-l")
    c2.Stdin, _ = c1.StdoutPipe()
    c2.Stdout = os.Stdout
    _ = c2.Start()
    _ = c1.Run()
    _ = c2.Wait()
}
```

===== 设置命令级别的环境变量

使用 os 库的 Setenv 函数来设置的环境变量，是作用于整个进程的生命周期的。

```go
func main() {
    os.Setenv("NAME", "wangyz")
    cmd := exec.Command("echo", os.ExpandEnv("$NAME"))
    out, err := cmd.CombinedOutput()
    if err != nil {
        log.Fatalf("cmd.Run() failed with %s\n", err)
    }
    fmt.Printf("%s", out)
}
```

如果想把环境变量的作用范围再缩小到命令级别，也是有办法的

```go
# 只有对应的 cmd命令里面才有这个环境变量
func ChangeYourCmdEnvironment(cmd * exec.Cmd) error {
    env := os.Environ()
    cmdEnv := []string{}

    for _, e := range env {
        cmdEnv = append(cmdEnv, e)
    }
    cmdEnv = append(cmdEnv, "NAME=wangbm")
    cmd.Env = cmdEnv

    return nil
}

func main() {
    cmd1 := exec.Command("bash", "/home/wangbm/demo.sh")
  ChangeYourCmdEnvironment(cmd1) // 添加环境变量到 cmd1 命令: NAME=wangbm
    out1, _ := cmd1.CombinedOutput()
    fmt.Printf("output: %s", out1)

    cmd2 := exec.Command("bash", "/home/wangbm/demo.sh")
    out2, _ := cmd2.CombinedOutput()
    fmt.Printf("output: %s", out2)
}
```

