
## 基础知识

### 闭包

闭包简单来说就是 `闭包 = 函数 + 引用环境` 因此匿名函数以及闭包函数中都是使用引用的方式使用环境变量的，这样在闭包函数中修改变量，外面的值也会跟着变

```go
package main
import (
    "fmt"
)
// 函数返回一个闭包函数
func adder() func(int) int {
    var x int
    // 返回的信息就是就是匿名函数+对环境变量的引用
    // 在go中一旦对环境变量进行引用，该变量就算对应的函数退出也不会释放内存
    return func(y int) int {  //匿名函数引用了其外部作用域变量x，而x是该匿名函数外围函数adder()的局部变量
        x += y
        return x
    }
}

func main() {
    // 调用函数adder()，返回一个匿名函数，f其实就是包含闭包数据的函数
    var f = adder()    //
    fmt.Println(f(10)) //x=0,y=10 输出:10
    fmt.Println(f(20)) //x=10,y=30  输出:30
    fmt.Println(f(30)) //x=30,y=30  输出:60
}
```

https://blog.csdn.net/u010429831/article/details/108641919[闭包]

## 关键字

### 关键字make和new的区别

在官方文档中，new 函数的描述如下

```go
// The new built-in function allocates memory. The first argument is a type,
// not a value, and the value returned is a pointer to a newly
// allocated zero value of that type.
func new(Type) \*Type
```

可以看到，new 只能传递一个参数，该参数为一个任意类型，可以是Go语言内建的类型，也可以是你自定义的类型

那么 new 函数到底做了哪些事呢：

- 分配内存
- 设置零值
- 返回指针（重要）

举个例子

```go
import "fmt"

type Student struct {
name string
age int
}

func main() {
// new 一个内建类型
num := new(int)
fmt.Println(\*num) //打印零值：0

    // new 一个自定义类型
    s := new(Student)
    s.name \= "wangbm"
}
```

在官方文档中，make 函数的描述如下

```go
//The make built\-in function allocates and initializes an object
//of type slice, map, or chan (only). Like new, the first argument is
// a type, not a value. Unlike new, make's return type is the same as
// the type of its argument, not a pointer to it.
func make(t Type, size ...IntegerType) Type
```

翻译一下注释内容

1. 内建函数 make 用来为 slice，map 或 chan 类型（注意：也只能用在这三种类型上）分配内存和初始化一个对象
2. make 返回类型的本身而不是指针，而返回值也依赖于具体传入的类型，因为这三种类型就是引用类型，所以就没有必要返回他们的指针了

注意，因为这三种类型是引用类型，所以必须得初始化（size和cap），但不是置为零值，这个和new是不一样的。

举几个例子

```go
//切片
a := make(\[\]int, 2, 10)

// 字典
b := make(map\[string\]int)

// 通道
c := make(chan int, 10)
```

总结

new：为所有的类型分配内存，并初始化为零值，返回指针。

make：只能为 slice，map，chan 分配内存，并初始化，返回的是类型。

另外，目前来看 new 函数并不常用，大家更喜欢使用短语句声明的方式。

```go
a := new(int)
*a = 1
// 等价于
a := 1
```

但是 make 就不一样了，它的地位无可替代，在使用slice、map以及channel的时候，还是要使用make进行初始化，然后才可以对他们进行操作。


### struct

#### 空结构体(struct{})

- 普通理解

在结构体中，可以包裹一系列与对象相关的属性，但若该对象没有属性呢？那它就是一个空结构体。

空结构体，和正常的结构体一样，可以接收方法函数。

```go
type Lamp struct{}

func (l Lamp) On() {
        println("On")

}
func (l Lamp) Off() {
        println("Off")
}
```

- 空结构体的妙用

空结构体的表象特征，就是没有任何属性，而从更深层次的角度来说，空结构体是一个不占用空间的对象。

使用 unsafe.Sizeof 可以轻易的验证这个结果

```go
type Lamp struct{}

func main() {
    lamp := Lamp{}
    fmt.Print(unsafe.Sizeof(lamp))
}
// output: 0
```

基于这个特性，在一些特殊的场合之下，可以用做占位符使用，合理的使用空结构体，会减小程序的内存占用空间。

比如在使用信道(channel)控制并发时，我们只是需要一个信号，但并不需要传递值，这个时候，也可以使用 struct{} 代替。

```go
func main() {
    ch := make(chan struct{}, 1)
    go func() {
        <-ch
        // do something
    }()
    ch <- struct{}{}
    // ...
}
```


