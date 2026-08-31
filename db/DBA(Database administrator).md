
## How do SQL joins Work?
![[PixPin_2026-08-31_19-25-49.png]]

1. INNER JOIN(内联接)
	- 仅返回两表中完全匹配的行，交集逻辑，最常见、性能最好，过滤掉大量无效数据。
2. LEFT JOIN(左连接)
	- 返回左表全部记录+右表匹配记录；右表无匹配则填NULL。通常用于主表保留，附加扩展信息
3. RIGHT JOIN(右表连接)
	- 返回右表全部记录+左表匹配记录；左表无匹配则填写NULL。实际开发中较少使用，通常改写为LEFT JOIN(调换表顺序)
4. FULL OUTER JOIN(全外连接)
	- 返回两表中所有记录，无匹配出填写NULL，并集逻辑，常用数据比对、差异分析（注意：MySQL原生不支持，需用LEFT UNION RIGHT模拟）





























## 必读书籍



[Oracle Database 9i/10g/11g 编程艺术](https://book.douban.com/subject/5402711/)  无论是开发人员还是 DBA，它都是必读的书。
[高性能MySQL](https://book.douban.com/subject/23008813/) 这本书是 MySQL 领域的经典之作，拥有广泛的影响力。不但适合数据库管理员（DBA）阅读，也适合开发人员参考学习。