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

## What are the differences between WAN, LAN, PAN and MAN?

![[Pasted image 20260902100216.png]]
In the world of networking, different types of networks are defined based on their size, range, and purpose. The most common types of networks are WAN (Wide Area Network), MAN (Metropolitan Area Network), LAN (Local Area Network), and PAN (Personal Area Network).  
在计算机网络领域，根据网络的规模、覆盖范围和用途不同，可以将其分为多种类型。最常见的网络类型包括 WAN（广域网）、MAN（城域网）、LAN（局域网）和 PAN（个人区域网）。

- **Personal Area Network (PAN)  
    个人区域网络（PAN）**
    
    A PAN is a network used for communication among devices close to one person, typically within a range of a few meters.  
    PAN 是一种用于连接靠近同一人的设备的网络，通常这种连接范围在几米之内。
    
    Use Cases:  用例：
    
    - Connecting personal devices like smartphones, tablets, and wearables.  
        连接诸如智能手机、平板电脑等个人设备，以及可穿戴设备。
    - Enabling hands-free communication through Bluetooth headsets.  
        启用通过蓝牙耳机进行免提通讯的功能。
    - Synchronizing data between a computer and a smartphone.  
        在电脑和智能手机之间同步数据。
- **Local Area Network (LAN)  局域网（LAN）**
    
    A LAN is a network that connects computers and devices within a limited area such as a home, office, or building.  
    局域网是一种在有限区域内连接计算机和设备的网络，比如家庭、办公室或建筑物内部。
    
    Use Cases:  用例：
    
    - Sharing resources like printers and file servers within an office.  
        在办公室内共享诸如打印机和文件服务器这样的资源。
    - Facilitating communication and collaboration among employees.  
        促进员工之间的沟通与协作。
    - Providing internet access within a home or small business.  
        为家庭或小型企业提供互联网接入服务。
- **Metropolitan Area Network (MAN)  
    城域网络（MAN）**
    
    A MAN covers a larger geographic area than a LAN but smaller than a WAN, typically spanning a city or a large campus.  
    一个局域网覆盖的地理范围比广域网大，但比本地区域网小，通常覆盖一个城市或大型校园区域。
    
    Use Cases:  用例：
    
    - Connecting multiple campuses of a university.  
        连接一所大学的多个校区。
    - Providing high-speed internet access across a city.  
        为整个城市提供高速互联网接入服务。
    - Linking local government offices within a metropolitan area.  
        将大都市区域内的地方政府机构联系起来。
- **Wide Area Network (WAN)  广域网络（WAN）**
    
    A WAN spans a large geographic area, often a country or continent. The most prominent example of a WAN is the Internet.  
    广域网覆盖较大的地理区域，通常是一个国家或大陆。最著名的广域网例子就是互联网。
    
    Use Cases:  用例：
    
    - Connecting branch offices of multinational companies.  
        连接跨国公司的分支机构。
    - Facilitating global communication and data exchange.  
        促进全球范围内的通信和数据交换。
    - Enabling remote access to central resources.  
        启用对中央资源的远程访问。