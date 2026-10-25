"""Control a lightstick through BLE GATT. See docs/PROTOCOL.md for evidence.

First write JFKJ-20250421 to FA02. The firmware then stops its 8-second disconnect timer.
A frame contains a command, parameters, and a checksum. Its byte sum is zero modulo 256.
FA01 carries command replies. This CLI waits for startup but does not validate the echo.

  .venv/bin/python -I scripts/stick_ble.py color 255 0 0      # Red
  .venv/bin/python -I scripts/stick_ble.py color 0 0 0        # Off
  .venv/bin/python -I scripts/stick_ble.py raw 06 00          # Raw command; append checksum automatically
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
        # GATT uses GRB; venue packets use RGB. Byte 2 is unused and echoed.
        # Equal nonzero RGB selects the white channel; all zero turns the light off.
        return frame([0x01, 0x00, g, r, b])
    if argv[0] == "raw":
        return frame([int(x, 16) for x in argv[1:]])
    sys.exit(__doc__)


async def main(cmd):
    dev = await BleakScanner.find_device_by_name(NAME, timeout=15)
    if dev is None:
        sys.exit(f"Cannot find {NAME}. Check the batteries, move closer, and try again.")
    async with BleakClient(dev) as c:
        await c.start_notify(FA01, lambda _, d: print("  <-", d.hex(" ")))
        # The accepted handshake triggers three blue flashes, about 0.9 s.
        # Wait until the startup animation ends before sending the command.
        for data, wait in ((PASSWORD, 1.5), (cmd, 2.0)):
            print("->", data.hex(" "))
            await c.write_gatt_char(FA02, data)
            await asyncio.sleep(wait)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    asyncio.run(main(parse(sys.argv[1:])))
