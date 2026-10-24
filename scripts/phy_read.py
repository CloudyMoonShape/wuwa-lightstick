"""只读备份 ST17H66B 整片 flash。

基于 pvvx 的 rdwr_phy62x2.py，但去掉了它连接时默认执行的 FlashUnlock
（那一步会把 flash 状态寄存器写成 0x00，等于改了芯片上的写保护位）。
本脚本对 flash 只发读命令：读状态寄存器、读唯一 ID、逐字读整片，连读两遍比对。

用法：.venv/bin/python -I scripts/phy_read.py /dev/cu.usbserial-0001 [baud]
      .venv/bin/python -I scripts/phy_read.py /dev/cu.usbserial-0001 115200 --peek 0x30100 0x40 20
      （--peek：从 flash 偏移 ADDR 起读 SIZE 字节，重复 N 遍做多数表决，用来核对两遍备份的差异）
"""
import hashlib, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "vendor"))
import rdwr_phy62x2 as phy_mod  # noqa: E402

args = sys.argv[1:]
peek = None
if "--peek" in args:
    i = args.index("--peek")
    peek = tuple(int(x, 0) for x in args[i + 1:i + 4])
    del args[i:i + 4]
port = args[0]
baud = int(args[1]) if len(args) > 1 else 500000
out_dir = os.path.join(HERE, "..", "backup")

WAIT = 600


def connect_patient(phy, baud):
    """上游 Connect 只给约 10 秒握手窗口；这里一直发握手串直到芯片应答，
    期间随便拔插 3V、对调 TX/RX 都行。握手后的初始化照抄上游，只是不做 FlashUnlock。"""
    p = phy._port
    p.timeout = 0.04
    t0 = last = time.time()
    junk = bytearray()
    while True:
        p.write(b"UXTDWU")
        r = p.read(6)
        if r in (b"cmd>>:", b"fct>>:"):
            break
        junk += r
        if time.time() - last > 5:
            last = time.time()
            note = f"，收到杂字节 {bytes(junk[-16:]).hex()}" if junk else ""
            print(f"  …等待芯片应答 {time.time() - t0:.0f}s{note}", flush=True)
            junk.clear()
        if time.time() - t0 > WAIT:
            sys.exit("10 分钟没应答，退出")
    print("Chip Reset Ok. Response:", r, flush=True)
    if r == b"fct>>:":
        sys.exit("芯片处于 FCT 模式 —— 停下，不要执行任何擦除命令，把输出发给 Claude")
    p.baudrate = phy_mod.DEF_RUN_BAUD
    p.timeout = 0.2
    if not phy.ReadRevision():
        sys.exit("读芯片版本失败")
    if not phy.tg7100:
        for reg in (0x4000F054, 0x4000F140, 0x4000F144):
            if not phy.write_reg(reg, 0):
                sys.exit(f"初始化寄存器 {reg:#x} 失败")
    print(phy.chip, "- connected Ok", flush=True)
    phy.SetBaud(baud)


phy = phy_mod.phyflasher(port, False)

print("=" * 60)
print("监听已开始，最长等 10 分钟。拔插 3V 给芯片重新上电，芯片一应答就自动开始读")
print("没反应的话：拔 3V → 对调 P9/P10 → 再插 3V，不用重启脚本")
print("=" * 60, flush=True)
connect_patient(phy, baud)

st = phy.flash_read_status()
uid = phy.flash_read_unique_id()
print(f"Flash 状态寄存器: {st:#04x}" if st is not None else "Flash 状态寄存器: 读取失败")
print("Flash 唯一 ID:", uid.hex() if uid else "读取失败")
print(f"芯片: {phy.chip}  FlashID: {phy.flash_id:#x}  容量: {phy.flash_size // 1024} KB", flush=True)

if peek:
    import collections, struct
    off, size, rounds = peek
    votes = collections.defaultdict(collections.Counter)
    for n in range(rounds):
        for a in range(off & ~3, off + size, 4):
            v = phy.read_reg(phy_mod.PHY_FLASH_ADDR + a)
            votes[a][None if v is None else struct.pack("<I", v).hex()] += 1
    for a in sorted(votes):
        print(f"{a:#07x}", dict(votes[a]))
    phy._port.close()
    sys.exit(0)

stamp = time.strftime("%Y%m%d-%H%M%S")
digests = []
for n in (1, 2):
    path = os.path.join(out_dir, f"st17h66b-flash-{stamp}-read{n}.bin")
    t = time.time()
    with open(path, "wb") as f:
        if phy.ReadAllFlash(f) is None:
            sys.exit(f"第 {n} 遍读取出错，文件不完整: {path}")
    data = open(path, "rb").read()
    digests.append(hashlib.sha256(data).hexdigest())
    print(f"第 {n} 遍: {len(data)} 字节, {time.time() - t:.0f} 秒, sha256 {digests[-1]}", flush=True)

if digests[0] == digests[1]:
    print("✅ 两遍完全一致，备份可信")
else:
    print("⚠️ 两遍不一致，接触可能不稳，需要重读")
phy._port.close()
