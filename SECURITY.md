# Security

[简体中文](SECURITY.zh-CN.md)

For a sensitive report, contact [CloudyMoonShape](https://x.com/CloudyMoonShape) privately. Do not post credentials, private device data, or an exploit against a live event in a public issue. There is no guaranteed response time.

Include the affected version, impact, and minimal steps to reproduce the issue on your own device. Redact secrets and personal data.

The lightstick handshake is a fixed protocol string, not proof of ownership. The checksum detects byte errors; it does not authenticate commands. See [protocol limits](docs/PROTOCOL.md).

The website does not distribute firmware or provide an OTA writer. Never test unknown commands against devices that belong to other people.
