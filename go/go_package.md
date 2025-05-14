
## ants



## viper


## rune

## BingCache

高性能缓存库

## zap



## gin 

*中间件进行路径重写*
```go
package main

import (
    "github.com/gin-gonic/gin"
    "strings"
)

func rewriteMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if strings.HasPrefix(c.Request.URL.Path, "/api/data") {
            // 重写请求路径为/api/v1/data
            c.Request.URL.Path = strings.Replace(c.Request.URL.Path, "/api/data", "/api/v1/data", 1)
        }
        c.Next()
    }
}

func main() {
    r := gin.Default()
    r.Use(rewriteMiddleware())

    r.GET("/api/v1/data", getDataHandler)

    r.Run(":8080")
}

func getDataHandler(c *gin.Context) {
    c.JSON(200, gin.H{"message": "Data from /api/v1/data"})
}
```




*通过设置路由器别名的方式，让多个路由指向同一个处理函数*

```go 
package main 
import ( 
	"github.com/gin-gonic/gin" 
	"net/http" ) 
	
func proxyMiddleware() gin.HandlerFunc { 
	return func(c *gin.Context) { 
		targetPath := "/api/v1/data" 
		if c.Request.URL.Path == "/api/data" { 
			http.Redirect(c.Writer, c.Request, targetPath, http.StatusPermanentRedirect) 
			c.Abort() 
			return 
		} 
		c.Next() 
	} 
} 

func main() { 
	r := gin.Default() 
	r.Use(proxyMiddleware()) 
	r.GET("/api/v1/data", getDataHandler) 
	r.Run(":8080") 
} 

func getDataHandler(c *gin.Context) { 
	c.JSON(200, gin.H{"message": "Data from /api/v1/data"}) 
}
```






