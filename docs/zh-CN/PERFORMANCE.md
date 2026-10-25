# 网络测量

[文档](README.md) · [English](../PERFORMANCE.md)

以下为 2026-10-24 20:16:23–20:16:49 UTC 的历史测量。一条中国大陆联通 IPv6 线路接收正式首页 HTML 的中位时间为 **0.713 秒**。结果只代表当时这条线路，不代表当前版本。

| 目标 | 成功请求 | 首字节中位 | 完整接收中位 | 完整接收范围 |
|---|---:|---:|---:|---:|
| `wuwa.south-wall.com/` | 10/10 | 0.686 s | 0.713 s | 0.675–0.765 s |
| `wuwa-lightstick.pages.dev/` | 10/10 | 0.675 s | 0.699 s | 0.651–0.759 s |
| 正式域名 `/api/visitors` GET | 10/10 | 0.830 s | 0.830 s | 0.801–0.925 s |

正式域名的 TCP 建连中位约 206 ms，TLS 额外约 217 ms。首字节之后接收正文约 27 ms。Cloudflare 返回 `loc=CN`、`colo=LAX`、`warp=off`。这些记录表明，当时的主要等待来自连接与响应阶段。

当时版本的 HTML 解压后为 103,214 字节。后续 gzip 响应为 31,472 字节。早期一次样本为 30,648 字节；没有保存正文，原因未知，样本仍保留在数据中。后续对两个域名的两个 IPv6 地址共回读四次，内容哈希均匹配本地构建。

## 方法与边界

- 每次请求由 curl 8.5.0 建立新连接，使用 HTTP/1.1、gzip、证书验证、不重试和八秒超时。
- 三个目标交替请求，各十次。
- 强制 IPv6，禁用客户端显式代理，并在测试前检查路线。
- DNS 缓存已热，中位解析约 0.7 ms。没有清理系统、上游 DNS 或 CDN 缓存。
- 计数接口仅使用 GET，不登记测试访客。每次请求独立连接，不代表浏览器复用连接时的耗时。
- 未覆盖其他运营商、IPv4、其他地区或高峰期。没有测量浏览器渲染、FCP、LCP 或可交互时间。

[原始数据](../benchmarks/2026-10-24-cn-unicom-ipv6.json)不含客户端公网地址、浏览器身份或凭据。

## 复测

在已确认国内直连 IPv6 的设备上运行：

```sh
curl -6 --noproxy '*' --compressed -sS -o /dev/null \
  --connect-timeout 5 --max-time 8 \
  -w 'HTTP %{http_code}; DNS %{time_namelookup}s; first byte %{time_starttransfer}s; total %{time_total}s; body %{size_download} bytes\n' \
  https://wuwa.south-wall.com/
```

curl 不执行 JavaScript，因此不会登记访客。新测量应记录版本、路线、运营商、时间和响应体积。当前本地体积以 `npm run build` 输出为准。
