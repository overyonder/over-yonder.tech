---
title: "System calls are slow. Run your code in the kernel!"
date: 2026-02-09
author: Kieran Hannigan
tags: [rust, ebpf, performance, linux]
---

# System calls are slow. Run your code in the kernel!

The status bar on my Linux desktop was using 135MB of RAM and 10% CPU. Not the applications it was monitoring -- the bar itself. The monitoring tool was a measurable load on the system it was supposed to monitor.

HyprPanel is the de facto status bar for the Hyprland compositor. It's written in TypeScript and runs on GJS -- GNOME's JavaScript runtime, which embeds the SpiderMonkey engine from Firefox. A full JavaScript engine, a GObject type system, a D-Bus session bridge, a CSS layout engine -- all running persistently to display a few numbers at the top of the screen. The process tree told the story:

```
user  318867  10.4  1.7  3467764  138444  gjs -m hyprpanel-wrapped
user  318925   0.6  0.3    47276   29636  python3 bluetooth.py
```

3.4GB virtual address space. 135MB RSS. 10% CPU. Persistent `Gjs-Console-CRITICAL` warnings. GDBus errors about missing portal interfaces. A Python subprocess for Bluetooth. For a status bar.

This is not an indictment of the people who built HyprPanel -- it's genuinely useful software, and its creator [Jas-SinghFSU](https://github.com/Jas-SinghFSU) agrees with the diagnosis. HyprPanel is now in maintenance mode, and Jas is building its successor -- [Wayle](https://github.com/Jas-SinghFSU/HyprPanel) -- entirely in Rust, noting that *"GJS (even with TypeScript) just isn't a good systems language."* The problem is the architectural norms, not the people working within them. Somewhere along the way, "desktop widget" became synonymous with "embedded web browser." We treat the desktop like it's a deployment target for web applications, and then wonder why a laptop battery lasts four hours.

A status bar reads a few integers from the kernel and renders them into a strip of pixels. It should behave like a real-time system: bounded memory, bounded latency, no garbage collection pauses, no interpreter overhead. So I switched to Waybar, which is written in C++ and renders with GTK. And then I needed a system monitor module that actually took its job seriously.

This is the story of `rstat`: a system health monitor that went from a 2-second bash script to a Rust daemon that injects its own code into the kernel.

Userland code. Running in the kernel. At ring 0 privilege. Reading scheduler data structures directly from memory as the CPU switches between tasks -- no filesystem, no syscalls, no text parsing, no heap allocations. Sub-millisecond samples.

Each stage was motivated by the same question: where is the time actually going, and can we eliminate the mechanism entirely rather than just making it faster?

<svg viewBox="0 0 750 222" xmlns="http://www.w3.org/2000/svg" class="perf-waterfall" role="img" aria-label="Performance waterfall: 2 seconds down to sub-millisecond">
  <style>
    .wf-label { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 13px; }
    .wf-time  { fill: rgba(255,255,255,0.6); font-family: 'Courier New', monospace; font-size: 12px; }
    .wf-bar   { rx: 4; ry: 4; }
  </style>
  <text x="375" y="22" text-anchor="middle" class="wf-label" font-size="15" fill="rgba(255,255,255,0.95)">Sample time per stage (log scale)</text>
  <!-- Bash: ~2000ms. log10(2000)=3.301. Bar widths = log10(val)/3.301*500 -->
  <text x="14" y="58" class="wf-label">Bash + coreutils</text>
  <rect x="220" y="44" width="500" height="22" class="wf-bar" fill="#c0392b" opacity="0.85"/>
  <text x="726" y="60" text-anchor="end" class="wf-time">~2,000 ms</text>
  <!-- Rust + /proc + powerprofilesctl: ~700ms. log10(700)/3.301*500 ≈ 431 -->
  <text x="14" y="96" class="wf-label">Rust + /proc</text>
  <rect x="220" y="82" width="431" height="22" class="wf-bar" fill="#e67e22" opacity="0.85"/>
  <text x="657" y="98" text-anchor="end" class="wf-time">~700 ms</text>
  <!-- After sysfs/byte-level parsing: ~15ms. log10(15)/3.301*500 ≈ 178 -->
  <text x="14" y="134" class="wf-label">Optimised /proc</text>
  <rect x="220" y="120" width="178" height="22" class="wf-bar" fill="#f39c12" opacity="0.85"/>
  <text x="404" y="136" text-anchor="end" class="wf-time">~15 ms</text>
  <!-- eBPF: sub-1ms. (log10(0.78)+0.5)/(3.301+0.5)*500 ≈ 52 -->
  <text x="14" y="172" class="wf-label">eBPF + zero-alloc</text>
  <rect x="220" y="158" width="52" height="22" class="wf-bar" fill="#2ecc71" opacity="0.85"/>
  <text x="278" y="174" class="wf-time">&lt;1 ms</text>
  <!-- Source note -->
  <text x="375" y="210" text-anchor="middle" class="wf-time" font-size="10">Development-time measurements. Current-system benchmarks show lower figures due to different load conditions.</text>
</svg>

---

## Stage 1: The Baseline -- Bash + Coreutils (~2 seconds)

The original implementation was a shell script invoked by Waybar's `custom` module on a polling interval. Every two or three seconds, Waybar would fork a shell, the shell would execute the script, and the script would fan out into a tree of subprocesses:

```
cat /proc/stat | awk '{...}'
cat /proc/meminfo | grep MemTotal | awk '{print $2}'
cat /proc/loadavg
bc <<< "scale=2; $used / $total * 100"
powerprofilesctl get
```

Each line is a fork+exec. `cat` opens a file, reads it, writes it to a pipe. `awk` reads from the pipe, parses the text, emits a result. `grep` does the same. `bc` spawns to perform arithmetic that the shell cannot do natively. `powerprofilesctl` spawns a process that makes a D-Bus call to query the power profile daemon.

The costs compound:

- **Process creation overhead.** Each `fork()` copies the process's page tables. Each `exec()` loads a new binary, links it, initialises its runtime. On Linux, a fork+exec cycle costs roughly 1-2ms even for trivial programs. The script spawned 10-15 of these per invocation.
- **No state between runs.** Every invocation started from scratch. No open file handles, no cached values, no deltas. CPU usage requires two readings of `/proc/stat` separated by a time interval -- the script either read it once and computed nothing meaningful, or slept internally and doubled its execution time.
- **Shell string parsing.** Every intermediate result was a string. Numbers were parsed from text, manipulated as text, formatted back to text. The shell's arithmetic capabilities are limited to integers, hence the `bc` dependency for floating-point.
- **Filesystem round-trips.** `/proc` is a virtual filesystem. Each `open()` triggers the kernel to generate the file contents on demand. Each `read()` copies them to userspace. Each `close()` tears down the file descriptor. Multiply by every metric, every subprocess, every invocation.

The polling interval was chosen not because the data changed that slowly, but to hide how slow the collection was. Even so, the script occasionally lagged Waybar's rendering, causing the status bar to display stale data or briefly blank.

This was the motivation for a rewrite: not performance for its own sake, but the observation that a status bar module should not be a measurable load on the system it monitors.

---

## Stage 2: Rust + /proc Parsing (~700ms)

The first rewrite eliminated almost every subprocess. A single Rust binary ran as a long-lived daemon, writing JSON lines to stdout. Waybar read these lines as they appeared -- no polling interval on Waybar's side, no repeated process spawning.

