// Ghidra postScript：反编译器恢复不了的地方（switch8 跳转表、没被识别成函数的 XIP 代码）直接看汇编。
// 参数：输出路径，后面跟若干项：
//   START-END  反汇编这一段并打印
//   refs:ADDR  列出引用 ADDR 的指令和所在函数
//   dis:ADDR   从 ADDR 起按控制流反汇编，不打印（给跳转表的各个分支用）
//@category PHY62xx

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.symbol.Reference;

import java.io.PrintWriter;

public class DumpRange extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        try (PrintWriter w = new PrintWriter(args[0], "UTF-8")) {
            for (int i = 1; i < args.length; i++) {
                String a = args[i];
                if (a.startsWith("refs:")) {
                    Address t = toAddr(Long.parseLong(a.substring(5), 16));
                    w.printf("## refs to %s%n", t);
                    for (Reference r : getReferencesTo(t)) {
                        Function f = getFunctionContaining(r.getFromAddress());
                        w.printf("%s %s in %s%n", r.getFromAddress(), r.getReferenceType(), f == null ? "?" : f.getName());
                    }
                    continue;
                }
                if (a.startsWith("dis:")) {
                    disassemble(toAddr(Long.parseLong(a.substring(4), 16)));
                    continue;
                }
                String[] se = a.split("-");
                Address s = toAddr(Long.parseLong(se[0], 16));
                Address e = toAddr(Long.parseLong(se[1], 16));
                disassemble(s);
                w.printf("## %s-%s%n", s, e);
                for (Instruction ins : currentProgram.getListing().getInstructions(new AddressSet(s, e), true)) {
                    StringBuilder refs = new StringBuilder();
                    for (Reference r : ins.getReferencesFrom()) {
                        refs.append(' ').append(r.getToAddress());
                        String sym = getSymbolAt(r.getToAddress()) == null ? null : getSymbolAt(r.getToAddress()).getName();
                        if (sym != null) refs.append('(').append(sym).append(')');
                    }
                    w.printf("%s  %-40s%s%n", ins.getAddress(), ins, refs);
                }
            }
        }
    }
}