在 Go 语言中，使用空结构体（`struct{}`）作为通道（`chan`）的元素类型是一种常见的优化手段。这种做法主要出于以下几个原因：

1. **节省内存**
空结构体 `struct{}` 在 Go 中不占用任何内存空间（大小为 0 字节）。因此，当你需要一个通道来传递信号或同步协程时，使用空结构体可以避免不必要的内存开销。

2. **信号传递**
在某些场景下，你并不需要通过通道传递具体的数据，而只是需要一个简单的信号机制来通知其他协程某个事件已经发生。例如，用于关闭多个工作协程、通知某个操作完成等。此时，空结构体作为通道的元素类型非常合适。

3. **提高性能**
由于空结构体不占用内存，发送和接收空结构体的操作通常比发送和接收复杂数据类型的通道更快。虽然这种差异在大多数情况下是微不足道的，但在高并发或高性能要求的场景下，这些细微的优化可能会产生显著的影响。

.关闭多个工作协程
```go
package main

import (
    "fmt"
    "time"
)

func worker(id int, done chan struct{}) {
    for {
        select {
        case <-done:
            fmt.Printf("Worker %d shutting down\n", id)
            return
        default:
            fmt.Printf("Worker %d working\n", id)
            time.Sleep(500 * time.Millisecond)
        }
    }
}

func main() {
    done := make(chan struct{})
    numWorkers := 3

    // 启动多个工作协程
    for i := 1; i <= numWorkers; i++ {
        go worker(i, done)
    }

    // 模拟一些工作
    time.Sleep(2 * time.Second)

    // 发送关闭信号
    close(done)

    // 等待一段时间以确保所有工作协程都已退出
    time.Sleep(1 * time.Second)
}
```

在这个例子中，`done` 通道被用来通知所有工作协程停止工作。我们不需要通过通道传递任何实际的数据，只需要一个信号即可。

.同步操作完成
```go
package main

import (
    "fmt"
    "sync"
)

func task(id int, wg *sync.WaitGroup, done chan struct{}) {
    defer wg.Done()
    fmt.Printf("Task %d completed\n", id)
    done <- struct{}{} // 发送一个空结构体表示任务完成
}

func main() {
    var wg sync.WaitGroup
    done := make(chan struct{}, 3) // 缓冲区大小为任务数量

    for i := 1; i <= 3; i++ {
        wg.Add(1)
        go task(i, &wg, done)
    }

    // 等待所有任务完成
    go func() {
        wg.Wait()
        close(done)
    }()

    // 接收所有完成信号
    for range done {
        fmt.Println("Received completion signal")
    }

    fmt.Println("All tasks completed")
}
```

在这个例子中，每个任务完成后都会向 `done` 通道发送一个空结构体，表示任务已完成。主协程通过读取 `done` 通道中的信号来确认所有任务是否已完成。


### import

#### 包的匿名导入

`import _ "fmt` 如果导入一个包只是想执行包里面的init函数，并不想使用包里面的其他功能，这就要用到匿名导入。

#### 自己人

对于经常使用的包，可以将其当成 "自己人"，也就是使用 `import . "fmt"` 来导入，这样，在代码中就可以直接使用函数名来调用函数，而不用再使用 `fmt.Println` 的方式。

#### init

每个包都允许有一个 init 函数，当这个包被导入时，会执行该包的这个 init 函数，做一些初始化任务。

- init 函数优先于 main 函数执行
- 在一个包引用链中，包的初始化是深度优先的。比如，有这样一个包引用关系：main→A→B→C，那么初始化顺序为
- 同一个包甚至同一个源文件，可以有多个 init 函数
- init 函数不能有入参和返回值
- init 函数不能被其他函数调用
- 同一个包内的多个 init 顺序是不受保证的
- 在 init 之前，其实会先初始化包作用域的常量和变量（常量优先于变量）

#### 导入路径还是导入包

因为在go语言中，包和路径的名字通常是一样的，因此会给人一种错觉认为是按照包名导入的，其实go中是按照路径导入的，如果路径和包名不一致，那么就按照路径名导入。


#### go mod

- `go mod init` ：初始化一个go mod项目
- `go mod download`：手动出发下载依赖包到本地cache
- `go mod graph`：打印项目的模块依赖结构
- `go mod tidy`：添加缺少的包，且删除无用的包
- `go mod verify`：校验模块是否被串改过
- `go mod vendor` ：导出所有项目依赖的敖vendor下
- `go mod edit`
- `go list -m -json all`： 以json的方式打印依赖详情


