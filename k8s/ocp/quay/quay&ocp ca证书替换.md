## quay替换证书
### 证书生成
*创建CA证书（只操作一次，后面证书变更，这里不执行）-- 特别重要*
```bash
cd ~/quay-install/cert/
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -subj "/CN=quay62-podman-CA" -days 3650 -out ca.crt
```

*创建服务器证书配置文件*
```bash
cat > csr.conf << 'EOF'
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn
[ dn ]
C = CN
ST = GuangDong
L = Shenzhen
O = quay
OU = quay
CN = quay62.testocpdc2.62dc2.com
[ req_ext ]
subjectAltName = @alt_names
[ alt_names ]
DNS.1 = quay62.testocpdc2.62dc2.com
DNS.2 = quay62-podman
IP.1 = 10.161.43.96
[ v3_ext ]
authorityKeyIdentifier=keyid,issuer:always
basicConstraints=CA:FALSE
keyUsage=keyEncipherment,dataEncipherment,digitalSignature
extendedKeyUsage=serverAuth,clientAuth
subjectAltName=@alt_names
EOF
```

*签发证书*
```bash
1. `openssl genrsa -out server.key 4096`
2. `openssl req -new -key server.key -out server.csr -config csr.conf`
3. `openssl x509 -req -in server.csr \`
4. `-CA ca.crt -CAkey ca.key -CAcreateserial \`
5. `-out server.crt -days 3650 \`
6. `-extensions v3_ext -extfile csr.conf`
```

效果
```bash
1. `[root@quay62-podman cert]# ll`
2. `total 28`
3. `-rw-r--r--. 1 root root 1826 Dec 15 15:22 ca.crt #这个CA 证书，只有第一次才生成；如果后面也生成，影响很大`
4. `-rw-------. 1 root root 3272 Dec 15 15:22 ca.key`
5. `-rw-r--r--. 1 root root 41 Dec 15 15:25 ca.srl`
6. `-rw-r--r--. 1 root root 631 Dec 15 15:07 csr.conf`
7. `-rw-r--r--. 1 root root 2252 Dec 15 15:25 server.crt`
8. `-rw-r--r--. 1 root root 1915 Dec 15 15:24 server.csr`
9. `-rw-------. 1 root root 3272 Dec 15 15:24 server.key`
10. `[root@quay62-podman cert]#`
```


### 证书替换
> 操作 csr.conf 内容变更
```bash
1. `cd /var/lib/quay/quay-config`
2. `cp ~/quay-install/cert/server.key ssl.key`
3. `cp ~/quay-install/cert/server.crt ssl.cert`

