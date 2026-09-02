### GET, POST, PUT... Common HTTP “verbs” in one figure


![[PixPin_2026-08-31_20-01-59.png]]


1. HTTP GET
	 用于获取资源
2. HTTP PUT  
    用于更新或创建资源。它是幂等的。多个相同的请求将更新同一个资源。
3. HTTP POST  
    用于创建新资源。它不是幂等的，发送两个相同的 POST 请求会导致资源被重复创建。
4. HTTP DELETE  
    用于删除资源。它是幂等的。多个相同的请求将删除同一个资源。
5. HTTP PATCH  
    PATCH 方法对资源应用部分修改。
6. HTTP HEAD  
    HEAD 方法要求的响应与 GET 请求相同，但不包含响应体。
7. HTTP CONNECT  
    CONNECT 方法建立到由目标资源标识的服务器的隧道。
8. HTTP OPTIONS  
    描述目标资源的通信选项。
9. HTTP TRACE  
    沿通往目标资源的路径执行消息回环测试。


##  Important Things About HTTP Headers
![[Pasted image 20260902100342.png]]HTTP requests are like asking for something from a server, and HTTP responses are the server’s replies. It’s like sending a message and receiving a reply.  
HTTP 请求就像是从服务器请求某些信息，而 HTTP 响应则是服务器对请求的回复。这就好比发送一条消息并等待回复一样。

An HTTP request header is an extra piece of information you include when making a request, such as what kind of data you are sending or who you are. In response headers, the server provides information about the response it is sending you, such as what type of data you’re receiving or if you have special instructions.  
HTTP 请求头是在发送请求时附加的额外信息，比如你正在发送的数据类型，或者你的身份信息等。而响应头则包含了服务器关于发送给你的响应的信息，例如你接收到的数据类型，以及是否有任何特殊的指令需要遵循。

A header serves a vital role in enabling client-server communication when building RESTful applications. In order to send the right information with their requests and interpret the server’s responses correctly, you need to understand these headers.  
在构建 RESTful 应用程序时，头文件在实现客户端与服务器的通信过程中起着至关重要的作用。为了能够正确地传递请求中的信息，并准确解读服务器的响应，你需要了解这些头文件的内容。


## How does HTTPS work?
![[Pasted image 20260902111045.png]]
Hypertext Transfer Protocol Secure (HTTPS) is an extension of the Hypertext Transfer Protocol (HTTP.) HTTPS transmits encrypted data using Transport Layer Security (TLS.) If the data is hijacked online, all the hijacker gets is binary code.

### How is the data encrypted and decrypted?

Step 1 - The client (browser) and the server establish a TCP connection.

Step 2 - The client sends a “client hello” to the server. The message contains a set of necessary encryption algorithms (cipher suites) and the latest TLS version it can support. The server responds with a “server hello” so the browser knows whether it can support the algorithms and TLS version.

The server then sends the SSL certificate to the client. The certificate contains the public key, hostname, expiry dates, etc. The client validates the certificate.

Step 3 - After validating the SSL certificate, the client generates a session key and encrypts it using the public key. The server receives the encrypted session key and decrypts it with the private key.

Step 4 - Now that both the client and the server hold the same session key (symmetric encryption), the encrypted data is transmitted in a secure bi-directional channel.

### Why does HTTPS switch to symmetric encryption during data transmission?

There are two main reasons:

- **Security:** The asymmetric encryption goes only one way. This means that if the server tries to send the encrypted data back to the client, anyone can decrypt the data using the public key.
    
- **Server resources:** The asymmetric encryption adds quite a lot of mathematical overhead. It is not suitable for data transmissions in long sessions.
    

## What is SSO (Single Sign-On)?
![[Pasted image 20260902111129.png]]

A friend recently went through the irksome experience of being signed out from a number of websites they use daily. This event will be familiar to millions of web users, and it is a tedious process to fix. It can involve trying to remember multiple long-forgotten passwords, or typing in the names of pets from childhood to answer security questions. SSO removes this inconvenience and makes life online better. But how does it work?

Basically, Single Sign-On (SSO) is an authentication scheme. It allows a user to log in to different systems using a single ID.

The diagram below illustrates how SSO works.

### How SSO Works

Step 1: A user visits Gmail, or any email service. Gmail finds the user is not logged in and so redirects them to the SSO authentication server, which also finds the user is not logged in. As a result, the user is redirected to the SSO login page, where they enter their login credentials.

Steps 2-3: The SSO authentication server validates the credentials, creates the global session for the user, and creates a token.

Steps 4-7: Gmail validates the token in the SSO authentication server. The authentication server registers the Gmail system, and returns “valid.” Gmail returns the protected resource to the user.

Step 8: From Gmail, the user navigates to another Google-owned website, for example, YouTube.

Steps 9-10: YouTube finds the user is not logged in, and then requests authentication. The SSO authentication server finds the user is already logged in and returns the token.

Steps 11-14: YouTube validates the token in the SSO authentication server. The authentication server registers the YouTube system, and returns “valid.” YouTube returns the protected resource to the user.

The process is complete and the user gets back access to their account.




## Is HTTPS Safe
![[Pasted image 20260902111536.png]]

If HTTPS is safe, how can tools like Fiddler capture network packets sent via HTTPS?

The diagram below shows a scenario where a malicious intermediate hijacks the packets.

Prerequisite: root certificate of the intermediate server is present in the trust-store.

### How Packets are Hijacked

**Step 1** - The client requests to establish a TCP connection with the server. The request is maliciously routed to an intermediate server, instead of the real backend server. Then, a TCP connection is established between the client and the intermediate server.

**Step 2** - The intermediate server establishes a TCP connection with the actual server.

**Step 3** - The intermediate server sends the SSL certificate to the client. The certificate contains the public key, hostname, expiry dates, etc. The client validates the certificate.

**Step 4** - The legitimate server sends its certificate to the intermediate server. The intermediate server validates the certificate.

**Step 5** - The client generates a session key and encrypts it using the public key from the intermediate server. The intermediate server receives the encrypted session key and decrypts it with the private key.

**Step 6** - The intermediate server encrypts the session key using the public key from the actual server and then sends it there. The legitimate server decrypts the session key with the private key.

**Steps 7 and 8** - Now, the client and the server can communicate using the session key (symmetric encryption.) The encrypted data is transmitted in a secure bi-directional channel. The intermediate server can always decrypt the data.



















