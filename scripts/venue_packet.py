"""按固件逆向出的现场广播格式拼包（射频参数和字段含义见 README「现场广播协议」）。

只负责拼出空口要发的字节；手机和 Mac 发不了这种包（Coded PHY、非广播信道、自定义白化），
要靠能直接操纵射频的板子（如 nRF52840）发。

  python3 -I scripts/venue_packet.py color 2 255 0 0     # 分组 2 变红
  python3 -I scripts/venue_packet.py preset 2 3          # 分组 2 切到预设色 3
"""
import sys

# 固件 0x1fff8834 处的 64 字节表：载荷最后一个字节的低 6 位选其中一个字节做异或
XOR_TABLE = bytes.fromhex(
    "13316253c4f5a697b988dbea7d4c1f2e09c54f8a9e5bd114f93cb67367a228ed"
    "1257aef90b5ca5f21641b8ef1d4ab3e401a9fb525ff6a40dbe1745ece1481ab3")
# 固件丢弃 AdvA 为 11:11:11:11:11:11 的包，其他地址都收
ADV_A = bytes.fromhex("c0ffee000001")
GROUPS = 20


def payload(cmd, group, *args):
    if not 1 <= group <= GROUPS:
        sys.exit(f"分组只能是 1..{GROUPS}")
    if cmd == "color":
        # 类型 1：每组 3 字节 RGB，第 g 组从偏移 3g-1 起；全 0 = 灭
        body = bytearray(3 * group + 2)
        body[0] = 0x10
        body[3 * group - 1:3 * group + 2] = bytes(args)
    elif cmd == "preset":
        # 类型 4：第 g 组的预设色号放在偏移 g
        body = bytearray(group + 1)
        body[0] = 0x40
        body[group] = args[0]
    else:
        sys.exit(__doc__)
    return bytes(body)


def scramble(body, key=0x00):
    """body 后面补校验字节（前面所有字节之和）和密钥字节，再把中间部分整体异或。"""
    plain = body + bytes([sum(body) & 0xFF])
    x = XOR_TABLE[key & 0x3F]
    return plain[:1] + bytes(b ^ x for b in plain[1:]) + bytes([key])


def pdu(body, key=0x00):
    data = scramble(body, key)
    # 头 2 字节：第 1 字节固件不看，第 2 字节是 AdvA 加载荷的长度
    return bytes([0x02, len(ADV_A) + len(data)]) + ADV_A + data


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, group, *rest = sys.argv[1:]
    print(pdu(payload(cmd, int(group), *(int(a) for a in rest))).hex(" "))