https://golang.iswbm.com/c03/c03_02.html[go mod]

### chan

Go 语言之所以开始流行起来，很大一部分原因是因为它自带的并发机制。

如果说 goroutine 是 Go语言程序的并发体的话，那么 channel（信道） 就是 它们之间的通信机制。channel，是一个可以让一个 goroutine 与另一个 goroutine 传输信息的通道，我把他叫做信道，也有人将其翻译成通道，二者都是一个概念。

.通道的定义和使用
```bash
# 每个信道都只能传递一种数据类型的数据，所以在你声明的时候，你得指定数据类型（string int 等等）
var 信道实例 chan 信道类型
# 声明后的信道，其零值是nil，无法直接使用，必须配合make函进行初始化。
信道实例 = make(chan 信道类型)
# 亦或者，上面两行可以合并成一句，以下我都使用这样的方式进行信道的声明
信道实例 := make(chan 信道类型)
#信道的数据操作，无非就两种：发送数据与读取数据
#// 往信道中发送数据
pipline<- 200
#// 从信道中取出数据，并赋值给mydata
mydata := <-pipline
#信道用完了，可以对其进行关闭，避免有人一直在等待。但是你关闭信道后，接收方仍然可以从信道中取到数据，只是接收到的会永远是 0。
close(pipline)
# 当从信道中读取数据时，可以有多个返回值，其中第二个可以表示 信道是否被关闭，如果已经被关闭，ok 为 false，若还没被关闭，ok 为true。
x, ok := <-pipline
```

一般创建信道都是使用 make 函数，make 函数接收两个参数

- 第一个参数：必填，指定信道类型
- 第二个参数：选填，不填默认为0，指定信道的**容量**（可缓存多少数据）

对于信道的容量，很重要，这里要多说几点：

- 当容量为0时，说明信道中不能存放数据，在发送数据时，必须要求立马有人接收，否则会报错。此时的信道称之为**无缓冲信道**。
- 当容量为1时，说明信道只能缓存一个数据，若信道中已有一个数据，此时再往里发送数据，会造成程序阻塞。 利用这点可以利用信道来做锁。
- 当容量大于1时，信道中可以存放多个数据，可以用于多个协程之间的通信管道，共享资源。

#### 双向信道和单向信道

通常情况下，我们定义的信道都是双向通道，可发送数据，也可以接收数据。

但有时候，我们希望对信道的数据流向做一些控制，比如这个信道只能接收数据或者这个信道只能发送数据。

因此，就有了 **双向信道** 和 **单向信道** 两种分类。

**双向信道**

默认情况下你定义的信道都是双向的，比如下面代码

```go
func main() {
    pipline := make(chan int)

    go func() {
        fmt.Println("准备发送数据: 100")
        pipline <- 100
    }()

    go func() {
        num := <-pipline
        fmt.Printf("接收到的数据是: %d", num)
    }()
    // 主函数sleep，使得上面两个goroutine有机会执行
    time.Sleep(time.Second)
}
```

**单向信道**

单向信道，可以细分为 **只读信道** 和 **只写信道**。

定义只读信道

```go
var pipline = make(chan int)
type Receiver = <-chan int // 关键代码：定义别名类型
var receiver Receiver = pipline
```

定义只写信道

```go
var pipline = make(chan int)
type Sender = chan<- int  // 关键代码：定义别名类型
var sender Sender = pipline
```

仔细观察，区别在于 `<-` 符号在关键字 `chan` 的左边还是右边。

- `<-chan` 表示这个信道，只能从里发出数据，对于程序来说就是只读
- `chan<-` 表示这个信道，只能从外面接收数据，对于程序来说就是只写

有同学可能会问：为什么还要先声明一个双向信道，再定义单向通道呢？比如这样写

```go
type Sender = chan<- int
sender := make(Sender)
```

代码是没问题，但是你要明白信道的意义是什么？

信道本身就是为了传输数据而存在的，如果只有接收者或者只有发送者，那信道就变成了只入不出或者只出不入了吗，没什么用。所以只读信道和只写信道，唇亡齿寒，缺一不可。

当然了，若你往一个只读信道中写入数据 ，或者从一个只写信道中读取数据 ，都会出错。

- 遍历信道

遍历信道，可以使用 for 搭配 range关键字，在range时，需要确保程序退出信道被关闭，否则会阻塞程序。