<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" class="diagram-proc-roundtrip" role="img" aria-label="Diagram: /proc serialisation round-trip">
  <style>
    .d-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 12px; }
    .d-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 11px; }
    .d-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 11px; font-style: italic; }
    .d-box   { fill: none; stroke: rgba(255,255,255,0.2); stroke-width: 1; rx: 6; }
    .d-arrow { stroke: rgba(168,200,160,0.6); stroke-width: 1.5; fill: none; marker-end: url(#ah); }
    .d-arrow-back { stroke: rgba(200,160,160,0.6); stroke-width: 1.5; fill: none; marker-end: url(#ah2); }
  </style>
  <defs>
    <marker id="ah" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(168,200,160,0.6)"/></marker>
    <marker id="ah2" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(200,160,160,0.6)"/></marker>
  </defs>
  <!-- Column headers -->
  <text x="140" y="20" text-anchor="middle" class="d-label" font-size="14">Userspace</text>
  <text x="520" y="20" text-anchor="middle" class="d-label" font-size="14">Kernel</text>
  <line x1="330" y1="8" x2="330" y2="190" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4,4"/>
  <!-- Row 1: open -->
  <text x="14" y="50" class="d-mono">open("/proc/123/stat")</text>
  <line x1="230" y1="46" x2="380" y2="46" class="d-arrow"/>
  <text x="390" y="50" class="d-label">allocate fd, find inode</text>
  <!-- Row 2: read -->
  <text x="14" y="80" class="d-mono">read(fd, buf, 4096)</text>
  <line x1="210" y1="76" x2="380" y2="76" class="d-arrow"/>
  <text x="390" y="80" class="d-label">walk task_struct, format</text>
  <text x="390" y="94" class="d-label">50 fields as ASCII text</text>
  <!-- Row 3: parse back -->
  <text x="14" y="120" class="d-mono">"14523 (firefox) S 1 ..."</text>
  <line x1="380" y1="116" x2="250" y2="116" class="d-arrow-back"/>
  <text x="390" y="120" class="d-dim">only need fields 14 and 15</text>
  <!-- Row 4: close -->
  <text x="14" y="148" class="d-mono">close(fd)</text>
  <line x1="120" y1="144" x2="380" y2="144" class="d-arrow"/>
  <text x="390" y="148" class="d-label">release fd</text>
  <!-- Insight -->
  <rect x="14" y="164" width="672" height="28" rx="4" fill="rgba(168,200,160,0.08)" stroke="rgba(168,200,160,0.2)"/>
  <text x="350" y="183" text-anchor="middle" class="d-dim" font-size="11">The kernel has the numbers. It formats them as text. We parse the text back. A serialisation round-trip through ASCII — per PID, per file, per sample.</text>
</svg>

The key changes:

**Direct /proc parsing.** Instead of `cat /proc/stat | awk`, the daemon opened `/proc/stat` once, kept the file descriptor, and on each tick called `lseek(fd, 0, SEEK_SET)` followed by `read()`. The kernel regenerates the virtual file contents on each read from offset 0, but the open/close overhead is eliminated. Same pattern for `/proc/meminfo`, `/proc/loadavg`.

**In-memory delta computation.** CPU usage is computed from the difference in jiffies between two samples. The daemon kept the previous sample in memory and computed deltas on each tick. No need for an external tool, no need for two reads with a sleep in between.

**Per-PID metrics via /proc/[pid]/.** For the top-process breakdown (which processes are using the most CPU, memory, IO), the daemon walked `/proc/` with `readdir()`, filtered for numeric directory names, then for each PID opened and parsed:
- `/proc/[pid]/stat` -- CPU time (utime, stime fields)
- `/proc/[pid]/statm` -- RSS in pages
- `/proc/[pid]/io` -- read_bytes, write_bytes

**serde_json for output.** The daemon serialised a struct to JSON using serde. Convenient, correct, and -- as would later become relevant -- not free.

The result was approximately 700ms per sample. Better than 2 seconds, but embarrassingly slow for a compiled binary. Profiling made the bottleneck obvious: one remaining subprocess was eating almost all of it. `powerprofilesctl get` spawns a process, connects to D-Bus, queries the power profile daemon, deserialises the response, and exits. One command, ~810ms. Everything else -- the /proc walk, the delta computation, the JSON serialisation -- fit in the remaining time.

The Rust binary wasn't slow. The single subprocess it still shelled out to was slow. The lesson was immediate: a compiled daemon that spawns one subprocess is only as fast as that subprocess.

---

## Stage 2.5: Killing the Subprocess, Then the Overhead (~15ms)

The 700ms number had one obvious cause. Eliminating `powerprofilesctl` was the first fix, and the rest followed in quick succession:

**Direct sysfs instead of D-Bus.** The power profile that `powerprofilesctl` spent ~810ms querying via D-Bus is exposed directly at `/sys/firmware/acpi/platform_profile` -- a single file read, no IPC, no subprocess. This one change dropped sample time from ~700ms to ~28ms. The entire 700ms was one subprocess.

**Reusable read buffers.** The initial implementation allocated a new `String` for each `/proc/[pid]/*` read. With 300+ PIDs and 3 files each, that was ~900 allocations and deallocations per sample. Switching to a single stack-allocated `[u8; 8192]` buffer reused across all reads eliminated the allocation overhead entirely.

**Skipping kernel threads.** Not all PIDs in `/proc` are userspace processes. Kernel threads (kworkers, ksoftirqd, migration threads) have no meaningful CPU, memory, or IO stats for a desktop status bar. Filtering them out -- by checking whether the virtual size is zero in `/proc/[pid]/stat` -- cut the PID count roughly in half and avoided unnecessary IO reads for 250+ PIDs.

**Byte-level /proc parsing.** The initial parser used Rust's `str::split()` and `parse::<u64>()` on each `/proc/[pid]/stat` line. Replacing this with a hand-rolled byte scanner that walks the buffer once -- skipping fields by counting spaces, converting digits inline -- cut the parsing cost substantially.

After these changes, the sample time dropped to around 15ms on a typical desktop. The remaining cost was the /proc walk itself -- still hundreds of syscalls for the per-PID breakdown, each one a serialisation round-trip through ASCII text.

---

## Stage 3: Eliminating /proc Walks Entirely (sub-1ms)

### The /proc problem

<svg viewBox="0 0 600 170" xmlns="http://www.w3.org/2000/svg" class="diagram-syscall-cost" role="img" aria-label="Diagram: /proc syscall cost multiplier">
  <style>
    .sc-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 13px; }
    .sc-num   { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; }
    .sc-op    { fill: rgba(255,255,255,0.6); font-family: 'Lora', serif; font-size: 18px; }
    .sc-box   { fill: rgba(0,0,0,0.25); stroke: rgba(255,255,255,0.15); stroke-width: 1; rx: 8; }
    .sc-res   { fill: rgba(168,200,160,0.12); stroke: rgba(168,200,160,0.3); stroke-width: 1; rx: 8; }
    .sc-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 11px; font-style: italic; }
  </style>
  <!-- 3 files -->
  <rect x="20" y="15" width="120" height="65" class="sc-box"/>
  <text x="80" y="42" text-anchor="middle" class="sc-num">3</text>
  <text x="80" y="62" text-anchor="middle" class="sc-label">files/PID</text>
  <!-- × -->
  <text x="162" y="52" text-anchor="middle" class="sc-op">×</text>
  <!-- 300 PIDs -->
  <rect x="182" y="15" width="120" height="65" class="sc-box"/>
  <text x="242" y="42" text-anchor="middle" class="sc-num">300</text>
  <text x="242" y="62" text-anchor="middle" class="sc-label">PIDs</text>
  <!-- = -->
  <text x="324" y="52" text-anchor="middle" class="sc-op">=</text>
  <!-- 2700 syscalls -->
  <rect x="344" y="15" width="240" height="65" class="sc-res"/>
  <text x="464" y="42" text-anchor="middle" class="sc-num">2,700</text>
  <text x="464" y="62" text-anchor="middle" class="sc-label">syscalls (open + read + close)</text>
  <!-- Annotation -->
  <text x="300" y="110" text-anchor="middle" class="sc-dim">Each syscall = context switch to kernel mode.</text>
  <text x="300" y="128" text-anchor="middle" class="sc-dim">Each read = kernel formats ASCII text we immediately parse back into numbers.</text>
  <text x="300" y="146" text-anchor="middle" class="sc-dim">Each close = teardown of fd we'll just reopen next sample.</text>
</svg>

Walking `/proc` for per-PID metrics is expensive because it is fundamentally a filesystem operation. For each PID:

1. `opendir("/proc")` -- one syscall
2. `readdir()` in a loop -- one syscall per batch of directory entries, hundreds of entries on a running system
3. Filter for numeric names (PIDs) -- string parsing in userspace
4. For each PID, `open("/proc/[pid]/stat")` -- one syscall
5. `read()` the contents -- one syscall, plus the kernel formats ~50 fields into a text buffer
6. `close()` -- one syscall
7. Parse the text to extract the 2-3 fields we actually need -- string scanning in userspace
8. Repeat for `/proc/[pid]/statm` and `/proc/[pid]/io` -- 6 more syscalls per PID

With 200-400 PIDs on a typical desktop, that is 1,500-3,000+ syscalls just for the per-process breakdown. Each syscall is a context switch to kernel mode, and each `/proc` read triggers the kernel to walk its internal data structures and format the results into human-readable text that we immediately parse back into numbers. The entire /proc interface is a serialisation-deserialisation round-trip through ASCII text.

### eBPF: reading kernel data in-kernel

The solution was to move the data collection into the kernel itself using eBPF. A BPF program attached to the `sched_switch` tracepoint fires every time the scheduler switches between tasks. At that moment, the kernel has the outgoing task's `task_struct` right there -- its PID, its accumulated CPU time, its memory maps, its IO accounting. Instead of asking the kernel to format this data into text files and then parsing it back, the BPF program reads the values directly from the kernel's data structures and writes them into a BPF hash map.

<svg viewBox="0 0 620 340" xmlns="http://www.w3.org/2000/svg" class="diagram-ebpf-rings" role="img" aria-label="Diagram: eBPF privilege rings — sandboxed code running inside the kernel">
  <style>
    .ring-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 13px; }
    .ring-title { fill: rgba(255,255,255,0.95); font-family: 'Lora', serif; font-size: 14px; font-weight: bold; }
    .ring-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 11px; }
    .ring-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 11px; font-style: italic; }
  </style>
  <!-- Ring 0 outer box -->
  <rect x="10" y="10" width="600" height="230" rx="12" fill="rgba(39,174,96,0.06)" stroke="rgba(39,174,96,0.3)" stroke-width="1.5"/>
  <text x="30" y="36" class="ring-title">Ring 0 (Kernel)</text>
  <!-- eBPF sandbox -->
  <rect x="30" y="50" width="260" height="130" rx="8" fill="rgba(46,204,113,0.08)" stroke="rgba(46,204,113,0.4)" stroke-width="1" stroke-dasharray="6,3"/>
  <text x="50" y="74" class="ring-label" font-weight="600">eBPF Sandbox</text>
  <text x="50" y="96" class="ring-mono">• Verified bytecode</text>
  <text x="50" y="114" class="ring-mono">• Can't crash the kernel</text>
  <text x="50" y="132" class="ring-mono">• Bounded execution time</text>
  <text x="50" y="150" class="ring-mono">• Direct struct access</text>
  <text x="50" y="168" class="ring-mono">• No text serialisation</text>
  <!-- Data structures -->
  <text x="340" y="74" class="ring-mono">task_struct →</text>
  <text x="340" y="96" class="ring-mono">mm_struct   →</text>
  <text x="340" y="118" class="ring-mono">task->ioac  →</text>
  <!-- Arrows from data to sandbox -->
  <line x1="330" y1="70" x2="295" y2="90" stroke="rgba(46,204,113,0.3)" stroke-width="1"/>
  <line x1="330" y1="92" x2="295" y2="110" stroke="rgba(46,204,113,0.3)" stroke-width="1"/>
  <line x1="330" y1="114" x2="295" y2="130" stroke="rgba(46,204,113,0.3)" stroke-width="1"/>
  <!-- BPF maps bridge -->
  <text x="160" y="210" text-anchor="middle" class="ring-mono">↕ BPF maps (shared memory)</text>
  <!-- Divider -->
  <line x1="10" y1="240" x2="610" y2="240" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <!-- Ring 3 -->
  <rect x="10" y="240" width="600" height="90" rx="12" fill="rgba(52,152,219,0.06)" stroke="rgba(52,152,219,0.25)" stroke-width="1.5"/>
  <text x="30" y="268" class="ring-title">Ring 3 (Userspace)</text>
  <text x="50" y="292" class="ring-mono">rstat daemon</text>
  <text x="50" y="310" class="ring-label">• Single batch read of BPF map  • No /proc  • No text parsing</text>
  <!-- Insight box -->
  <rect x="310" y="256" width="285" height="60" rx="6" fill="rgba(168,200,160,0.08)" stroke="rgba(168,200,160,0.2)"/>
  <text x="320" y="276" class="ring-dim">Instead of asking the kernel to format data</text>
  <text x="320" y="292" class="ring-dim">into text files, send a verified program into</text>
  <text x="320" y="308" class="ring-dim">the kernel. It reads structs directly.</text>
