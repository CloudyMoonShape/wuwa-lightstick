// Ghidra postScript：自动分析没认出来的函数（OSAL 任务表、thunk 间接调用的目标）在指定地址建函数并反编译，
// 顺带把它直接调用、但还不是函数的应用代码也建出来一起导出，往下追 DEPTH 层。
// 参数：输出路径，DEPTH，后面跟若干个十六进制地址
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
                    w.printf("// ===== %s: 建函数失败 =====%n", a);
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