```go

import "fmt"

func fibonacci(mychan chan int) {
n := cap(mychan)
x, y := 1, 1
for i := 0; i < n; i++ {
mychan <- x
x, y \= y, x+y
}
// 记得 close 信道
// 不然主函数中遍历完并不会结束，而是会阻塞。
close(mychan)
}

func main() {
pipline := make(chan int, 10)

    go fibonacci(pipline)

    for k := range pipline {
        fmt.Println(k)
    }
}
```

- 用信道来做锁

当信道里的数据量已经达到设定的容量时，此时再往里发送数据会阻塞整个程序，利用这个特性，可以用当他来当程序的锁。

```go
// 由于 x=x+1 不是原子操作
// 所以应避免多个协程对x进行操作
// 使用容量为1的信道可以达到锁的效果
func increment(ch chan bool, x *int) {
    ch <- true
    *x = *x + 1
    <- ch
}

func main() {
    // 注意要设置容量为 1 的缓冲信道
    // 缓存为1，那么第二次向信道发送数据时，会阻塞
    pipline := make(chan bool, 1)

    var x int
    for i:=0;i<1000;i++{
        go increment(pipline, &x)
    }

    // 确保所有的协程都已完成
    // 以后会介绍一种更合适的方法（Mutex），这里暂时使用sleep
    time.Sleep(time.Second)
    fmt.Println("x 的值：", x)
}
```

输出如下

x 的值：1000

如果不加锁，输出会小于1000。

- 信道传递是深拷贝吗

数据结构可以分为两种：

- **值类型** ：String，Array，Int，Struct，Float，Bool
- **引用类型**：Slice，Map

这两种不同的类型在拷贝的时候，在拷贝的时候效果是完全不一样的，这对于很多新手可能是一个坑。

对于值类型来说，你的每一次拷贝，Go 都会新申请一块内存空间，来存储它的值，改变其中一个变量，并不会影响另一个变量。

对于引用类型来说，你的每一次拷贝，Go 不会申请新的内存空间，而是使用它的指针，两个变量名其实都指向同一块内存空间，改变其中一个变量，会直接影响另一个变量。

介绍完深拷贝和浅拷贝后，来回来最开始的问题：**信道传递是深拷贝吗？**

答案是：**是否是深拷贝，取决于你传入的值是值类型，还是引用类型？**

- 几个注意事项

1. 关闭一个未初始化的 channel 会产生 panic
2. 重复关闭同一个 channel 会产生 panic
3. 向一个已关闭的 channel 发送消息会产生 panic
4. 从已关闭的 channel 读取消息不会产生 panic，且能读出 channel 中还未被读取的消息，若消息均已被读取，则会读取到该类型的零值。
5. 从已关闭的 channel 读取消息永远不会阻塞，并且会返回一个为 false 的值，用以判断该 channel 是否已关闭（x,ok := <- ch）
6. 关闭 channel 会产生一个广播机制，所有向 channel 读取消息的 goroutine 都会收到消息
7. channel 在 Golang 中是一等公民，它是线程安全的，面对并发问题，应首先想到 channel。

#### 万能的通道模型

- 对一个已关闭的通道，进行关闭
- 对一个已关闭的通道，写入数据

在现实场景中有时候很难知道一个通道是否已经关闭了，这个时候有以下几种做法来避免多次关闭通道导致程序崩溃。

- 有隐患且不优雅的方式

.针对一个已经关闭的通道进行关闭
```go
func SafeClose(ch chan T) (justClosed bool) {
    defer func() {
        if recover() != nil {
            // 一个函数的返回结果可以在defer调用中修改。
            justClosed = false
        }
    }()

    // 假设ch != nil。
    close(ch)   // 如果ch已关闭，则产生一个恐慌。
    return true // <=> justClosed = true; return
}
```

.针对一个已经关闭的通道进行写入数据

```go
func SafeWrite(ch chan T, data T) (justClosed bool) {
    defer func() {
        if recover() != nil {
            // 一个函数的返回结果可以在defer调用中修改。
            justClosed = false
        }
    }()

    // 假设ch != nil。
    ch <- data  // 如果ch已关闭，则产生一个恐慌。
    return true // <=> justClosed = true; return
}
```

#### 常用通道编程模型

确认下通道的特性可以发现：

- （发送者）对一个已关闭的通道，写入数据 ❌
- （接收者）对一个已关闭的通道，读取数据 ✅

那么如果能保证发送者本身知道通道是关闭的，它就不会再傻傻地往一个已关闭的通道发送数据了。

Go 语言本身没有提供类似的函数，语言层面不可行，那么就由开发者约定协议。