</svg>

eBPF is not a hack or a backdoor. It's a formally verified sandbox -- the kernel's verifier proves the program can't crash, loop forever, or access memory it shouldn't. It's the kernel giving you a supervised desk in its office.

**The custom BPF loader.** The standard approach would be to use aya or libbpf-rs, high-level frameworks that handle ELF parsing, map creation, relocation, and program loading. These were tried and discarded. aya pulls in tokio (an async runtime), libbpf-rs pulls in libbpf-sys with its own C build step. Both add hundreds of milliseconds to startup time and megabytes to binary size. For a program that loads a single tracepoint probe with three maps, this is absurd.

Instead, `rstat` implements its own loader in ~100 lines of Rust:

- Parse the BPF ELF object with `goblin` (a pure-Rust ELF parser, no C dependencies)
- Create maps via the raw `bpf(BPF_MAP_CREATE, ...)` syscall
- Resolve relocations by matching symbol names to map file descriptors and patching `LD_IMM64` instructions
- Load programs via `bpf(BPF_PROG_LOAD, ...)`
- Attach via `perf_event_open` + `ioctl(PERF_EVENT_IOC_SET_BPF)` + `ioctl(PERF_EVENT_IOC_ENABLE)`

One subtlety: `PERF_EVENT_IOC_SET_BPF` only needs to be called on a single CPU's perf event fd (CPU 0). The kernel's `tp_event` is shared -- the BPF program fires system-wide regardless of which CPU's fd was used for attachment. `PERF_EVENT_IOC_ENABLE`, however, must be called on every CPU's fd to actually enable the tracepoint event on each CPU. This was discovered empirically after initially attaching to all CPUs and getting duplicate firings.

