# Firmware analysis

[简体中文](README.zh-CN.md)

Ghidra projects in `proj/` and exports in `out/` derive from manufacturer firmware. They are excluded from Git. Rebuild them from your own backup.

First follow [Back up firmware](../docs/PROTOCOL.md#back-up-firmware). Do not commit backups or derived output. Replace the example firmware filename below with your own `read1` file.

## Prepare symbols

Get the ROM symbols from the pinned [pvvx/THB2 revision](https://github.com/pvvx/THB2/tree/1454c2748f1fd5cff9f852173f25dc687aa292ba). Check each upstream file's license. This repository does not redistribute the manufacturer SDK. An unknown upstream license is not permission to redistribute.

```bash
mkdir -p vendor/phy-sdk
# Use a separate temporary checkout, outside this repository's history.
git clone https://github.com/pvvx/THB2.git /tmp/wuwa-thb2-source
git -C /tmp/wuwa-thb2-source checkout 1454c2748f1fd5cff9f852173f25dc687aa292ba
find /tmp/wuwa-thb2-source -name bb_rom_sym_m0.gcc
# Check the source of the matching file. Copy it to vendor/phy-sdk/.
```

## Build the Ghidra project

Run from the repository root. Homebrew installs Ghidra and its JDK dependency.

```bash
brew install ghidra
GH=$(brew --prefix ghidra)/libexec/support/analyzeHeadless
mkdir -p re/proj re/out
"$GH" re/proj app -import backup/st17h66b-flash-20261021-235341-read1.bin -overwrite \
  -loader BinaryLoader -loader-baseAddr 0x11000000 -processor ARM:LE:32:Cortex \
  -scriptPath re/ghidra -preScript PhyAppLayout.java vendor/phy-sdk/bb_rom_sym_m0.gcc \
  -postScript ExportDecomp.java re/out/app_decomp.c -analysisTimeoutPerFile 900
```

| Script | Purpose |
|---|---|
| `PhyAppLayout.java` | Read the partition table at flash `0x3000`. Map SRAM segments to their runtime addresses, import ROM symbols, and build jump tables. |
| `ExportDecomp.java` | Export application decompilation to one C file. |
| `DecompAt.java` | Create and decompile functions missed by automatic analysis, such as OSAL task entries and indirect thunk targets. |
| `DumpRange.java` | Inspect assembly where the decompiler cannot reconstruct a `switch8` jump table. |

Run the last two scripts against an existing project with `-process -noanalysis`.

## Check native-effect evidence

[Native effects](../docs/NATIVE-EFFECTS.md) records the 2026-10-24 investigation. To check the reference hash, runtime mappings, GATT/button jump targets, and the 1300 ms constant, run:

```bash
python3 re/inspect_native.py /path/to/your/read1.bin
```

The script does not write to the device or export firmware content. It rejects any hash other than the documented reference. For another firmware image, reconstruct the layout before using these addresses.

## Reference addresses

| Address | Description |
|---|---|
| `0x1fff4290` | FA02 write callback; copy to `0x1fffc343`, process about 10 ms later |
| `0x1fff6774` | Handshake comparison, checksum validation, and GATT dispatch |
| `0x1fff2fd4` | Raw RF event handler, OSAL task 10 |
| `0x1fff73c0` | Raw RF reception; filter AdvA and pass payloads to `0x1fff6b14` |
| `0x1fff6b14` | Venue payload parser |
| `0x1fff7c60` | Light-effect task, OSAL task 11 |
| `0x1fffc1cc` | RF configuration: `+0x20` format/whitening/CRC, `+0x24` CRC initial value, `+0x28` Access Address, `+0x40` frequency |

See the [function reference](../docs/FUNCTIONS.md) for meanings, evidence limits, and open questions. These are sample-specific addresses, not a stable API.
