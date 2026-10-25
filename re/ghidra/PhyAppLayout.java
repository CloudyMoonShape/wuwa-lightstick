// Ghidra preScript: reconstruct the PHY6222 runtime layout from the table at 0x3000.
// Import ROM symbols. Input is the full flash image at base address 0x11000000.
// See re/README.md for usage.
//@category PHY62xx

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.lang.Register;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.symbol.SourceType;

import java.io.BufferedReader;
import java.io.FileReader;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PhyAppLayout extends GhidraScript {
    static final long FLASH = 0x11000000L;
    // SRAM segments start at flash 0x11000. Partition offsets are relative to this base.
    static final long APP_STORE = 0x11000L;

    @Override
    public void run() throws Exception {
        String symFile = getScriptArgs()[0];
        Memory mem = currentProgram.getMemory();
        byte[] flash = new byte[(int) mem.getBlock(addr(FLASH)).getSize()];
        mem.getBytes(addr(FLASH), flash);

        ByteBuffer bb = ByteBuffer.wrap(flash).order(ByteOrder.LITTLE_ENDIAN);
        int n = bb.getInt(0x3000);
        long sramEnd = 0x1fff0000L;
        for (int i = 0; i < n; i++) {
            int off = 0x3010 + i * 16;
            long src = bb.getInt(off) & 0xffffffffL;
            long run = bb.getInt(off + 4) & 0xffffffffL;
            int size = bb.getInt(off + 8);
            if ((run & 0xffff0000L) != 0x1fff0000L) {
                continue; // XIP segments are already in the flash mapping.
            }
            byte[] seg = new byte[size];
            System.arraycopy(flash, (int) (APP_STORE + src), seg, 0, size);
            if (run > sramEnd) {
                mem.createUninitializedBlock("sram_" + Long.toHexString(sramEnd), addr(sramEnd), run - sramEnd, false);
            }
            MemoryBlock b = mem.createInitializedBlock("sram_" + Long.toHexString(run), addr(run),
                    new java.io.ByteArrayInputStream(seg), size, monitor, false);
            b.setExecute(true);
            b.setWrite(true);
            sramEnd = run + size;
            println(String.format("SRAM segment %08x <- flash %08x, %d bytes", run, APP_STORE + src, size));
        }
        mem.createUninitializedBlock("sram_" + Long.toHexString(sramEnd), addr(sramEnd), 0x20000000L - sramEnd, false)
                .setWrite(true);
        MemoryBlock rom = mem.createUninitializedBlock("rom", addr(0), 0x40000, false);
        rom.setExecute(true);
        mem.createUninitializedBlock("periph", addr(0x40000000L), 0x100000, false).setVolatile(true);

        Register tmode = currentProgram.getProgramContext().getRegister("TMode");
        for (MemoryBlock b : mem.getBlocks()) {
            if (b.isExecute() || b.getStart().getOffset() == FLASH) {
                currentProgram.getProgramContext().setValue(tmode, b.getStart(), b.getEnd(), BigInteger.ONE);
            }
        }

        Pattern p = Pattern.compile("^\\s*(\\w+)\\s*=\\s*0x([0-9a-fA-F]+);");
        int count = 0;
        try (BufferedReader r = new BufferedReader(new FileReader(symFile))) {
            String line;
            while ((line = r.readLine()) != null) {
                Matcher m = p.matcher(line);
                if (!m.find()) continue;
                long a = Long.parseLong(m.group(2), 16);
                boolean code = a < 0x40000 && (a & 1) == 1;
                Address at = addr(a & ~1L);
                createLabel(at, m.group(1), true, SourceType.IMPORTED);
                if (code) createFunction(at, m.group(1));
                count++;
            }
        }
        println("ROM symbols: " + count + "");

        // Jump table: 256 function pointers at 0x1fff0000 for ROM-to-application callbacks.
        for (int i = 0; i < 256; i++) {
            long v = mem.getInt(addr(0x1fff0000L + i * 4)) & 0xffffffffL;
            if ((v & 1) == 1 && (v & 0xfff00000L) != 0) {
                Address f = addr(v & ~1L);
                if (getFunctionAt(f) == null) {
                    disassemble(f);
                    createFunction(f, "jt_" + i);
                }
            }
        }
        createLabel(addr(0x1fff0000L), "jump_table_base", true, SourceType.USER_DEFINED);
    }

    private Address addr(long a) {
        return currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(a);
    }
}
