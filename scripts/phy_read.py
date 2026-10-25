"""Read the full ST17H66B flash without writing to flash.

Based on pvvx's rdwr_phy62x2.py, without its default FlashUnlock step.
That step writes 0x00 to the flash status register and changes write protection.
Read the status register, unique ID, and full flash twice; compare the hashes.
Serial and peripheral registers are initialized. Only flash writes are omitted.

Usage: .venv/bin/python -I scripts/phy_read.py /dev/cu.usbserial-0001 [baud]
       .venv/bin/python -I scripts/phy_read.py /dev/cu.usbserial-0001 115200 --peek 0x30100 0x40 20
       --peek reads SIZE bytes at flash offset ADDR, N times, and counts values.
       Use these counts to investigate differences between two backups.
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
    """Retry the handshake for up to WAIT seconds; each boot window is about 10 s.
    Disconnect all power before changing TX/RX wiring. See docs/PROTOCOL.md
    for battery and USB power options. Initialize as upstream, without FlashUnlock."""
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
            note = f"; unexpected bytes: {bytes(junk[-16:]).hex()}" if junk else ""
            print(f"  Waiting for chip response: {time.time() - t0:.0f}s{note}", flush=True)
            junk.clear()
        if time.time() - t0 > WAIT:
            sys.exit("No response after 10 minutes. Exit.")
    print("Chip Reset Ok. Response:", r, flush=True)
    if r == b"fct>>:":
        sys.exit("Chip is in FCT mode. Stop. Do not run an erase command. Keep this output for diagnosis.")
    p.baudrate = phy_mod.DEF_RUN_BAUD
    p.timeout = 0.2
    if not phy.ReadRevision():
        sys.exit("Cannot read chip revision.")
    if not phy.tg7100:
        for reg in (0x4000F054, 0x4000F140, 0x4000F144):
            if not phy.write_reg(reg, 0):
                sys.exit(f"Cannot initialize register {reg:#x}.")
    print(phy.chip, "- connected Ok", flush=True)
    phy.SetBaud(baud)


phy = phy_mod.phyflasher(port, False)

print("=" * 60)
print("Waiting for up to 10 minutes. Power-cycle the selected supply; reading starts after the chip responds.")
print("If there is no response, disconnect all power before checking P9/P10. See docs/PROTOCOL.md for wiring and power options.")
print("=" * 60, flush=True)
connect_patient(phy, baud)

st = phy.flash_read_status()
uid = phy.flash_read_unique_id()
print(f"Flash status register: {st:#04x}" if st is not None else "Flash status register: read failed")
print("Flash unique ID:", uid.hex() if uid else "read failed")
print(f"Chip: {phy.chip}  FlashID: {phy.flash_id:#x}  Capacity: {phy.flash_size // 1024} KB", flush=True)

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
            sys.exit(f"Read {n} failed. File is incomplete: {path}")
    data = open(path, "rb").read()
    digests.append(hashlib.sha256(data).hexdigest())
    print(f"Read {n}: {len(data)} bytes, {time.time() - t:.0f} seconds, sha256 {digests[-1]}", flush=True)

if digests[0] == digests[1]:
    print("The two read hashes match. This does not independently verify every flash byte.")
else:
    print("The read hashes differ. Check power and connections, then repeat the reads. The cause is not yet known.")
phy._port.close()