### What was tried and discarded: block_rq_issue for IO

The initial approach was to collect all three per-PID metrics (CPU, memory, IO) entirely within BPF. CPU time was straightforward via `sched_switch`. For IO, the `block_rq_issue` tracepoint looked promising -- it fires when the block layer issues an IO request.

The problem: PID attribution in the block layer is unreliable. `block_rq_issue` fires from interrupt or kernel worker context, not from the process that initiated the IO. `bpf_get_current_pid_tgid()` returns whichever PID happens to be running on that CPU when the block request is submitted, which may be a kworker thread, the block device's IRQ handler, or a completely unrelated process. The resulting per-PID IO stats were essentially random.

This was discarded. IO collection stayed with `/proc/[pid]/io` and delta tracking in userspace.

### The empty comm field problem

When the BPF map contained entries created by the (now-discarded) block layer path, some PIDs had all-zero `comm` fields because `bpf_get_current_comm()` was returning the kernel worker's name rather than the originating process. Even after removing the block layer tracepoint, this pattern served as a reminder: always validate BPF-collected data and implement fallbacks. The daemon fell back to reading `/proc/[pid]/comm` when a BPF entry's comm was all zeroes.

The initial approach for IO -- using the `block_rq_issue` tracepoint -- was tried and discarded. But collecting all three metrics (CPU, RSS, IO) directly from `task_struct` fields within the `sched_switch` probe worked cleanly.