- 通道应当由唯一发送者关闭
- 若没有唯一发送者，则需要加“管理角色”的通道

第一点很好理解：当只有一个发送者时，他自己本身肯定是知道通道是否关闭，就不用再判断是否关闭了，自己想关闭就关闭，完全没事。

可要是没有唯一发送者呢？

这又要分两种情况了。

1. 多个发送者，一个接收者
2. 多个发送者，多个接收者

无论哪种场景，都会有数据竞争的问题。

上面我也说了，对于没有唯一发送者的方案就是加一个 “管理角色” 的通道

- 业务通道：承载数据，用于多个协程间共享数据
- 管理通道：仅为了标记业务通道是否关闭而存在

**第一个条件：具备广播功能**

那只能是无缓冲通道（关闭后，所有 read 该通道的所有协程，都能明确的知道该通道已关闭）。

- 当该管理通道关闭了，说明业务通道也关闭了。
- 当该管理通道阻塞了，说明业务通道还没关闭。

**第二个条件：有唯一发送者**

这个开发者非常容易实现：

- 对于多个发送者，一个接收者的场景，业务通道的这个接收者，就可以充当管理通道的 **唯一发送者**
- 对于多个发送者，多个接收者的场景，就需要再单独开启一个媒介协程做 **唯一发送者**

- N个发送者，一个接受者

```go
package main

import (
	"math/rand"
	"sync"
	"time"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	const Max = 100000
	const NumSenders = 1000

	wg := sync.WaitGroup{}
	wg.Add(1)

	// 业务通道
	dataCh := make(chan int)

	// 管理通道：必须是无缓冲通道
	// 其发送者是 业务通道的接收者。
	// 其接收者是 业务通道的发送者。
	stopCh := make(chan struct{})

	// 业务通道的发送者
	for i := 0; i < NumSenders; i++ {
		go func() {
			for {
				// 提前检查管理通道是否关闭
				// 让业务通道发送者早尽量退出
				select {
				case <-stopCh:
					return
				default:
				}

				select {
				case <-stopCh:
					return
				case dataCh <- rand.Intn(Max):
				}
			}
		}()
	}

	// 业务通道的接收者，亦充当管理通道的发送者
	go func() {
		defer wg.Done()

		for value := range dataCh {
			if value == 6666 {
				// 当达到某个条件时
				// 通过关闭管理通道来广播给所有业务通道的发送者
				close(stopCh)
				return
			}
		}
	}()

	wg.Wait()
}
```

- N个发送者，N个接收者

然后是多个发送者，多个接收者，这个场景需要另外开启一个媒介协程。

媒介协程的作用，很明显啊，就是充当媒介，媒介要有自己的一个媒介通道：

- 其发送者是：业务通道的所有发送者和接收者
- 其接收者是：媒介协程（是唯一的）

既然媒介协程只有一个，那自然而然地，媒介协程做为管理通道的 **唯一发送者**，再合适不过了。

还有一个非常重要的点是，媒介协程要是媒介通道的接收者，因此它要先于业务通道的所有发送者、接收者启动。

这就要求，媒介通道，必须是缓冲通道，长度可以取 1 即可。

```go
package main

import (
	"fmt"
	"math/rand"
	"strconv"
	"sync"
	"time"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	const Max = 100000
	const NumReceivers = 10
	const NumSenders = 1000

	wg := sync.WaitGroup{}
	wg.Add(NumReceivers)

	// 1. 业务通道
	dataCh := make(chan int)

	// 2. 管理通道：必须是无缓冲通道
	// 其发送者是：额外启动的管理协程
	// 其接收者是：所有业务通道的发送者。
	stopCh := make(chan struct{})

	// 3. 媒介通道：必须是缓冲通道
	// 其发送者是：业务通道的所有发送者和接收者
	// 其接收者是：媒介协程（唯一）
	toStop := make(chan string, 1)

	var stoppedBy string

	// 媒介协程
	go func() {
		stoppedBy = <-toStop
		close(stopCh)
	}()

	// 业务通道发送者
	for i := 0; i < NumSenders; i++ {
		go func(id string) {
			for {
				// 提前检查管理通道是否关闭
				// 让业务通道发送者早尽量退出
				select {
				case <-stopCh:
					return
				default:
				}

				value := rand.Intn(Max)
				select {
				case <-stopCh:
					return
				case dataCh <- value:
				}
			}
		}(strconv.Itoa(i))
	}

	// 业务通道的接收者
	for i := 0; i < NumReceivers; i++ {
		go func(id string) {
			defer wg.Done()

			for {
				// 提前检查管理通道是否关闭
				// 让业务通道接收者早尽量退出
				select {
				case <-stopCh:
					return
				default:
				}

				select {
				case <-stopCh:
					return
				case value := <-dataCh:
					// 一旦满足某个条件，就通过媒介通道发消息给媒介协程
					// 以关闭管理通道的形式，广播给所有业务通道的协程退出
					if value == 6666 {
						// 务必使用 select，两个目的：
						// 1、防止协程阻塞
						// 2、防止向已关闭的通道发送数据导致panic，因为发送者随机值可能多个发送者发送 666
						select {
						case toStop <- "接收者#" + id:
						default:
						}
						return
					}

				}
			}
		}(strconv.Itoa(i))
	}

	wg.Wait()
	fmt.Println("被" + stoppedBy + "终止了")
}
```


