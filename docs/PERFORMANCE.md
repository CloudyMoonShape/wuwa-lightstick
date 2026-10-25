# Network measurements

[Documentation](README.md) · [简体中文](zh-CN/PERFORMANCE.md)

These are historical measurements from 2026-10-24, 20:16:23–20:16:49 UTC. One China Unicom IPv6 connection in mainland China received the production HTML in a median of **0.713 seconds**. This result describes that connection and time only. It is not a measurement of the current revision.

| Target | Successful requests | Median first byte | Median complete response | Complete response range |
|---|---:|---:|---:|---:|
| `wuwa.south-wall.com/` | 10/10 | 0.686 s | 0.713 s | 0.675–0.765 s |
| `wuwa-lightstick.pages.dev/` | 10/10 | 0.675 s | 0.699 s | 0.651–0.759 s |
| Production `/api/visitors` GET | 10/10 | 0.830 s | 0.830 s | 0.801–0.925 s |

The production connection took a median of approximately 206 ms for TCP and another 217 ms for TLS. The body took approximately 27 ms after the first byte. Cloudflare reported `loc=CN`, `colo=LAX`, and `warp=off`. These observations suggest that connection and response latency dominated that run.

The measured revision contained 103,214 uncompressed HTML bytes. Follow-up gzip responses contained 31,472 bytes. One earlier sample contained 30,648 bytes; its body was not saved, so the cause is unknown. The sample remains in the data. Four later reads, across both domains and their two IPv6 addresses, matched the local build hash.

## Method and limits

- curl 8.5.0 opened a new connection for each request. It used HTTP/1.1, gzip, certificate validation, no retries, and an eight-second timeout.
- The three targets alternated, with ten requests per target.
- IPv6 was forced. Explicit client proxies were disabled. The route was checked before the test.
- DNS caches were warm. Median DNS time was approximately 0.7 ms. System, upstream DNS, and CDN caches were not cleared.
- Counter requests used GET. They did not register test visitors. Each request opened a new connection, unlike a browser that can reuse a connection.
- The test did not cover other carriers, IPv4, other locations, or peak hours. It did not measure browser rendering, first contentful paint, largest contentful paint, or time to interaction.

See the [raw data](benchmarks/2026-10-24-cn-unicom-ipv6.json). It excludes client public addresses, browser identities, and credentials.

## Repeat the check

Use a device with a verified direct mainland China IPv6 route:

```sh
curl -6 --noproxy '*' --compressed -sS -o /dev/null \
  --connect-timeout 5 --max-time 8 \
  -w 'HTTP %{http_code}; DNS %{time_namelookup}s; first byte %{time_starttransfer}s; total %{time_total}s; body %{size_download} bytes\n' \
  https://wuwa.south-wall.com/
```

curl does not execute JavaScript, so this command does not register a visitor. Record the revision, route, carrier, time, and response sizes with new results. Use `npm run build` for the current local payload size.