<svg viewBox="0 0 580 220" xmlns="http://www.w3.org/2000/svg" class="diagram-sched-switch" role="img" aria-label="Diagram: sched_switch tracepoint firing on context switch">
  <style>
    .ss-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 12px; }
    .ss-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 11px; }
    .ss-title { fill: rgba(255,255,255,0.95); font-family: 'Lora', serif; font-size: 13px; font-weight: bold; }
    .ss-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 11px; font-style: italic; }
    .ss-box   { fill: rgba(0,0,0,0.2); stroke: rgba(255,255,255,0.15); rx: 6; }
    .ss-arr   { stroke: rgba(168,200,160,0.5); stroke-width: 1.5; fill: none; marker-end: url(#ssa); }
  </style>
  <defs><marker id="ssa" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(168,200,160,0.5)"/></marker></defs>
  <!-- Step 1 -->
  <rect x="10" y="10" width="250" height="36" class="ss-box"/>
  <text x="135" y="33" text-anchor="middle" class="ss-title">CPU running Task A → switch to B</text>
  <line x1="135" y1="46" x2="135" y2="68" class="ss-arr"/>
  <!-- Step 2 -->
  <rect x="50" y="70" width="170" height="30" rx="6" fill="rgba(46,204,113,0.1)" stroke="rgba(46,204,113,0.3)"/>
  <text x="135" y="90" text-anchor="middle" class="ss-mono">sched_switch fires</text>
  <line x1="135" y1="100" x2="135" y2="118" class="ss-arr"/>
  <!-- Step 3: BPF reads -->
  <rect x="20" y="120" width="240" height="60" class="ss-box"/>
  <text x="35" y="138" class="ss-label">BPF probe reads outgoing task's:</text>
  <text x="45" y="156" class="ss-mono">• cpu_ns  • mm→rss_stat  • task→ioac</text>
  <line x1="260" y1="150" x2="320" y2="150" class="ss-arr"/>
  <!-- Step 4: Map write -->
  <rect x="325" y="130" width="240" height="40" rx="6" fill="rgba(46,204,113,0.08)" stroke="rgba(46,204,113,0.3)"/>
  <text x="445" y="155" text-anchor="middle" class="ss-mono">writes to BPF map[pid]</text>
  <!-- Insight -->
  <rect x="10" y="192" width="560" height="22" rx="4" fill="rgba(168,200,160,0.08)" stroke="rgba(168,200,160,0.2)"/>
  <text x="290" y="208" text-anchor="middle" class="ss-dim">Every task eventually gets switched out. At that moment, all its accounting data is right there in the task_struct.</text>
</svg>

### RSS from mm->rss_stat

When the BPF probe fires on `sched_switch`, the current task's `task_struct` is available via `bpf_get_current_task()`. The task's memory descriptor (`task->mm`) contains `rss_stat`, an array of `percpu_counter` structs indexed by memory type:

- Index 0: file-backed pages (page cache)
- Index 1: anonymous pages (heap, stack)
- Index 2: swap entries
- Index 3: shared memory pages

RSS is the sum of indices 0, 1, and 3. The BPF probe reads the `.count` field of each `percpu_counter`, which is the approximate value. The exact value would require summing the per-CPU delta arrays (`percpu_counter->counters[cpu]`), but BPF cannot iterate over per-CPU data. The approximate value has a maximum error of `batch * num_cpus` (where `batch` is typically 32), giving an accuracy of +/-128KB on a 4-core system. For a status bar, this is more than sufficient.

```c
static __always_inline void snapshot_task(struct pid_stats *s)
{
    struct task_struct *task = (void *)bpf_get_current_task();
    struct mm_struct *mm = 0;
    bpf_probe_read_kernel(&mm, sizeof(mm), &task->mm);
    if (mm) {
        __s64 file = 0, anon = 0, shm = 0;
        bpf_probe_read_kernel(&file, sizeof(file), &mm->rss_stat[0].count);
        bpf_probe_read_kernel(&anon, sizeof(anon), &mm->rss_stat[1].count);
        bpf_probe_read_kernel(&shm,  sizeof(shm),  &mm->rss_stat[3].count);
        __s64 total = file + anon + shm;
        s->rss_pages = total > 0 ? (__u64)total : 0;
    }
    // ...
}
```

### IO from task->ioac

The task accounting structure (`task->ioac`) contains cumulative `read_bytes` and `write_bytes` counters -- the same values exposed via `/proc/[pid]/io`. Reading them directly in the BPF probe eliminates the filesystem entirely:

```c
    __u64 rb = 0, wb = 0;
    bpf_probe_read_kernel(&rb, sizeof(rb), &task->ioac.read_bytes);
    bpf_probe_read_kernel(&wb, sizeof(wb), &task->ioac.write_bytes);
    s->io_rb = rb;
    s->io_wb = wb;
```

These are cumulative counters. Userspace computes deltas between ticks by storing the previous snapshot in a sorted vector and performing binary search by PID.

### System-wide metrics without /proc

With per-PID metrics handled by BPF, the remaining system-wide metrics were also migrated away from /proc:

- **Total/free memory**: `libc::sysinfo()` syscall. Returns `totalram`, `freeram`, `bufferram`, `mem_unit` in a single syscall. Replaces parsing `/proc/meminfo` (which involves reading a multi-line text file, scanning for specific field names, parsing the values and units).
- **Load averages**: Also from `sysinfo()`. Replaces `/proc/loadavg`. The load values are in fixed-point format (divide by 65536.0 for float).
- **Core count**: `sysconf(_SC_NPROCESSORS_ONLN)`. A single syscall, cached by libc.

### What was tried and discarded: idle-time CPU%

The natural approach to computing system CPU utilisation is to track idle time: `cpu% = 100 - (idle_ns / total_ns * 100)`. The BPF probe can track idle time by accumulating time spent in PID 0 (the swapper/idle task) during `sched_switch`.

This works on kernels with periodic ticks, but fails on modern kernels with `CONFIG_NO_HZ_IDLE` (tickless idle). When a CPU enters deep idle, the timer tick is disabled. No timer means no wakeups means no scheduling events. The CPU sits in a halt state, burning no power, and `sched_switch` never fires. PID 0 is never scheduled *out*, so its time is never accounted. The result: `idle_ns` is massively underreported, and the computed CPU% shows 90%+ when the system is nearly idle.

The fix was to invert the computation. Instead of tracking idle time and subtracting from total, sum all per-PID `busy_ns` values (which *are* accurately tracked, because every non-idle task does get scheduled out eventually) and compute:

```
cpu% = sum(all per-PID busy_ns deltas) / (elapsed_seconds * num_cores * 1e9) * 100
```

This gives accurate CPU utilisation regardless of the kernel's tick configuration.

### What was discarded: D-Bus for power profile

The original script called `powerprofilesctl get`, which spawns a process that makes a D-Bus call to the power-profiles-daemon. D-Bus involves socket communication, message serialisation, and the overhead of the D-Bus daemon itself. The power profile is exposed directly via sysfs at `/sys/firmware/acpi/platform_profile` -- a single file read, no IPC, no subprocess.

### What was discarded: /proc/net reads

The original bash script collected network statistics from `/proc/net/dev`. This was removed entirely. Waybar has a built-in network module that does this more efficiently, and duplicating it in a system health monitor provides no value.

<svg viewBox="0 0 700 240" xmlns="http://www.w3.org/2000/svg" class="diagram-before-after" role="img" aria-label="Before and after architecture comparison">
  <style>
    .ba-title { fill: rgba(255,255,255,0.95); font-family: 'Lora', serif; font-size: 13px; font-weight: bold; }
    .ba-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 11px; }
    .ba-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 11px; }
    .ba-num   { fill: #c0392b; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; }
    .ba-num-g { fill: #2ecc71; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; }
  </style>
  <!-- Before box -->
  <rect x="10" y="10" width="330" height="220" rx="10" fill="rgba(192,57,43,0.06)" stroke="rgba(192,57,43,0.25)" stroke-width="1"/>
  <text x="175" y="35" text-anchor="middle" class="ba-title">Before (Stage 2)</text>
  <text x="30" y="60" class="ba-mono">Every 2s, for each of 300 PIDs:</text>
  <text x="40" y="80" class="ba-mono">open 3 files → read text → parse → close</text>
  <text x="40" y="100" class="ba-mono">= 2,700 syscalls</text>
  <text x="40" y="120" class="ba-mono">+ 7 sysfs reads (14 syscalls)</text>
  <text x="40" y="140" class="ba-mono">+ powerprofilesctl subprocess (~810ms)</text>
  <text x="30" y="175" class="ba-dim">Total per sample:</text>
  <text x="30" y="200" class="ba-num">~700 ms</text>
  <!-- After box -->
  <rect x="360" y="10" width="330" height="220" rx="10" fill="rgba(46,204,113,0.06)" stroke="rgba(46,204,113,0.25)" stroke-width="1"/>
  <text x="525" y="35" text-anchor="middle" class="ba-title">After (Stage 3+)</text>
  <text x="380" y="60" class="ba-mono">Continuously:</text>
  <text x="390" y="80" class="ba-mono">BPF probe fires on context switch</text>
  <text x="390" y="100" class="ba-mono">writes to kernel map (0 userspace syscalls)</text>
  <text x="380" y="124" class="ba-mono">Every 2s:</text>
  <text x="390" y="144" class="ba-mono">1 batch map read + 7 pread() = 8 syscalls</text>
  <text x="390" y="164" class="ba-mono">+ hand-written JSON (0 allocs)</text>
  <text x="380" y="195" class="ba-dim">Total per sample:</text>
  <text x="380" y="220" class="ba-num-g">&lt;1 ms</text>
</svg>

### The remaining filesystem: sysfs

After eliminating all /proc reads, the only filesystem access remaining was sysfs for hardware-specific values that have no syscall equivalent:

- `/sys/class/thermal/thermal_zone0/temp` -- CPU temperature
- `/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq` -- current CPU frequency
- `/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq` -- max CPU frequency
- `/sys/class/drm/card1/gt/gt0/rc6_residency_ms` -- GPU idle residency
- `/sys/class/drm/card1/gt/gt0/rps_act_freq_mhz` -- GPU current frequency
- `/sys/class/drm/card1/gt/gt0/rps_max_freq_mhz` -- GPU max frequency
- `/sys/firmware/acpi/platform_profile` -- power profile

Seven files. All opened once at startup and held open for the lifetime of the daemon. Read via `lseek(0) + read()` each tick.

**Result: sub-millisecond median.** The commit message recorded "down from 12ms to sub-1ms." The exact numbers vary with system load and PID count, but the architectural win is clear: eliminating the /proc walk removed thousands of syscalls from every sample.

---

## Stage 4: Zero-Allocation Steady State

At this point, the sample loop was fast enough that allocator overhead and syscall count became the dominant factors. Profiling revealed several sources of heap allocation and unnecessary work:

### Eliminating HashMap

The BPF stats were initially stored in a `HashMap<u32, BpfPidStats>` -- created fresh each tick, populated from the BPF map, used for delta computation, then dropped. HashMap allocation involves bucket array creation, hashing, and on drop, deallocation of the bucket array and any spilled entries.

Replaced with two `Vec<(u32, BpfPidStats)>`, each pre-allocated to `MAX_PIDS` (8192) capacity. On each tick:

1. `clear()` the current vec (sets length to 0, keeps capacity)
2. `push()` entries from the BPF map (never reallocates because capacity exceeds max entries)
3. `sort_unstable_by_key()` on PID for binary search
4. Delta computation uses `binary_search_by_key()` on the previous vec
5. `swap()` current and previous vecs

Zero allocation, zero deallocation, O(n log n) sort, O(log n) lookups. The vecs are allocated once at startup and never again.

```rust
let mut cur = PidStats::with_capacity(MAX_PIDS);
let mut prev = PidStats::with_capacity(MAX_PIDS);
// ...
loop {
    bpf.read_stats(&mut cur);   // clear + push, never allocates
    // ... compute deltas using cur.get(pid) [binary search] ...
    std::mem::swap(&mut cur, &mut prev);
}
```

### BPF_MAP_LOOKUP_BATCH

Reading the BPF hash map was previously done with the iterative pattern: `BPF_MAP_GET_NEXT_KEY` to get each key, then `BPF_MAP_LOOKUP_ELEM` to get each value. For N entries, that is 2N syscalls.

`BPF_MAP_LOOKUP_BATCH` (available since Linux 5.6) reads the entire map in a single syscall. The kernel fills caller-provided key and value arrays, returning the count of entries read and a batch token for continuation if the map is larger than the buffer.

```rust
fn read_batch(&mut self, out: &mut PidStats) -> bool {
    let mut token: u64 = 0;
    let mut total = 0usize;
    let mut first = true;
    loop {
        let rem = MAX_PIDS - total;
        if rem == 0 { break; }
        let mut attr = BpfAttrBatch {
            in_batch: if first { 0 } else { &token as *const _ as u64 },
            out_batch: &mut token as *mut _ as u64,
            keys: unsafe { self.bk.as_mut_ptr().add(total) } as u64,
            values: unsafe { self.bv.as_mut_ptr().add(total) } as u64,
            count: rem as u32, map_fd: self.stats_fd as u32,
            elem_flags: 0, flags: 0,
        };
        let r = unsafe { bpf_sys(BPF_MAP_LOOKUP_BATCH, ...) };
        total += attr.count as usize;
        if r < 0 { /* ENOENT means end of map */ break; }
        first = false;
    }
    // ...
}
```

The batch key and value buffers (`bk`, `bv`) are pre-allocated in the `BpfLoader` struct and reused every tick. The implementation falls back to the iterative path if batch lookup returns an error other than ENOENT (indicating the kernel doesn't support it).

### pread() instead of lseek() + read()

For the 7 sysfs files read each tick, the original code called `lseek(fd, 0, SEEK_SET)` followed by `read(fd, buf, len)` -- two syscalls per file, 14 syscalls total.

`pread(fd, buf, len, 0)` combines both into a single syscall. Same result, half the syscalls, 7 instead of 14:

```rust
fn pread_raw(f: &fs::File, buf: &mut [u8]) -> usize {
    let n = unsafe { libc::pread(f.as_raw_fd(), buf.as_mut_ptr() as _, buf.len(), 0) };
    if n < 0 { 0 } else { n as usize }
}
```

### Pre-opened throttle sysfs files

GPU throttle status was read from `/sys/class/drm/card1/gt/gt0/throttle_reason_*` -- a set of files discovered via `readdir()` at runtime. The initial implementation called `readdir()` each tick to enumerate the files, then opened, read, and closed each one.

Moved to init-time discovery: `readdir()` once at startup, open all matching files, store them in a `Vec<ThrottleFile>` with the file handle and a fixed-size name buffer. Each tick just does `pread()` on the pre-opened handles:

```rust
struct ThrottleFile { file: fs::File, name: [u8; 32], nl: u8 }
```

The throttle status output is built into a stack-allocated `[u8; 64]` buffer -- no String, no allocation.

### Removing serde_json

serde_json is a powerful, correct, and general-purpose JSON serialiser. It is also allocation-heavy: it creates temporary `Value` trees, allocates strings for keys, and writes through a buffered formatter. For a fixed-schema output with two string fields and one string field that contains only ASCII and newlines, this is overkill.

Replaced with a hand-written JSON emitter that writes directly into a reusable `String`:

```rust
fn json_str(out: &mut String, s: &str) {
    out.push('"');
    for b in s.bytes() {
        match b {
            b'"'  => out.push_str("\\\""),
            b'\\' => out.push_str("\\\\"),
            b'\n' => out.push_str("\\n"),
            c if c < 0x20 => {}
            c => unsafe { out.as_mut_vec().push(c) },
        }
    }
    out.push('"');
}
```

The escaper handles exactly the characters that appear in the tooltip (newlines, and theoretically backslashes or quotes in process names). The `unsafe` push directly into the String's backing vec avoids the UTF-8 validation overhead of `push()` for known-ASCII bytes.

### Eliminating format!() temporaries

Every `format!()` macro allocates a new `String`. In the hot path, these appeared in tooltip construction, the `text` field, and the final JSON output. All replaced with `write!()` into pre-allocated, reusable `String` buffers:

```rust
let mut tt = String::with_capacity(1024);       // tooltip
let mut json = String::with_capacity(1536);      // JSON output line
let mut text_buf = String::with_capacity(16);    // "text" field value

loop {
    tt.clear();
    json.clear();
    text_buf.clear();
    // write!() into these buffers -- clear() keeps capacity, never reallocates
}
```

### Top-N without allocation

The top-5 CPU, memory, and IO process lists use stack-allocated fixed-size arrays (`[TopEntry; 5]`) with insertion sort. No Vec, no heap. The `comm` field is a fixed `[u8; 16]` (matching the kernel's `TASK_COMM_LEN`) rather than a `String`:

```rust
struct TopEntry { val: u64, comm: [u8; COMM_LEN], cl: u8 }
struct Top5 { e: [TopEntry; TOP_N], n: usize }
```

### Minor optimisations

- `BpfMapDef::name` changed from heap-allocated `String` to `&'static str`. The map names are compile-time constants.
- Direct PID comparison (`pid == me || pid == parent`) instead of `slice.contains(&pid)`. Two comparisons vs. a function call with a loop.
- `parse_u64_trim()` is a hand-rolled integer parser that operates on byte slices, avoiding `str::parse::<u64>()` which requires UTF-8 validation and handles a wider range of formats.

**Result: 0.97ms average, 0.74ms minimum.** Zero heap allocations in the steady-state hot path. All memory is either stack-allocated (sample structs, Top5 arrays, sysfs buffers) or pre-allocated and reused (PidStats vecs, String buffers, BPF batch arrays).

---

## Things Tried and Discarded

### io_uring for batched sysfs reads

With 7 sysfs files to read each tick, io_uring's submission queue could theoretically batch all reads into a single `io_uring_enter()` syscall. The idea was to submit 7 read SQEs and reap 7 CQEs, reducing 7 pread syscalls to 1 io_uring_enter.

Discarded for two reasons:

1. **sysfs files are not real files.** They are kernel-generated virtual files. io_uring's async read path is optimised for block devices with actual IO queues. For sysfs, the kernel generates the content synchronously during the read -- there is nothing to parallelise. The io_uring SQE submission, CQE reaping, and ring buffer management overhead would likely exceed the savings from reducing 7 `pread()` calls to 1 `io_uring_enter()`.
2. **Code complexity.** io_uring requires ring buffer setup, memory mapping for the SQ/CQ rings, careful lifetime management, and error handling for partial completions. For 7 files, this is a net negative.

### block_rq_issue tracepoint for IO attribution

As described in Stage 3, the block layer's `block_rq_issue` tracepoint fires in interrupt or worker context. `bpf_get_current_pid_tgid()` returns whichever task happens to be running, not the task that submitted the IO. Per-PID IO stats from this tracepoint are unreliable to the point of being useless. The correct approach is reading `task->ioac` directly from the originating task's context in `sched_switch`.

### Idle-time CPU% (tracking PID 0 in sched_switch)

Tracking idle time by accumulating nanoseconds spent in PID 0 (the idle/swapper task) works correctly on kernels with periodic timer ticks (`CONFIG_HZ_PERIODIC`). On kernels with `CONFIG_NO_HZ_IDLE` (which is the default on virtually all modern distributions), CPUs that enter deep idle disable the timer tick. No tick means no interrupts means no scheduling events. PID 0 enters `cpu_idle_loop()`, executes a halt instruction, and stays there until an external interrupt arrives. Since `sched_switch` never fires for these idle periods, `idle_ns` is massively undercounted.

On a system with 4 cores, 3 of which are deeply idle, the tracked `idle_ns` might reflect only 10% of actual idle time, producing a reported CPU usage of 90%+ when true utilisation is under 5%.

The fix -- summing per-PID busy_ns -- is accurate because every non-idle task *does* get scheduled out eventually (preemption, blocking syscall, voluntary yield), and its time is correctly accounted at that point.

### D-Bus for power profile (powerprofilesctl)

`powerprofilesctl get` spawns a process that connects to D-Bus, sends a method call to `net.hadess.PowerProfiles`, deserialises the response, prints the result, and exits. This involves: fork+exec, D-Bus socket connect, authentication handshake, message serialisation, message deserialisation, and process teardown. Total cost: several milliseconds.

The same information is available at `/sys/firmware/acpi/platform_profile` as a plain text file. One `pread()`, ~20 bytes, <1 microsecond.

### aya and libbpf-rs

Both are well-engineered BPF frameworks for Rust. aya provides a safe, ergonomic API for map access, program loading, and BTF handling. libbpf-rs wraps the C libbpf library with Rust bindings.

Both were discarded because their dependency trees are disproportionate to the problem:

- **aya** pulls in async runtime dependencies (tokio features), BTF parsing, and various platform abstractions. The binary size increase was several megabytes.
- **libbpf-rs** requires a C build step (libbpf-sys compiles libbpf from source), adds runtime initialisation cost, and introduces a C FFI boundary.

rstat's BPF needs are minimal: load one ELF object with 2 programs and 3 maps, patch relocations, attach to tracepoints, read maps. The custom loader is ~100 lines of Rust using raw `bpf()` syscalls and `goblin` for ELF parsing. `goblin` is configured with minimal features (`elf32`, `elf64`, `endian_fd`, `std` -- no Mach-O, no PE, no archive support). The entire dependency tree is two crates: `goblin` and `libc`.

### PERF_EVENT_IOC_SET_BPF on all CPUs

The initial attachment logic called `ioctl(fd, PERF_EVENT_IOC_SET_BPF, prog_fd)` on every CPU's perf event fd. This is unnecessary. Tracepoint BPF programs are attached to the tracepoint's `tp_event`, which is a kernel-global structure. Setting the BPF program on one CPU's perf event fd is sufficient -- the program fires on all CPUs.

`PERF_EVENT_IOC_ENABLE` is different: it enables the perf event on a specific CPU. This must be called on every CPU's fd, or the tracepoint won't fire on CPUs that weren't enabled.

The final pattern:

```rust
for cpu in 0..ncpu {
    let pfd = perf_event_open_tracepoint(tp_id, cpu)?;
    if cpu == 0 {
        ioctl(pfd, PERF_EVENT_IOC_SET_BPF, fd);   // once
    }
    ioctl(pfd, PERF_EVENT_IOC_ENABLE, 0);          // every CPU
}
```

---

## Architecture Summary

<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" class="diagram-architecture" role="img" aria-label="Architecture diagram: BPF probes, maps, userspace daemon, Waybar output">
  <style>
    .ar-title { fill: rgba(255,255,255,0.95); font-family: 'Lora', serif; font-size: 13px; font-weight: bold; }
    .ar-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 11px; }
    .ar-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 10px; }
    .ar-box   { rx: 8; stroke-width: 1; }
    .ar-arr   { stroke: rgba(168,200,160,0.5); stroke-width: 1.5; fill: none; marker-end: url(#ara); }
  </style>
  <defs><marker id="ara" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(168,200,160,0.5)"/></marker></defs>
  <!-- Kernel zone -->
  <rect x="10" y="10" width="660" height="120" class="ar-box" fill="rgba(39,174,96,0.05)" stroke="rgba(39,174,96,0.25)"/>
  <text x="30" y="32" class="ar-title">Kernel</text>
  <!-- Tracepoints -->
  <rect x="30" y="42" width="160" height="32" class="ar-box" fill="rgba(46,204,113,0.1)" stroke="rgba(46,204,113,0.3)"/>
  <text x="110" y="63" text-anchor="middle" class="ar-mono">sched_switch probe</text>
  <rect x="30" y="80" width="160" height="32" class="ar-box" fill="rgba(46,204,113,0.1)" stroke="rgba(46,204,113,0.3)"/>
  <text x="110" y="101" text-anchor="middle" class="ar-mono">sched_process_exit probe</text>
  <!-- BPF maps -->
  <rect x="250" y="42" width="120" height="28" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)"/>
  <text x="310" y="61" text-anchor="middle" class="ar-mono">stats (HASH)</text>
  <rect x="250" y="74" width="120" height="28" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)"/>
  <text x="310" y="93" text-anchor="middle" class="ar-mono">sys (ARRAY)</text>
  <rect x="250" y="106" width="120" height="18" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)"/>
  <text x="310" y="120" text-anchor="middle" class="ar-mono">sched_start (HASH)</text>
  <!-- Arrows probes → maps -->
  <line x1="190" y1="58" x2="245" y2="56" class="ar-arr"/>
  <line x1="190" y1="96" x2="245" y2="96" class="ar-arr"/>
  <!-- sysfs files -->
  <rect x="430" y="42" width="220" height="82" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.1)"/>
  <text x="540" y="60" text-anchor="middle" class="ar-label">sysfs (7 files)</text>
  <text x="445" y="78" class="ar-mono">thermal_zone0/temp</text>
  <text x="445" y="92" class="ar-mono">cpufreq/scaling_cur_freq</text>
  <text x="445" y="106" class="ar-mono">drm/card1/gt/gt0/rps_act_freq_mhz</text>
  <text x="445" y="120" class="ar-mono">platform_profile ...</text>
  <!-- Divider -->
  <line x1="10" y1="140" x2="670" y2="140" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <!-- Userspace zone -->
  <rect x="10" y="140" width="660" height="150" class="ar-box" fill="rgba(52,152,219,0.04)" stroke="rgba(52,152,219,0.2)"/>
  <text x="30" y="162" class="ar-title">Userspace</text>
  <!-- rstat daemon -->
  <rect x="180" y="170" width="300" height="50" class="ar-box" fill="rgba(52,152,219,0.08)" stroke="rgba(52,152,219,0.3)"/>
  <text x="330" y="192" text-anchor="middle" class="ar-title">rstat daemon</text>
  <text x="330" y="210" text-anchor="middle" class="ar-mono">batch map read + 7× pread() + JSON emit</text>
  <!-- Arrows maps → daemon -->
  <line x1="310" y1="128" x2="310" y2="165" class="ar-arr"/>
  <!-- Arrow sysfs → daemon -->
  <line x1="540" y1="128" x2="430" y2="165" class="ar-arr"/>
  <!-- Waybar -->
  <rect x="250" y="245" width="160" height="34" class="ar-box" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)"/>
  <text x="330" y="267" text-anchor="middle" class="ar-label">Waybar (stdout → JSON)</text>
  <line x1="330" y1="220" x2="330" y2="240" class="ar-arr"/>