- 当只有一个发送者时，无论有多少接收者，业务通道都应由唯一发送者关闭。
- 当有多个发送者，一个接收者时，应借助管理通道，由业务通道唯一接收者充当管理通道的发送者，其他业务通道的发送者充当接收者
- 当有多个发送者，多个接收者时，这是最复杂的，不仅要管理通道，还要另起一个专门的媒介协程，新增一个媒介通道，但核心逻辑都是一样。


## go 读取文件的多种方式

### 直接将文件内容读入内存

直接将数据直接读取入内存，是效率最高的一种方式，但此种方式，仅适用于小文件，对于大文件，则不适合，因为比较浪费内存。

- 使用os.ReadFile

```go
func main() {
    content, err := os.ReadFile("a.txt")
    if err != nil {
        panic(err)
    }
    fmt.Println(string(content))
}
```

- 使用ioutil.ReadFile

```go
func main() {
    content, err := ioutil.ReadFile("a.txt")
    if err != nil {
        panic(err)
    }
    fmt.Println(string(content))
}
```

其实在 Go 1.16 开始，ioutil.ReadFile 就等价于 os.ReadFile，二者是完全一致的

### 创建文件句柄再读取

如果仅是读取，可以使用高级函数 os.Open

```go
func main() {
    file, err := os.Open("a.txt")  // 等价于os.OpenFile("a.txt", os.O_RDONLY, 0)
    if err != nil {
        panic(err)
    }
    defer file.Close()
    content, err := ioutil.ReadAll(file)
    fmt.Println(string(content))
}
```

### 每次只读取一行

一次性读取所有的数据，太耗费内存，因此可以指定每次只读取一行数据。方法有三种：

- bufio.ReadLine()
- bufio.ReadBytes(‘:raw-latex:`\n`’)
- bufio.ReadString(‘:raw-latex:`\n`’)

.在 bufio 的源码注释中，曾说道 bufio.ReadLine() 是低级库，不太适合普通用户使用，更推荐用户使用 bufio.ReadBytes 和 bufio.ReadString 去读取单行数据。
```go
func main() {
    // 创建句柄
    fi, err := os.Open("christmas_apple.py")
    if err != nil {
        panic(err)
    }

    // 创建 Reader
    r := bufio.NewReader(fi)

    for {
        lineBytes, err := r.ReadBytes('\n')
        line := strings.TrimSpace(string(lineBytes))
        if err != nil && err != io.EOF {
            panic(err)
        }
        if err == io.EOF {
            break
        }
        fmt.Println(line)
    }
}

func main() {
    // 创建句柄
    fi, err := os.Open("a.txt")
    if err != nil {
        panic(err)
    }

    // 创建 Reader
    r := bufio.NewReader(fi)

    for {
        line, err := r.ReadString('\n')
        line = strings.TrimSpace(line)
        if err != nil && err != io.EOF {
            panic(err)
        }
        if err == io.EOF {
            break
        }
        fmt.Println(line)
    }
}
```

### 每次只读取固定字节数

每次仅读取一行数据，可以解决内存占用过大的问题，但要注意的是，并不是所有的文件都有换行符 \n。

**使用 os 库**

通用的做法是：

- 先创建一个文件句柄，可以使用 os.Open 或者 os.OpenFile
- 然后 bufio.NewReader 创建一个 Reader
- 然后在 for 循环里调用 Reader 的 Read 函数，每次仅读取固定字节数量的数据。

