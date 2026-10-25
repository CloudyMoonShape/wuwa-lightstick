"""Construct venue broadcast bytes from static firmware analysis. See docs/PROTOCOL.md.

This script does not transmit. Ordinary phone and desktop Bluetooth APIs do not
expose the required raw radio controls. RF parameters have not been tested.
Do not transmit these packets at an event or to devices that you do not own.

  python3 -I scripts/venue_packet.py color 2 255 0 0     # Red for group 2
  python3 -I scripts/venue_packet.py preset 2 3          # Preset 3 for group 2
"""
import sys

# 64-byte table at firmware address 0x1fff8834. The final payload byte
# selects an XOR entry with its lower six bits.
XOR_TABLE = bytes.fromhex(
    "13316253c4f5a697b988dbea7d4c1f2e09c54f8a9e5bd114f93cb67367a228ed"
    "1257aef90b5ca5f21641b8ef1d4ab3e401a9fb525ff6a40dbe1745ece1481ab3")
# The analyzed filter rejects AdvA 11:11:11:11:11:11.
ADV_A = bytes.fromhex("c0ffee000001")
GROUPS = 20


def payload(cmd, group, *args):
    if not 1 <= group <= GROUPS:
        sys.exit(f"Group must be from 1 to {GROUPS}.")
    if cmd == "color":
        # Type 1: three RGB bytes per group, starting at offset 3g-1.
        # Zero values turn lights off; lower-group placeholders are not an ignore mask.
        body = bytearray(3 * group + 2)
        body[0] = 0x10
        body[3 * group - 1:3 * group + 2] = bytes(args)
    elif cmd == "preset":
        # Type 4: group g uses the preset number at offset g.
        body = bytearray(group + 1)
        body[0] = 0x40
        body[group] = args[0]
    else:
        sys.exit(__doc__)
    return bytes(body)


def scramble(body, key=0x00):
    """Append the byte-sum checksum and key byte. XOR the middle bytes.
    The key selects an obfuscation constant, not cryptographic encryption."""
    plain = body + bytes([sum(body) & 0xFF])
    x = XOR_TABLE[key & 0x3F]
    return plain[:1] + bytes(b ^ x for b in plain[1:]) + bytes([key])


def pdu(body, key=0x00):
    data = scramble(body, key)
    # Two-byte header: byte 1 is unused by the analyzed branch;
    # byte 2 gives the combined AdvA and payload length.
    return bytes([0x02, len(ADV_A) + len(data)]) + ADV_A + data


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, group, *rest = sys.argv[1:]
    print(pdu(payload(cmd, int(group), *(int(a) for a in rest))).hex(" "))