</svg>

### BPF probe (probe.bpf.c)

A single C source file compiled with `clang -target bpf -O2 -g`. Uses `vmlinux.h` for kernel type definitions (generated from BTF, avoids kernel header dependency).

Two tracepoint programs:

- **`handle_sched_switch`** (tracepoint/sched/sched_switch): On every context switch, accounts CPU time for the outgoing task (delta from `sched_start` map), snapshots RSS from `mm->rss_stat` and IO from `task->ioac`, stores cumulative values in the `stats` hash map. Idle time (PID 0) is accumulated in the `sys` array map (currently unused in userspace -- CPU% is computed from busy_ns sum).
- **`handle_sched_exit`** (tracepoint/sched/sched_process_exit): Deletes the exiting PID from both `sched_start` and `stats` maps. Prevents unbounded map growth.

Three BPF maps:

| Map | Type | Key | Value | Max Entries | Purpose |
|-----|------|-----|-------|-------------|---------|
| `stats` | HASH | u32 (PID) | pid_stats (48B) | 8192 | Per-PID cumulative stats |
| `sys` | ARRAY | u32 (0) | sys_stats (8B) | 1 | System-wide idle_ns |
| `sched_start` | HASH | u32 (PID) | sched_in (8B) | 8192 | Per-PID schedule-in timestamp |

