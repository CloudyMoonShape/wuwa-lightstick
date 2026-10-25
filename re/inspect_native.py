"""Read-only address/constant check for the documented reference dump; no firmware included."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

REFERENCE = '8be1f64cd4b084e213e353f449ced36b8dd835e3dbcf7e6e1628f48db281182c'

def inspect(path):
    data = Path(path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != REFERENCE:
        raise ValueError('This is not the documented reference firmware; rebuild its layout before applying these addresses.')
    mappings = [(0x11000000, len(data), 0)]
    count = struct.unpack_from('<I', data, 0x3000)[0]
    for i in range(count):
        stored, runtime, size, _ = struct.unpack_from('<IIII', data, 0x3010 + i * 16)
        if runtime >> 16 == 0x1fff:
            mappings.append((runtime, size, 0x11000 + stored))
    def read(address, size):
        for runtime, length, offset in mappings:
            if runtime <= address and address + size <= runtime + length:
                return data[offset + address - runtime:offset + address - runtime + size]
        raise ValueError(f'Unmapped address: {address:#x}')
    def destinations(address, count):
        table = read(address, count + 1)
        return {f'{i:02x}':f'{(address + 1 + table[i+1] * 2) & ~1:#010x}' for i in range(count)}
    return {'sha256':digest, 'evidence':'static metadata only; no physical test',
        'gatt_dispatch':destinations(0x1fff683c,15),
        'button_dispatch':destinations(0x1fff536a,26),
        'breath_half_cycle_ms':struct.unpack('<I',read(0x1fff8068,4))[0],
        'mappings':[{'runtime':hex(a),'size':hex(n),'file_offset':hex(o)} for a,n,o in mappings]}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('firmware', type=Path)
    args=parser.parse_args()
    try:
        print(json.dumps(inspect(args.firmware), indent=2))
    except (OSError,ValueError,struct.error) as error:
        parser.exit(1, str(error)+'\n')
