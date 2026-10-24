"""通过 BLE GATT 控制应援棒（协议从固件逆向得出，见 README「GATT 控制协议」）。

连上后先往 FA02 写口令 JFKJ-20250421，棒子才会停掉 8 秒踢人计时器并接受命令；
命令帧 = 命令字节 + 参数 + 校验字节（整帧逐字节相加为 0）。棒子每收到一帧都从 FA01 通知回一帧。

  .venv/bin/python -I scripts/stick_ble.py color 255 0 0      # 红
  .venv/bin/python -I scripts/stick_ble.py color 0 0 0        # 灭
  .venv/bin/python -I scripts/stick_ble.py raw 06 00          # 任意命令，校验字节自动补
"""
import asyncio, sys

from bleak import BleakClient, BleakScanner

NAME = "JFKJ-FBFB"
FA01 = "0000fa01-0000-1000-8000-00805f9b34fb"
FA02 = "0000fa02-0000-1000-8000-00805f9b34fb"
PASSWORD = b"JFKJ-20250421"


def frame(body):
    return bytes(body) + bytes([-sum(body) & 0xFF])


def parse(argv):
    if argv[0] == "color":
        r, g, b = (int(x) for x in argv[1:4])
        # 固件的 GATT 帧按 G R B 排（现场广播是 R G B）；第 2 字节固件不用，原样回显；R=G=B 时改点白光通道
        return frame([0x01, 0x00, g, r, b])
    if argv[0] == "raw":
        return frame([int(x, 16) for x in argv[1:]])
    sys.exit(__doc__)


async def main(cmd):
    dev = await BleakScanner.find_device_by_name(NAME, timeout=15)
    if dev is None:
        sys.exit(f"没扫到 {NAME}：棒子装着电池就会广播，靠近点再试")
    async with BleakClient(dev) as c:
        await c.start_notify(FA01, lambda _, d: print("  <-", d.hex(" ")))
        # 口令通过后棒子闪 3 次蓝灯（约 0.9 s），期间每次翻转都会关掉 RGB 通道，命令要等它放完
        for data, wait in ((PASSWORD, 1.5), (cmd, 2.0)):
            print("->", data.hex(" "))
            await c.write_gatt_char(FA02, data)
            await asyncio.sleep(wait)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    asyncio.run(main(parse(sys.argv[1:])))