### Rust daemon (main.rs)

A single-file ~795-line Rust program. No async runtime, no framework, no macros beyond `write!()`.

Key components:

- **Custom ELF loader** (`BpfLoader`): Parses BPF ELF via goblin, creates maps with raw `bpf()` syscalls, resolves map relocations in program instructions, loads programs, attaches via perf_event.
- **Sorted vec with binary search** (`PidStats`): Two pre-allocated vecs swapped each tick. `clear()` + `push()` + `sort_unstable()` for population, `binary_search_by_key()` for O(log n) delta lookups.
- **Batch map reading**: `BPF_MAP_LOOKUP_BATCH` with pre-allocated key/value arrays. Falls back to iterative get_next_key + lookup if unsupported.
- **pread for sysfs**: 7 pre-opened file handles, `pread(fd, buf, len, 0)` per tick.
- **Stack-allocated top-N** (`Top5`, `IoTop5`): Fixed-size arrays with insertion, sorted on output.
- **Hand-written JSON**: Direct byte-level string building with a minimal escaper. No serde dependency.
- **Built-in benchmark mode**: `--bench N` runs N samples with 1ms spacing and reports avg/p50/p95/p99/min/max timings.

### Nix packaging (flake.nix)

Two-derivation build:

1. **rstat-probe**: `stdenv.mkDerivation` that compiles `probe.bpf.c` with `clang -target bpf -O2 -g` against libbpf headers and the local `vmlinux.h`. Produces `probe.bpf.o`.
2. **rstat**: `rustPlatform.buildRustPackage` that builds the Rust binary. `postInstall` copies the probe object from the first derivation into `$out/bin/` alongside the binary.