4. `[root@quay62-podman quay-config]# ll`
5. `-rwxr-x---. 1 root root 2173 Dec 15 15:31 config.yaml`
6. `-rwxrwxrwx. 1 root root 2252 Dec 15 15:55 ssl.cert`
7. `-rwxrwxrwx. 1 root root 3272 Dec 15 15:55 ssl.key`
8. `[root@quay62-podman quay-config]#`
```

### 证书生效
```bash 
1. `podman pod restart quay-pod #重新启动`
2. `podman ps # 查看是否启动`
3. `podman logs -f quay-app #查看日志`
```

## ocp替换证书
### 替换证书

### 如果ca.key 内容未变，不需要操作

### ca.key 变更

#### 找到对应的ca.crt
```bash
[root@quay62-podman cert]# pwd
/root/quay-install/cert
[root@quay62-podman cert]# cat ca.crt 
-----BEGIN CERTIFICATE-----
MIIFFzCCAv+gAwIBAgIUWpiF4yQJDzNSUqtfsh0nhiFAoEkwDQYJKoZIhvcNAQEL
BQAwGzEZMBcGA1UEAwwQcXVheTYyLXBvZG1hbi1DQTAeFw0yNTEyMTUwNzIyNTha
Fw0zNTEyMTMwNzIyNThaMBsxGTAXBgNVBAMMEHF1YXk2Mi1wb2RtYW4tQ0EwggIi
MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDbWIrOxf7I5rwfA7B8ZeAo1mAY
noQ6kFxiBBhtsAuuESXs1wJjmVc9Ay7BqXGPIlG3PDldgCMULSOAE9q69b0Yg+7U
coBPLoAMKBCvVkkmSa005ok9MrjZlhhRZcolVkGw/iI4JFVtY9dtLyBg3lAnUMN4
aSxyKNUW9EUJFkaKgmqQaxbmtQQE+gt+cICJMd27LEUNvOh9/HMtydpALmxwmyVz
2uAX05xAIYhRfz3vyWlXgcNJHRSxoo496KyxkBEHzqQSpVELYXpL2t3onqyPVyaP
401/hfcxG7Mj/psb0fg4S4j/moPbsIxdzQ1cQgQeBwiundBs4LmN+e0nVMvMEDzb
GvDVFox6/UQHzVNsjcJLo6NQCMCaCv9M4XEo52WReGz9O+Ei7rET68kXUCvKBev2
fU3X3tX2nytaI25IV5/y71XQrttXu1+NzEIrs4cVWLiAyXt5cabeH4UjpKLmypgK
LZUhBxUAcwZQoBy4MKb8rGSQfrEUHXgy/WwTH440nD8vlkeRX1xbQCZG4bp9VMTJ
OlygdKf/Eo7b0fxlx7cjw3I2vcyXPfIkvNBWRHy8NYJBfwThaq0+XiHTb+56caDQ
5x3hS4KBKmzdJyb9DL3r65j9I9pk+IwcPitf5HZxo35GeN2UkBRpAFxqIuCxXbz3
d23pKiMkIO+1VfNzuwIDAQABo1MwUTAdBgNVHQ4EFgQU5lCMTaVR1YGbzBCdGeF9
oiN7Ol4wHwYDVR0jBBgwFoAU5lCMTaVR1YGbzBCdGeF9oiN7Ol4wDwYDVR0TAQH/
BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAgEAwug6bfsn7q/lhFeuosm9t71Zy2P/
XU9tIoZ1O5EnpVlBZqm85FN332wsolRM7Grq/3+zNrI/7ef57rq260J22jSy7erU
zyBAl78iuSbP0PZY3u9x2eIyQMQehV6wb30X8OZr+MemU5zYfwJYnrsV6aH0cadq
2Y7HTnCutBtAnHmY9p4R61/YxnSCezDdoPNs7NR1XUcLcb+1/r8Tc5lfHb8gxEw3
44Yp0AlXUtVER0vyiMQyp0gt6BFQDhEgSxWlML5SMU54c6vB/4eYCH+g2FZsYFmH
J9CD8fiOGgfdJPKu5cXLQ7NX5nvltReSCWimuhK4olnC06mGw128XiDwl1LVOOkK
I11R35UF7HNCE6eGgSZDw9xpFxJCNh+B8EBPuFRDf3IuxODjMjapc+bLSx6Nxf3v
swyMRrc437cw10qhkuRbis+6GH9Smgn2jsxIeww2REfu2NBNzlPx2RW4WNISGDBY
5OopZitSrOeJEaTroJLygjuwnFeGIJ0rwKbXcVL/mSITgM9KgR9pK7Bo90FCZ9b5
f5eh0Hp3qwRrnrWH/nYA/fu82zGWgAWqIij49r7WGQdRVXvUnpI153Osp8ZsKVu6
dkhPyAsQzmRp+Pflbla2pHpSbsdHRYKMQmk6mRi8bkTHQA22HE9OT7qzD/Bkgusx
TXZt/JC4lQvWwIg=
-----END CERTIFICATE-----
[root@quay62-podman cert]#
```

#### 把对应的内容更新到ocp中
配置映射—user-ca-bundle（openshift-config命名空间）—ca.crt内容添加到yaml文件后面
```bash
kind: ConfigMap
apiVersion: v1
metadata:
  name: user-ca-bundle
  namespace: openshift-config
  uid: 501ecc66-e60b-45b5-b834-05843e9af015
  resourceVersion: '596618'
  creationTimestamp: '2025-12-13T11:32:45Z'
  annotations:
    openshift.io/owning-component: End User
  managedFields:
    - manager: cluster-bootstrap
      operation: Update
      apiVersion: v1
      time: '2025-12-13T11:32:45Z'
      fieldsType: FieldsV1
      fieldsV1:
        'f:data': {}
        'f:metadata':
          'f:annotations':
            .: {}
            'f:openshift.io/owning-component': {}
    - manager: Mozilla
      operation: Update
      apiVersion: v1
      time: '2025-12-15T08:33:00Z'
      fieldsType: FieldsV1
      fieldsV1:
        'f:data':
          'f:ca-bundle.crt': {}
