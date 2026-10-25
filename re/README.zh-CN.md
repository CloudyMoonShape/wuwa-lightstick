# 固件逆向

[English](README.md)
Ghidra 工程（`proj/`）和导出结果（`out/`）都由厂家固件派生，不入 git，按下面重建。

先按 [固件备份说明](../docs/zh-CN/PROTOCOL.md#备份固件) 读取自己的设备；备份和派生内容不得提交。下面的文件名是历史样机示例，替换成自己的 `read1` 文件。

ROM 符号需要自行从 [pvvx/THB2 固定提交](https://github.com/pvvx/THB2/tree/1454c2748f1fd5cff9f852173f25dc687aa292ba) 获取；查看上游各文件的许可。这里不重新分发厂家 SDK，也不把上游许可未知视为可自由再分发。

```bash
mkdir -p vendor/phy-sdk
# 在单独的临时目录获取上游，不复制进本项目历史。
git clone https://github.com/pvvx/THB2.git /tmp/wuwa-thb2-source
git -C /tmp/wuwa-thb2-source checkout 1454c2748f1fd5cff9f852173f25dc687aa292ba
find /tmp/wuwa-thb2-source -name bb_rom_sym_m0.gcc
# 将上一步找到并核对来源的 bb_rom_sym_m0.gcc 复制到 vendor/phy-sdk/。
```

```bash
brew install ghidra   # 带 JDK 依赖
GH=$(brew --prefix ghidra)/libexec/support/analyzeHeadless
mkdir -p re/proj re/out
"$GH" re/proj app -import backup/st17h66b-flash-20261021-235341-read1.bin -overwrite \
  -loader BinaryLoader -loader-baseAddr 0x11000000 -processor ARM:LE:32:Cortex \
  -scriptPath re/ghidra -preScript PhyAppLayout.java vendor/phy-sdk/bb_rom_sym_m0.gcc \
  -postScript ExportDecomp.java re/out/app_decomp.c -analysisTimeoutPerFile 900
```

`vendor/phy-sdk/` 里的 ROM 符号表来自 pvvx/THB2 同一 commit 的 SDK。

| 脚本 | 作用 |
|---|---|
| `PhyAppLayout.java` | 按 flash `0x3000` 的分区表把 SRAM 段搬到运行地址，导入 ROM 符号，建 jump table |
| `ExportDecomp.java` | 把应用代码全部反编译成一个 C 文件 |
| `DecompAt.java` | 在自动分析漏掉的地址建函数并反编译（OSAL 任务表、thunk 的间接目标） |
| `DumpRange.java` | 直接看汇编（反编译器恢复不了的 switch8 跳转表） |

后两个对已有工程跑，加 `-process -noanalysis`。

## 内置灯效调查

2026-10-24 新增 [内置能力与函数证据](../docs/zh-CN/NATIVE-EFFECTS.md)。运行 `python3 re/inspect_native.py /path/to/your/read1.bin` 可复核参考哈希、运行地址映射、GATT / 按键跳转目标和 1300 ms 常量。脚本不会写入设备，也不输出固件内容；不同哈希会拒绝沿用参考地址，需要重新分析。

## 关键地址

| 地址 | 内容 |
|---|---|
| `0x1fff4290` | FA02 写回调：数据拷进 `0x1fffc343`，10 ms 后处理 |
| `0x1fff6774` | FA02 命令处理：口令比对、校验、按命令字节分发 |
| `0x1fff2fd4` | 原始射频任务（OSAL 任务 10）事件处理 |
| `0x1fff73c0` | 原始射频收包：过滤 AdvA，载荷交给 `0x1fff6b14` |
| `0x1fff6b14` | 现场广播载荷解析 |
| `0x1fff7c60` | 灯效任务（OSAL 任务 11） |
| `0x1fffc1cc` | 射频配置结构：`+0x20` 包格式/白化/CRC、`+0x24` CRC 初值、`+0x28` Access Address、`+0x40` 频率 |

更完整的函数意义、证据分级和未确认项见 [函数目录](../docs/zh-CN/FUNCTIONS.md)。这些地址对应历史样机，不是跨版本稳定 API。
