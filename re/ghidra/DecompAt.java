// Ghidra postScript: create and decompile functions missed by automatic analysis
// (OSAL task entries and indirect thunk targets). Follow called functions to DEPTH.
// Arguments: output path, DEPTH, then hexadecimal addresses.
//@category PHY62xx

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;

import java.io.PrintWriter;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Set;

public class DecompAt extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        int depth = Integer.parseInt(args[1]);
        DecompInterface d = new DecompInterface();
        d.openProgram(currentProgram);
        ArrayDeque<Object[]> todo = new ArrayDeque<>();
        for (int i = 2; i < args.length; i++) {
            todo.add(new Object[]{toAddr(Long.parseLong(args[i], 16)), 0});
        }
        Set<Address> seen = new HashSet<>();
        try (PrintWriter w = new PrintWriter(args[0], "UTF-8")) {
            while (!todo.isEmpty()) {
                Object[] t = todo.poll();
                Address a = (Address) t[0];
                int lvl = (Integer) t[1];
                if (!seen.add(a)) continue;
                Function f = getFunctionAt(a);
                if (f == null) {
                    disassemble(a);
                    f = createFunction(a, null);
                }
                if (f == null) {
                    w.printf("// ===== %s: cannot create function =====%n", a);
                    continue;
                }
                DecompileResults r = d.decompileFunction(f, 60, monitor);
                w.printf("// ===== %s @ %s (depth %d) =====%n", f.getName(), a, lvl);
                w.println(r.decompileCompleted() ? r.getDecompiledFunction().getC() : "// decompile failed: " + r.getErrorMessage());
                if (lvl >= depth) continue;
                for (Function c : f.getCalledFunctions(monitor)) {
                    long o = c.getEntryPoint().getOffset();
                    if (o >= 0x11000000L) todo.add(new Object[]{c.getEntryPoint(), lvl + 1});
                }
            }
        }
    }
}