The binary discovers the probe at runtime by looking for `probe.bpf.o` adjacent to its own executable path, or accepts an explicit path as a command-line argument. The program requires `CAP_SYS_ADMIN` or equivalent (e.g., via NixOS `security.wrappers` with setuid) for the `bpf()` and `perf_event_open()` syscalls.

---

## Performance Timeline

| Stage | Measured | Source | Approach |
|-------|----------|--------|----------|
| Bash + coreutils | ~2s | Benched (excl. 1s sleep) | Subprocesses for every metric, no state between runs |
| Rust + /proc | ~700ms | Dev measurement | Direct /proc parsing, kept file handles, `powerprofilesctl` subprocess (~810ms) |
| Sysfs + optimised /proc | ~15ms | Dev measurement | Sysfs replaces D-Bus, reusable buffers, byte-level parsing, skip kthreads |
| eBPF -- no /proc walks | sub-1ms | Commit `7601d77` | BPF probe reads task_struct directly, sysinfo() for system metrics |
| Zero-alloc optimised | min 0.78ms | Benched (500 samples) | Batch map reads, sorted vec, pread, hand-written JSON |

Development measurements were taken under heavier load conditions (HyprPanel running, more processes). Current-system benchmarks show lower figures for the /proc stages due to lighter load and fewer PIDs.

The final binary has two runtime dependencies (`libc`, `goblin` for ELF parsing at init), zero allocations in the hot path, and produces a complete system health JSON blob -- CPU%, memory, load, temperature, frequency, GPU utilisation, power profile, throttle status, top-5 CPU/memory/IO processes with per-process breakdowns -- in under a millisecond on a quiet desktop.

<img src="assets/rstat-tooltip.png" alt="rstat Waybar tooltip showing CPU, memory, IO breakdown, sampled in 2.9ms" style="max-width: 100%; border-radius: 8px; margin: 1em 0;" />
<em style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">The final result: a complete system health snapshot in under 3ms.</em>

### CPU Flamegraphs

Before the zero-allocation work, `perf record` on the sample loop shows serde_json serialisation and `take_sample` dominating:

<img src="assets/rstat-flamegraph-old.svg" alt="CPU flamegraph before optimisation -- serde_json and take_sample dominate" style="max-width: 100%; border-radius: 8px; margin: 1em 0;" />
<em style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">Pre-optimisation: serde serialisation and proc walks visible in the profile.</em>

After optimisation, the hot path is so fast that `perf` mostly captures debug symbol resolution noise (backtrace symbolisation from the benchmark harness):

<img src="assets/rstat-flamegraph.svg" alt="CPU flamegraph after optimisation -- hot path too fast, profiler captures mostly noise" style="max-width: 100%; border-radius: 8px; margin: 1em 0;" />
<em style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">Post-optimisation: the actual sample loop is invisible in the profile. The profiler is profiling itself.</em>

<div class="memory-comparison">
  <div class="comparison-row comparison-bad">
    <span class="comparison-label">HyprPanel</span>
    <span class="comparison-stats">135 MB RSS, 10% CPU, JS runtime + GObject + D-Bus</span>
  </div>
  <div class="comparison-row comparison-good">
    <span class="comparison-label">rstat</span>
    <span class="comparison-stats">~200 KB RSS, &lt;0.01% CPU, zero heap allocations</span>
  </div>
</div>

---

## The Real Lesson

The first improvement -- bash to Rust -- captured more than 95% of the practical benefit. Going from 2 seconds to 15 milliseconds was a 130× improvement just by eliminating subprocesses and holding file descriptors open. For a tool that samples every 2 seconds, 15ms is already negligible. Nobody would notice the difference between 15ms and sub-1ms.

The subsequent journey from 15ms to sub-millisecond was intellectually rewarding. It taught me how /proc works under the hood, how BPF program loading actually happens at the syscall level, how the scheduler accounts CPU time on tickless kernels, and why `percpu_counter` values are approximate. I would do it again. But it was not practically necessary.

This is the shape of most performance work: the first 10% of effort captures 90% of the improvement. The remaining 90% of effort is for the remaining 10% of improvement. Knowing which side you're on matters.

We don't need everyone writing eBPF probes. We need people to stop embedding JavaScript runtimes in desktop utilities. The gap between "shell script that forks 15 processes" and "compiled binary that holds file descriptors open" is where almost all the real-world wins live. Everything beyond that is craft.

The lesson, if there is one: the cost is almost never in the computation. It is in the mechanism -- the processes spawned, the files opened and closed, the text serialised and deserialised, the memory allocated and freed, the syscalls made. Eliminate the mechanism and the computation takes care of itself.

Meanwhile, Claude Code -- a React SPA running on Node.js to print characters to a terminal -- sits at 100% CPU with zram thrashing. Four `libuv-worker` processes, each consuming 700MB. The status bar daemon samples the carnage in under a millisecond.

Sometimes the message writes itself.
