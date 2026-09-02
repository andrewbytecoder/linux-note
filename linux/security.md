## Session, Cookie, JWT, Token, SSO, and OAuth 2.0 Explained
![[Pasted image 20260902110856.png]]

When you login to a website, your identity needs to be managed. Here is how different solutions work:  
当你登录一个网站时，需要确保自己的身份能够被有效管理。以下是各种解决方案的工作原理：

- **Session** - The server stores your identity and gives the browser a session ID cookie. This allows the server to track login state. But cookies don’t work well across devices.  
    会话 - 服务器会存储您的身份信息，并向浏览器发送一个会话 ID cookie。这样就能让服务器跟踪您的登录状态。不过，cookie 在不同设备上的表现并不理想。
    
- **Token** - Your identity is encoded into a token sent to the browser. The browser sends this token on future requests for authentication. No server session storage is required. But tokens need encryption/decryption.  
    令牌——您的身份信息被编码后存储在令牌中，该令牌会被发送到浏览器中。浏览器在后续的身份验证请求时会使用这个令牌。因此无需使用服务器端的会话存储功能。不过，令牌本身需要进行加密和解密处理。
    
- **JWT** - JSON Web Tokens standardize identity tokens using digital signatures for trust. The signature is contained in the token so no server session is needed.  
    JWT——JSON Web Tokens 通过数字签名来标准化身份凭证的传输方式，从而增强信任度。该签名被包含在凭证中，因此无需使用服务器会话即可进行验证。
    
- **SSO** - Single Sign On uses a central authentication service. This allows a single login to work across multiple sites.  
    单点登录（SSO）采用统一的认证服务机制。这种机制使得用户只需一次登录，就能访问多个网站。
    
- **OAuth2** - Allows limited access to your data on one site by another site, without giving away passwords.  
    OAuth2——允许一个网站对另一个网站的数据进行有限访问，而无需泄露密码。
    
- **QR Code** - Encodes a random token into a QR code for mobile login. Scanning the code logs you in without typing a password.  
    二维码——将随机生成的令牌编码成二维码，用于移动设备登录。扫描该二维码即可无需输入密码即可登录。

##  Top Network Security Cheatsheet
![[Pasted image 20260902111224.png]]

### Application Layer

- Pushing
- Malware injection
- DDoS attacks

### Presentation Layer

- Encoding/decoding vulnerabilities
- Format string attacks
- Malicious code injection

### Session Layer

- Session hijacking
- Session fixation attacks
- Brute force attacks

### Transport Layer

- Man-in-the-middle attacks
- SYN/ACK flood

### Network Layer

- IP spoofing
- Route table manipulation
- DDoS attacks

### Data Link Layer

- MAC address spoofing
- ARP spoofing
- VLAN hopping

### Physical Layer

- Wiretapping
- Physical tampering
- Electromagnetic interference


## Cookies vs Sessions vs JWT vs PASETO
![[Pasted image 20260902111427.png]]


Authentication ensures that only authorized users gain access to an application’s resources. It answers the question of the user’s identity i.e. “Who are you?”

The modern authentication landscape has multiple approaches: Cookies, Sessions, JWTs, and PASETO. Here’s what they mean:

### Cookies and Sessions

Cookies and sessions are authentication mechanisms where session data is stored on the server and referenced via a client-side cookie.

Sessions are ideal for applications requiring strict server-side control over user data. On the downside, sessions may face scalability challenges in distributed systems.

### JWT

JSON Web Token (JWT) is a stateless, self-contained authentication method that stores all user data within the token.

JWTs are highly scalable but require careful handling to mitigate the chances of token theft and manage token expiration.

### PASETO

Platform-Agnostic Security Tokens or PASETO improve upon JWT by enforcing stronger cryptographic defaults and eliminating algorithmic vulnerabilities.

PASETO simplifies token implementation by avoiding the risks associated with misconfiguration.














