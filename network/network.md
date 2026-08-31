## OSI网咯模型

![[PixPin_2026-08-31_16-40-55.png]]

7Layers in the OSI model are:
1. Physical Layer
2. Data Link Layer
3. Network Layer
4. Transport Layer
5. Session Layer
6. Presentation Layer
7. Application Layer

## 8 Popular Network Protocols

![[PixPin_2026-08-31_19-52-18.png]]


### 1. 图中八大协议核心解读

| 协议             | 核心特征（图中定义）                         | 技术本质                                        |
| -------------- | ---------------------------------- | ------------------------------------------- |
| **HTTP**​      | Web 基础，客户端-服务器模式，用于获取 HTML 等资源。    | 应用层，请求-响应模型（REST 基石）。                       |
| **HTTP/3**​    | 基于 QUIC，使用 UDP 替代 TCP，移动端更优，VR 受益。 | 解决 TCP 队头阻塞，0-RTT 握手，极致响应速度。                |
| **HTTPS**​     | HTTP + 加密，安全通信。                    | TLS/SSL 加持，保障 API 安全（JWT/OAuth 传输载体）。       |
| **WebSocket**​ | TCP 全双工，服务端可“推送”数据（对比 REST 的“拉取”）。 | 长连接，实时通信（游戏、消息、股票）。                         |
| **TCP**​       | 确保数据包成功交付，面向连接。                    | 传输层，可靠、有序、重传机制（HTTP/WebSocket/SMTP/FTP 基础）。 |
| **UDP**​       | 无连接，不保证交付，适合时延敏感（音视频）。             | 传输层，快但不可靠，容忍丢包。                             |
| **SMTP**​      | 电子邮件传输标准。                          | 应用层，邮件投递。                                   |
| **FTP**​       | 文件传输，控制通道与数据通道分离。                  | 应用层，双连接（命令 21/数据 20）。                       |