data:
  ca-bundle.crt: |
    -----BEGIN CERTIFICATE-----
    MIIFFzCCAv+gAwIBAgIUd27Ee+Ma3q/xfr2dZsAVNgnwB3cwDQYJKoZIhvcNAQEL
    BQAwGzEZMBcGA1UEAwwQcXVheTYyLXBvZG1hbi1DQTAeFw0yNTEyMTMxMDQzNTRa
    Fw0zNTEyMTExMDQzNTRaMBsxGTAXBgNVBAMMEHF1YXk2Mi1wb2RtYW4tQ0EwggIi
    MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC02X7QMHz6/yBkgouxsUd8j/WL
    Ebn1I8/++YJqXFzDKRz3zpAvaSY5AXCKIPR9IixhGvfr+60i8Q38WxdBh4EkSjOl
    MnX+4cjH6vxLrTWW+D3yJiYvmmpjUQXzcsoc64rxGH/WrInMU+pTQW6LtcoFdNCu
    /tnHO4uxSJZA+iiHiauGsYeTVPlVyr0RnCi6Oa9vbgBWLoGOBD9JcLKcuMpvJjgy
    ykj1n6c1sG0kox9PJ8SRu5NvfuYjrGLtqDouu5Fl8bDdierwUwrPeip0XvwE99ln
    R4uYbduyDXPnn2vyANK1RUDP/46yWVT/hhnznzP/jb/j8pBBjYNW/9CErbXm+CSW
    aaZPs5gX/Iy91EPGMi8+GerGbBkov5c6PGmJ7AvGMPEZ1LEVmKRR+qsv68/wwbdW
    H63b77VgVzk6r8sGVzMjk2AL5qXGq9HP46w+BTC2a0TtZbYqpoPSQHZMKMf7gH66
    qgH2Y4B8oCs6edVedOZTMKJ6/4OYMfNuQzRYZGvXIdpPtUQNs06E3quD/GMeugEM
    i3kTNiwI2+kiBDe4+iJcqiMYMHLGFTlzIb+KmboAXpTuGDzudI83/A7yY7XdSvwH
    S8uvQOaTuwqA0GgEerv1Zp/zHtX6OcfF1YFEzCOTYX6bmczvsz6eOp+1hiZM9A4N
    z6hwoT9OWcToxV5NAQIDAQABo1MwUTAdBgNVHQ4EFgQUrIKS05e502vZ5603fg2v
    WsceFtgwHwYDVR0jBBgwFoAUrIKS05e502vZ5603fg2vWsceFtgwDwYDVR0TAQH/
    BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAgEADYQa5QeOQj2d76HMpj8AwIN8y2t2
    aHpI7HlwMT5604FVyM/ylYUI0f3aoOa7Z9wzweTYpwYrRJq8vogmXrf7V/KD1xTo
    H6mBAySQUI//gkZ7qbWiIwpJWiSz5Q+dyAZxAuptMOVeEOjHRWMMWBDJlbqpU+Df
    bCGBY8Ux7QbAFujTEJZgODmfJtJI2TJ7CMjmKIgoBhJgO65drLbYQP4laN6Yidwr
    gAoDMEH9Pw+pPdQDud17Xf5B8rzkFHG+6pMiuvZU8lqhI880geVKnDpRuBT5t9YO
    jUnFRHz+BSqyOiXjtc560GGp3kloj00VOfsRxElZ/2Hn8Kr9Drpgulj9fkOfQ7Ce
    AzLHEo5JnCV9UdSXfN8EIDMix5K5q2JWaze9pSMRjxFRHAfZ3H0P5m/+uACUTTEq
    H0o12GRrnvabNzALGPlvugOIbj6jBpl9coZpQ+twmWMXVwm9UWO+tI7z4voZ7+at
    eW6fsdHMLEnqeYcLVy4JeRf03PipcybV94H6yDs3vidSIxc2DcjRVbQH8MCS4lCM
    Vuw87dINEv+TX82wv6jxHMUWTC+nj9RCYbuKd3aQ56LQxF3GpurQUb0sGoEohw6G
    Fi/4/aTK9CbG4b/NiJexbacuOPGXOl0ZzbV344olqmYbeGc/XdhO9pmdH0qox9O/
    U+OqiUV2IN4lCug=
    -----END CERTIFICATE-----
    -----BEGIN CERTIFICATE-----
    MIIFFzCCAv+gAwIBAgIUWpiF4yQJDzNSUqtfsh0nhiFAoEkwDQYJKoZIhvcNAQEL
    BQAwGzEZMBcGA1UEAwwQcXVheTYyLXBvZG1hbi1DQTAeFw0yNTEyMTUwNzIyNTha
    Fw0zNTEyMTMwNzIyNThaMBsxGTAXBgNVBAMMEHF1YXk2Mi1wb2RtYW4tQ0EwggIi
    MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDbWIrOxf7I5rwfA7B8ZeAo1mAY
    noQ6kFxiBBhtsAuuESXs1wJjmVc9Ay7BqXGPIlG3PDldgCMULSOAE9q69b0Yg+7U
    coBPLoAMKBCvVkkmSa005ok9MrjZlhhRZcolVkGw/iI4JFVtY9dtLyBg3lAnUMN4
    aSxyKNUW9EUJFkaKgmqQaxbmtQQE+gt+cICJMd27LEUNvOh9/HMtydpALmxwmyVz
    2uAX05xAIYhRfz3vyWlXgcNJHRSxoo496KyxkBEHzqQSpVELYXpL2t3onqyPVyaP
    401/hfcxG7Mj/psb0fg4S4j/moPbsIxdzQ1cQgQeBwiundBs4LmN+e0nVMvMEDzb
    GvDVFox6/UQHzVNsjcJLo6NQCMCaCv9M4XEo52WReGz9O+Ei7rET68kXUCvKBev2
    fU3X3tX2nytaI25IV5/y71XQrttXu1+NzEIrs4cVWLiAyXt5cabeH4UjpKLmypgK
    LZUhBxUAcwZQoBy4MKb8rGSQfrEUHXgy/WwTH440nD8vlkeRX1xbQCZG4bp9VMTJ
    OlygdKf/Eo7b0fxlx7cjw3I2vcyXPfIkvNBWRHy8NYJBfwThaq0+XiHTb+56caDQ
    5x3hS4KBKmzdJyb9DL3r65j9I9pk+IwcPitf5HZxo35GeN2UkBRpAFxqIuCxXbz3
    d23pKiMkIO+1VfNzuwIDAQABo1MwUTAdBgNVHQ4EFgQU5lCMTaVR1YGbzBCdGeF9
    oiN7Ol4wHwYDVR0jBBgwFoAU5lCMTaVR1YGbzBCdGeF9oiN7Ol4wDwYDVR0TAQH/
    BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAgEAwug6bfsn7q/lhFeuosm9t71Zy2P/
    XU9tIoZ1O5EnpVlBZqm85FN332wsolRM7Grq/3+zNrI/7ef57rq260J22jSy7erU
    zyBAl78iuSbP0PZY3u9x2eIyQMQehV6wb30X8OZr+MemU5zYfwJYnrsV6aH0cadq
    2Y7HTnCutBtAnHmY9p4R61/YxnSCezDdoPNs7NR1XUcLcb+1/r8Tc5lfHb8gxEw3
    44Yp0AlXUtVER0vyiMQyp0gt6BFQDhEgSxWlML5SMU54c6vB/4eYCH+g2FZsYFmH
    J9CD8fiOGgfdJPKu5cXLQ7NX5nvltReSCWimuhK4olnC06mGw128XiDwl1LVOOkK
    I11R35UF7HNCE6eGgSZDw9xpFxJCNh+B8EBPuFRDf3IuxODjMjapc+bLSx6Nxf3v
    swyMRrc437cw10qhkuRbis+6GH9Smgn2jsxIeww2REfu2NBNzlPx2RW4WNISGDBY
    5OopZitSrOeJEaTroJLygjuwnFeGIJ0rwKbXcVL/mSITgM9KgR9pK7Bo90FCZ9b5
    f5eh0Hp3qwRrnrWH/nYA/fu82zGWgAWqIij49r7WGQdRVXvUnpI153Osp8ZsKVu6
    dkhPyAsQzmRp+Pflbla2pHpSbsdHRYKMQmk6mRi8bkTHQA22HE9OT7qzD/Bkgusx
    TXZt/JC4lQvWwIg=
    -----END CERTIFICATE-----
```


### 接下来OCP 会自动更新配置