```go
func main() {
    // 创建句柄
    fi, err := os.Open("a.txt")
    if err != nil {
        panic(err)
    }

    // 创建 Reader
    r := bufio.NewReader(fi)

    // 每次读取 1024 个字节
    buf := make([]byte, 1024)
    for {
        n, err := r.Read(buf)
        if err != nil && err != io.EOF {
            panic(err)
        }

        if n == 0 {
            break
        }
        fmt.Println(string(buf[:n]))
    }
}
```

- 使用 syscall 库

os 库本质上也是调用 syscall 库，但由于 syscall 过于底层，如非特殊需要，一般不会使用 syscall

```go
func main() {
    fd, err := syscall.Open("christmas_apple.py", syscall.O_RDONLY, 0)
    if err != nil {
        fmt.Println("Failed on open: ", err)
    }
    defer syscall.Close(fd)

    var wg sync.WaitGroup
    wg.Add(2)
    dataChan := make(chan []byte)
    go func() {
        defer wg.Done()
        for {
            # 因为切片是引用copy也就是浅copy，交给通道之后就需要申请新的切片
            data := make([]byte, 100)
            n, _ := syscall.Read(fd, data)
            if n == 0 {
                break
            }
            dataChan <- data
        }
        close(dataChan)
    }()

    go func() {
        defer wg.Done()
        for {
            select {
            case data, ok := <-dataChan:
                if !ok {
                    return
                }

                fmt.Printf(string(data))
            default:

            }
        }
    }()
    wg.Wait()
}
```






## go test

go test 本身可以携带很多的参数，熟悉这些参数，可以让我们的测试过程更加方便。

- 运行整个项目的测试文件 `go test`
- 只运行某个测试文件 `go test ./test/test_demo.go`
- 加 `-v` 查看详细结果 `go test -v`
- 运行某个测试函数 `go test -run="TestDemo"`，并且run支持正则匹配
- 生成test二进制文件 `go test -v -run="TestDemo -c"`
- 生成测试报告 `go test -v -run="TestDemo" -coverprofile=coverage.out`
- 执行test文件，添加 -o参数 `go test -v -o test/test_demo.test`
- 只测试安装和重新安装依赖包，而不运行代码 `go test -i`



## 基本命令

```bash
# 查看环境变量
go env
# 设置环境变量
go env -w GOPATH=/usr/loca
```

- 编译过程查看内存逃逸过程(内存从栈上逃逸到堆上)

```bash
# 查看内存逃逸分析，查看那些内存从栈上会逃逸到堆上
# 比如闭包就可以利用逃逸分析查看内存到底在栈上还是在堆上
go build -gcflags '-m -l' demo.go
# 或者再加个 -m 查看更详细信息
go build -gcflags '-m -m -l' demo.go
```

### go clean

使用go build会产生很多中间文件，手动清楚非常麻烦，因此可以使用go clean清楚这些文件

```bash
go clean main.go
```

go clean 有不少的参数：

- `-i`：清除关联的安装的包和可运行文件，也就是通过`go install`安装的文件；
- `-n`： 把需要执行的清除命令打印出来，但是不执行，这样就可以很容易的知道底层是如何运行的；
- `-r`： 循环的清除在 import 中引入的包；
- `-x`： 打印出来执行的详细命令，其实就是 -n 打印的执行版本；
- `-cache`： 删除所有`go build`命令的缓存
- `-testcache`： 删除当前包所有的测试结果

### go get

```bash
# 拉取最新
go get github.com/foo

# 最新的次要版本或者修订版本(x.y.z, z是修订版本号， y是次要版本号)
go get -u github.com/foo

# 升级到最新的修订版本
go get -u=patch github.com/foo

# 指定版本，若存在tag，则代行使用
go get github.com/foo@v1.2.3

# 指定分支
go get github.com/foo@master

# 指定git提交的hash值
go get github.com/foo@e3702bed2
```

### go install

`go install` 这个命令，如果你安装的是一个可执行文件（包名是 main），它会生成可执行文件到 bin 目录下。这点和 `go build` 很相似，不同的是，`go build` 编译生成的可执行文件放在当前目录，而 `go install` 会将可执行文件统一放至 `$GOPATH/bin` 目录下。


## 边界检查

边界检查，英文名 `Bounds Check Elimination`，简称为 BCE。它是 Go 语言中防止数组、切片越界而导致内存不安全的检查手段。如果检查下标已经越界了，就会产生 Panic。

.比如下面这段代码，会进行三次的边界检查
```go
package main

func f(s []int) {
    _ = s[0]  // 检查第一次
    _ = s[1]  // 检查第二次
    _ = s[2]  // 检查第三次
}

func main() {}
```

