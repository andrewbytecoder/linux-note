
## 协议

### https协议握手流程
请求的各个阶段共需要 5 个 RTT（Round-Trip Time，往返时间）[[1]](https://www.thebyte.com.cn/http/https-latency.html#footnote1) 具体为：1 RTT（DNS Lookup，域名解析）+ 1 RTT（TCP Handshake，TCP 握手）+ 2 RTT（SSL Handshake，SSL 握手）+ 1 RTT（Data Transfer，HTTP 内容传输）
![](attachments/Pasted%20image%2020250603094553.png)


### 使用 TLS1.3 协议
2018 年发布的 TLS 1.3 协议通过优化 SSL 握手过程，将握手时延缩短至 1 RTT；在复用连接的情况下，还可利用 early_data 机制实现 0 RTT
![](attachments/Pasted%20image%2020250603095427.png)
以 Nginx 配置为例，确保 Nginx 版本 ≥ 1.13.0，OpenSSL 版本 ≥ 1.1.1。然后，在配置文件中使用 ssl_protocols 指令启用 TLSv1.3 支持。

### 使用 ECC 证书
HTTPS 数字证书分为 RSA 证书和 ECC 证书，二者的区别如下：

- RSA 证书：在传统安全通信和数字签名应用中占主导地位，适用于对兼容性要求高，对性能要求不苛刻的场景。
- ECC 证书：是新一代加密算法趋势，适合移动互联网、物联网等对资源敏感的场景，以及对安全性和性能要求高的新应用。

ECC 证书的优点是加密和解密操作更快速，对计算资源需求低，也更安全。在相同安全级别下，256 位的 ECC 密钥安全性大致相当于 3072 位的 RSA 密钥。

ECC 证书的主要缺点是兼容性较弱，一些“古代”系统（如 Windows XP、Android 4.0 等）不支持。值得庆幸的是，Nginx 自 1.11.0 起支持同时配置 RSA 和 ECC 证书。在 TLS 握手时，Nginx 会根据客户端支持的密码套件（Cipher Suite）选择兼容的证书。

Nginx 双证书配置示例如下：
```nginx
server {
	listen 443 ssl;
	ssl_protocols TLSv1.2 TLSv1.3;

	# RSA 证书
	ssl_certificate  /cert/rsa/fullchain.cer;
	ssl_certificate_key  /cert/rsa/thebyte.com.cn.key;
	# ECDSA 证书
	ssl_certificate  /cert/ecc/fullchain.cer;
	ssl_certificate_key  /cert/ecc/thebyte.com.cn.key;

    # 其他 SSL 配置...
}
```
需要注意的是，配置了 ECC 证书并不意味着它一定会生效。ECC 证书的生效与客户端和服务端协商的密码套件（Cipher Suite）密切相关。
Nginx 中密码套件的相关配置如下所示：
```nginx
server {
	# 设置协商加密算法时，优先使用我们服务端的加密套件，而不是客户端浏览器的加密套件。
	ssl_prefer_server_ciphers on;
	# 配置密码套件
    ssl_ciphers 'ECDHE+CHACHA20:ECDHE+CHACHA20-draft:ECDSA+AES128:ECDHE+AES128:RSA+AES128:RSA+3DES';

    # 其他 SSL 配置...
}
```
接下来使用 openssl ciphers -V 命令查看服务端支持的密码套件，及其优先级：
```nginx
$ openssl ciphers -V 'ECDHE+CHACHA20:ECDHE+CHACHA20-draft:ECDSA+AES128:ECDHE+AES128:RSA+AES128:RSA+3DES' | column -t
0x13,0x02  -  TLS_AES_256_GCM_SHA384         TLSv1.3  Kx=any   Au=any    Enc=AESGCM(256)             Mac=AEAD
0x13,0x03  -  TLS_CHACHA20_POLY1305_SHA256   TLSv1.3  Kx=any   Au=any    Enc=CHACHA20/POLY1305(256)  Mac=AEAD
0x13,0x01  -  TLS_AES_128_GCM_SHA256         TLSv1.3  Kx=any   Au=any    Enc=AESGCM(128)             Mac=AEAD
0xCC,0xA9  -  ECDHE-ECDSA-CHACHA20-POLY1305  TLSv1.2  Kx=ECDH  Au=ECDSA  Enc=CHACHA20/POLY1305(256)  Mac=AEAD
0xCC,0xA8  -  ECDHE-RSA-CHACHA20-POLY1305    TLSv1.2  Kx=ECDH  Au=RSA    Enc=CHACHA20/POLY1305(256)  Mac=AEAD
0xC0,0x2B  -  ECDHE-ECDSA-AES128-GCM-SHA256  TLSv1.2  Kx=ECDH  Au=ECDSA  Enc=AESGCM(128)             Mac=AEAD
```