// Ghidra postScript: export application functions (SRAM and 0x1102xxxx XIP) to one C file.
// Argument: output path.
//@category PHY62xx

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

import java.io.PrintWriter;

public class ExportDecomp extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface d = new DecompInterface();
        d.openProgram(currentProgram);
        int n = 0;
        try (PrintWriter w = new PrintWriter(getScriptArgs()[0], "UTF-8")) {
            for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
                long a = f.getEntryPoint().getOffset();
                boolean app = (a >= 0x1fff0000L && a < 0x20000000L) || (a >= 0x11020000L && a < 0x11030000L);
                if (!app) continue;
                DecompileResults r = d.decompileFunction(f, 60, monitor);
                w.printf("// ===== %s @ %08x =====%n", f.getName(), a);
                w.println(r.decompileCompleted() ? r.getDecompiledFunction().getC() : "// decompile failed: " + r.getErrorMessage());
                n++;
            }
        }
        println("Decompiled functions: " + n + "");
    }
}