在编译的时候，加上参数即可查看go中进行边界检查的次数

```bash
$ go build -gcflags="-d=ssa/check_bce/debug=1" main.go
# command-line-arguments
./main.go:4:7: Found IsInBounds
./main.go:5:7: Found IsInBounds
./main.go:6:7: Found IsInBounds
```

### 边界检查的条件

并不是所有的对数组、切片进行索引操作都需要边界检查。

比如下面这个示例，就不需要进行边界检查，因为编译器根据上下文已经得知，s 这个切片的长度是多少，你的终止索引是多少，立马就能判断到底有没有越界，因此是不需要再进行边界检查，因为在编译的时候就已经知道这个地方会不会 panic。

```go
func f() {
    s := []int{1,2,3,4}
    _ = s[:9]  // 不需要边界检查
}
func main()  {}
```

因此可以得出结论，对于在编译阶段无法判断是否会越界的索引操作才会需要边界检查，比如这样子

```go
func f(s []int) {
    _ = s[:9]  // 需要边界检查
}
func main()  {}
```

### 边界检查案例

在如下示例代码中，由于索引 2 在最前面已经检查过会不会越界，因此聪明的编译器可以推断出后面的索引 0 和 1 不用再检查啦






## 编译

```bash
# 将go编译成汇编代码
go tool compile -S pkg.go
```



















## 辅助工具

### Makefile

.获取git信息
```bash
# gitTag
gitTag=$(git log --pretty=format:'%h' -n 1)

# commitID
gitCommit=$(git rev-parse --short HEAD)

# gitBranch
gitBranch=$(git rev-parse --abbrev-ref HEAD)
```

https://golang.iswbm.com/c03/c03_05.html[使用Makefile简化go项目开发流程]

.示例Makefile
```bash
BINARY="demo"
VERSION=0.0.1
BUILD=`date +%F`
SHELL := /bin/bash

versionDir="github.com/iswbm/demo/utils"
gitTag=$(shell git log --pretty=format:'%h' -n 1)
gitBranch=$(shell git rev-parse --abbrev-ref HEAD)
buildDate=$(shell TZ=Asia/Shanghai date +%FT%T%z)
gitCommit=$(shell git rev-parse --short HEAD)

ldflags="-s -w -X ${versionDir}.version=${VERSION} -X ${versionDir}.gitBranch=${gitBranch} -X '${versionDir}.gitTag=${gitTag}' -X '${versionDir}.gitCommit=${gitCommit}' -X '${versionDir}.buildDate=${buildDate}'"

default:
    @echo "build the ${BINARY}"
    @GOOS=linux GOARCH=amd64 go build -ldflags ${ldflags} -o  build/${BINARY}.linux  -tags=jsoniter
    @go build -ldflags ${ldflags} -o  build/${BINARY}.mac  -tags=jsoniter
    @echo "build done."
```




### GDB

要熟练使用 GDB ，你得熟悉的掌握它的指令，这里列举一下

- `r`：run，执行程序
- `n`：next，下一步，不进入函数
- `s`：step，下一步，会进入函数
- `b`：breakponit，设置断点
- `l`：list，查看源码
- `c`：continue，继续执行到下一断点
- `bt`：backtrace，查看当前调用栈
- `p`：print，打印查看变量
- `q`：quit，退出 GDB
- `whatis`：查看对象类型
- `info breakpoints`：查看所有的断点
- `info locals`：查看局部变量
- `info args`：查看函数的参数值及要返回的变量值
- `info frame`：堆栈帧信息
- `info goroutines`：查看 goroutines 信息。在使用前 ，需要注意先执行 source /usr/local/go/src/runtime/runtime-gdb.py
- `goroutine 1 bt`：查看指定序号的 goroutine 调用堆栈
- 回车：重复执行上一次操作

```bash
# 关闭内联优化，方便调试
$ go build -gcflags "-N -l" demo.go
# 发布版本删除调试符号
go build -ldflags “-s -w”
# 如果你喜欢这种界面的话，用这条命令
$ gdb -tui demo

# 如果你跟我一样不喜欢不习惯用界面，就使用这个命令
$ gdb demo
```

如果使用gdb有一些报错需要在gdbinit中添加如下配置来去除安全保护措施

```bash
line to your configuration file "/home/andrew/.config/gdb/gdbinit".
To completely disable this security protection add
        set auto-load safe-path /
```






## 文章



官网上的 Effective Go