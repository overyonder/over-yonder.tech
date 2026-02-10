---
title: "System calls are slow. Run your code in the kernel!"
date: 2026-02-09
author: Kieran Hannigan
tags: [rust, ebpf, performance, linux]
---

# System calls are slow. Run your code in the kernel!

<div class="author-badge">
  <img src="https://github.com/KaiStarkk.png?size=64" alt="Kieran Hannigan" />
  <a href="https://github.com/KaiStarkk">Kieran Hannigan</a>
  <a href="https://github.com/kaistarkk/rstat"><img src="https://img.shields.io/github/stars/kaistarkk/rstat?style=flat-square&label=rstat" alt="rstat" class="shields-badge" /></a>
</div>

<img src="assets/rstat-hero.png" alt="rstat Waybar tooltip showing CPU, memory, IO breakdown, sampled in 2.9ms" class="hero-img" />

The status bar on my Linux desktop was using 135MB of RAM and 10% CPU. Not the applications it was monitoring. The bar itself. The monitoring tool was a measurable load on the system it was supposed to monitor.

[HyprPanel](https://github.com/Jas-SinghFSU/HyprPanel) is the de facto status bar for the [Hyprland](https://hyprland.org/) compositor. It's written in [TypeScript](https://www.typescriptlang.org/) and runs on [GJS](https://gjs.guide/) (GNOME's JavaScript runtime, which embeds the [SpiderMonkey](https://spidermonkey.dev/) engine from Firefox). A full JavaScript engine, a [GObject](https://docs.gtk.org/gobject/) type system, a [D-Bus](https://www.freedesktop.org/wiki/Software/dbus/) session bridge, a CSS layout engine, all running persistently to display a few numbers at the top of the screen. The process tree told the story:

```
USER       PID  %CPU  %MEM     VSZ    RSS  COMMAND
user    318867  10.4   1.7  3467764 138444  gjs -m hyprpanel-wrapped
user    318925   0.6   0.3    47276  29636  python3 bluetooth.py
```

3.4GB virtual address space. 135MB RSS. 10% CPU. Persistent `Gjs-Console-CRITICAL` warnings. GDBus errors about missing portal interfaces. A Python subprocess for Bluetooth. For a status bar.

This is not an indictment of the people who built HyprPanel. It's genuinely useful software, and its creator [Jas-SinghFSU](https://github.com/Jas-SinghFSU) agrees with the diagnosis. HyprPanel is now in maintenance mode, and Jas is building its successor, [Wayle](https://github.com/Jas-SinghFSU/wayle), entirely in Rust, noting that *"GJS (even with TypeScript) just isn't a good systems language."* The problem is the architectural norms, not the people working within them. Somewhere along the way, "desktop widget" became synonymous with "embedded web browser." We treat the desktop like it's a deployment target for web applications, and then wonder why a laptop battery lasts four hours.

A status bar reads a few integers from the kernel and renders them into a strip of pixels. It should behave like a real-time system: bounded memory, bounded latency, no garbage collection pauses, no interpreter overhead. So I switched to [Waybar](https://github.com/Alexays/Waybar), which is written in C++ and renders with [GTK](https://gtk.org/). And then I needed a system monitor module that actually took its job seriously.

This is the story of `rstat`: a system health monitor that went from a 2-second bash script to a [Rust](https://www.rust-lang.org/) daemon that injects its own code into the kernel.

Userland code. Running in the kernel. At ring 0 privilege. Reading scheduler data structures directly from memory as the CPU switches between tasks. No filesystem, no syscalls, no text parsing, no heap allocations. Sub-millisecond samples.

Each stage was motivated by the same question: where is the time actually going, and can we eliminate the mechanism entirely rather than just making it faster?

<svg viewBox="0 0 750 200" xmlns="http://www.w3.org/2000/svg" class="perf-waterfall" role="img" aria-label="Performance waterfall: linear scale">
  <style>
    .wf-label { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 13px; }
    .wf-time  { fill: rgba(255,255,255,0.6); font-family: 'Courier New', monospace; font-size: 12px; }
    .wf-bar   { rx: 4; ry: 4; }
  </style>
  <text x="375" y="22" text-anchor="middle" class="wf-label" font-size="15" fill="rgba(255,255,255,0.95)">Sample time per stage</text>
  <!-- Linear scale: bar width = (ms / 2000) * 500 -->
  <text x="14" y="58" class="wf-label">Bash + coreutils</text>
  <rect x="220" y="44" width="500" height="22" class="wf-bar" fill="#c0392b" opacity="0.85"/>
  <text x="726" y="60" text-anchor="end" class="wf-time">~2,000 ms</text>
  <!-- 700/2000 * 500 = 175 -->
  <text x="14" y="96" class="wf-label">Rust + /proc</text>
  <rect x="220" y="82" width="175" height="22" class="wf-bar" fill="#e67e22" opacity="0.85"/>
  <text x="401" y="98" text-anchor="end" class="wf-time">~700 ms</text>
  <!-- 15/2000 * 500 = 3.75 -->
  <text x="14" y="134" class="wf-label">Optimised /proc</text>
  <rect x="220" y="120" width="4" height="22" class="wf-bar" fill="#f39c12" opacity="0.85"/>
  <text x="230" y="136" class="wf-time">~15 ms</text>
  <!-- 0.78/2000 * 500 ≈ 0.2 -->
  <text x="14" y="172" class="wf-label">eBPF + zero-alloc</text>
  <rect x="220" y="158" width="1" height="22" class="wf-bar" fill="#2ecc71" opacity="0.85"/>
  <text x="227" y="174" class="wf-time">&lt;1 ms</text>
</svg>

Alright. Let me try that again in log scale.

<svg viewBox="0 0 750 222" xmlns="http://www.w3.org/2000/svg" class="perf-waterfall" role="img" aria-label="Performance waterfall: log scale">
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
  <!-- log10(700)/3.301*500 ≈ 431 -->
  <text x="14" y="96" class="wf-label">Rust + /proc</text>
  <rect x="220" y="82" width="431" height="22" class="wf-bar" fill="#e67e22" opacity="0.85"/>
  <text x="657" y="98" text-anchor="end" class="wf-time">~700 ms</text>
  <!-- log10(15)/3.301*500 ≈ 178 -->
  <text x="14" y="134" class="wf-label">Optimised /proc</text>
  <rect x="220" y="120" width="178" height="22" class="wf-bar" fill="#f39c12" opacity="0.85"/>
  <text x="404" y="136" text-anchor="end" class="wf-time">~15 ms</text>
  <!-- sub-1ms -->
  <text x="14" y="172" class="wf-label">eBPF + zero-alloc</text>
  <rect x="220" y="158" width="52" height="22" class="wf-bar" fill="#2ecc71" opacity="0.85"/>
  <text x="278" y="174" class="wf-time">&lt;1 ms</text>
  <text x="375" y="210" text-anchor="middle" class="wf-time" font-size="10">Dev-time measurements. Current-system benchmarks show lower figures due to different load.</text>
</svg>

---

## <svg class="stage-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="18" height="18" rx="3" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><text x="5" y="14.5" font-family="'Courier New',monospace" font-size="11" fill="#c8d8c0">&gt;_</text></svg> Stage 1: The Baseline — Bash + Coreutils (~2 seconds)

<svg class="stage-breakdown" viewBox="0 0 140 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stage 1 time breakdown">
  <style>
    .sb-label { fill: rgba(255,255,255,0.7); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-time  { fill: rgba(255,255,255,0.5); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-title { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 10px; font-weight: bold; }
  </style>
  <text x="70" y="14" text-anchor="middle" class="sb-title">~2,000ms</text>
  <!-- Bar segments (total height 200px, scaled proportionally) -->
  <!-- fork+exec: ~20ms = 2px -->
  <rect x="50" y="24" width="50" height="10" rx="2" fill="#c0392b" opacity="0.7"/>
  <text x="46" y="32" text-anchor="end" class="sb-label">fork+exec</text>
  <!-- /proc reads: ~15ms = 2px -->
  <rect x="50" y="36" width="50" height="8" rx="2" fill="#e67e22" opacity="0.7"/>
  <text x="46" y="42" text-anchor="end" class="sb-label">/proc</text>
  <!-- text parsing: ~5ms = 1px -->
  <rect x="50" y="46" width="50" height="6" rx="2" fill="#f39c12" opacity="0.7"/>
  <text x="46" y="51" text-anchor="end" class="sb-label">parse</text>
  <!-- powerprofilesctl: ~810ms = 81px -->
  <rect x="50" y="54" width="50" height="81" rx="2" fill="#c0392b" opacity="0.85"/>
  <text x="46" y="98" text-anchor="end" class="sb-label">dbus</text>
  <!-- sleep: ~1000ms = 100px -->
  <rect x="50" y="137" width="50" height="100" rx="2" fill="rgba(255,255,255,0.08)"/>
  <text x="46" y="190" text-anchor="end" class="sb-label">sleep</text>
  <text x="70" y="250" text-anchor="middle" class="sb-time">Stage 1</text>
</svg>

The original implementation was a shell script invoked by Waybar's `custom` module on a polling interval. Every two or three seconds, Waybar would fork a shell, the shell would execute the script, and the script would fan out into a tree of subprocesses:

```
cat /proc/stat | awk '{...}'
cat /proc/meminfo | grep MemTotal | awk '{print $2}'
cat /proc/loadavg
bc <<< "scale=2; $used / $total * 100"
powerprofilesctl get
```

<svg viewBox="0 0 600 180" xmlns="http://www.w3.org/2000/svg" class="diagram-fork-tree" role="img" aria-label="Diagram: Bash fork tree for each Waybar invocation">
  <style>
    .ft-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 11px; }
    .ft-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 10px; font-style: italic; }
    .ft-box   { fill: rgba(0,0,0,0.2); stroke: rgba(255,255,255,0.15); stroke-width: 1; rx: 5; }
    .ft-line  { stroke: rgba(168,200,160,0.4); stroke-width: 1.5; fill: none; }
    .ft-pipe  { stroke: rgba(200,160,100,0.5); stroke-width: 1; fill: none; stroke-dasharray: 4,3; }
  </style>
  <!-- Waybar -->
  <rect x="230" y="6" width="140" height="26" class="ft-box" stroke="rgba(52,152,219,0.3)"/>
  <text x="300" y="24" text-anchor="middle" class="ft-mono">Waybar (fork)</text>
  <line x1="300" y1="32" x2="300" y2="48" class="ft-line"/>
  <!-- Shell -->
  <rect x="250" y="48" width="100" height="26" class="ft-box"/>
  <text x="300" y="66" text-anchor="middle" class="ft-mono">bash</text>
  <!-- fork lines to children -->
  <line x1="300" y1="74" x2="300" y2="86" class="ft-line"/>
  <line x1="55" y1="86" x2="545" y2="86" class="ft-line"/>
  <line x1="55" y1="86" x2="55" y2="98" class="ft-line"/>
  <line x1="155" y1="86" x2="155" y2="98" class="ft-line"/>
  <line x1="255" y1="86" x2="255" y2="98" class="ft-line"/>
  <line x1="355" y1="86" x2="355" y2="98" class="ft-line"/>
  <line x1="545" y1="86" x2="545" y2="98" class="ft-line"/>
  <!-- Children: cat, awk, grep, bc, powerprofilesctl -->
  <rect x="15" y="98" width="80" height="24" class="ft-box"/>
  <text x="55" y="114" text-anchor="middle" class="ft-mono">cat</text>
  <rect x="115" y="98" width="80" height="24" class="ft-box"/>
  <text x="155" y="114" text-anchor="middle" class="ft-mono">awk</text>
  <rect x="215" y="98" width="80" height="24" class="ft-box"/>
  <text x="255" y="114" text-anchor="middle" class="ft-mono">grep</text>
  <rect x="315" y="98" width="80" height="24" class="ft-box"/>
  <text x="355" y="114" text-anchor="middle" class="ft-mono">bc</text>
  <rect x="420" y="98" width="150" height="24" class="ft-box"/>
  <text x="495" y="114" text-anchor="middle" class="ft-mono">powerprofilesctl</text>
  <!-- Pipe connections: cat→awk, cat→grep -->
  <path d="M 95 110 L 115 110" class="ft-pipe"/>
  <path d="M 95 116 Q 130 138 215 116" class="ft-pipe"/>
  <text x="155" y="140" text-anchor="middle" class="ft-dim">pipes</text>
  <!-- Annotation -->
  <text x="300" y="160" text-anchor="middle" class="ft-dim">Each fork+exec ~1-2ms. 10-15 per invocation.</text>
  <text x="300" y="174" text-anchor="middle" class="ft-dim">Multiply by one invocation every 2-3 seconds, continuously.</text>
</svg>

Each line is a fork+exec. `cat` opens a file, reads it, writes it to a pipe. `awk` reads from the pipe, parses the text, emits a result. `grep` does the same. `bc` spawns to perform arithmetic that the shell cannot do natively. `powerprofilesctl` spawns a process that makes a D-Bus call to query the power profile daemon.

The costs compound:

- **Process creation overhead.** Each `fork()` copies the process's page tables. Each `exec()` loads a new binary, links it, initialises its runtime. On Linux, a fork+exec cycle costs roughly 1-2ms even for trivial programs. The script spawned 10-15 of these per invocation.
- **No state between runs.** Every invocation started from scratch. No open file handles, no cached values, no deltas. CPU usage requires two readings of `/proc/stat` separated by a time interval. The script either read it once and computed nothing meaningful, or slept internally and doubled its execution time.
- **Shell string parsing.** Every intermediate result was a string. Numbers were parsed from text, manipulated as text, formatted back to text. The shell's arithmetic capabilities are limited to integers, hence the `bc` dependency for floating-point.
- **Filesystem round-trips.** `/proc` is a virtual filesystem. Each `open()` allocates a file descriptor and finds the inode. Each `read()` triggers the kernel to walk its data structures and generate the file contents on demand, formatting them as ASCII text that gets copied to userspace. Each `close()` tears down the file descriptor. Multiply by every metric, every subprocess, every invocation.

Each of these operations is a syscall. On modern x86-64, a syscall uses the `syscall` instruction, which jumps directly to the kernel's entry point via a model-specific register. The legacy mechanism was `int 0x80`, a software interrupt dispatched through the interrupt descriptor table -- slower due to the IDT lookup and interrupt handling overhead. Even the modern path has non-trivial cost: the CPU must flush the pipeline, switch to ring 0, save registers, and on return do it all in reverse. For a deeper treatment, see Abhinav Upadhyay's [What Makes System Calls Expensive](https://blog.codingconfessions.com/p/what-makes-system-calls-expensive) for the architectural explanation, and Georg Sauthoff's [On the Costs of Syscalls](https://gms.tf/on-the-costs-of-syscalls.html) for microbenchmark data.

The polling interval was chosen not because the data changed that slowly, but to hide how slow the collection was. Even so, the script occasionally lagged Waybar's rendering, causing the status bar to display stale data or briefly blank.

This was the motivation for a rewrite: not performance for its own sake, but the observation that a status bar module should not be a measurable load on the system it monitors.

---

## <svg class="stage-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><circle cx="10" cy="10" r="2" fill="rgba(255,255,255,0.4)"/><line x1="10" y1="3" x2="10" y2="5.5" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/><line x1="10" y1="14.5" x2="10" y2="17" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/><line x1="3" y1="10" x2="5.5" y2="10" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/><line x1="14.5" y1="10" x2="17" y2="10" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/></svg> Stage 2: Rust + /proc Parsing (~700ms)

<svg class="stage-breakdown" viewBox="0 0 140 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stage 2 time breakdown">
  <style>
    .sb-label { fill: rgba(255,255,255,0.7); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-time  { fill: rgba(255,255,255,0.5); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-title { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 10px; font-weight: bold; }
  </style>
  <text x="70" y="14" text-anchor="middle" class="sb-title">~700ms</text>
  <!-- /proc reads: ~15ms = 4px at this scale -->
  <rect x="50" y="24" width="50" height="6" rx="2" fill="#e67e22" opacity="0.7"/>
  <text x="46" y="30" text-anchor="end" class="sb-label">/proc</text>
  <!-- text parsing: ~5ms -->
  <rect x="50" y="32" width="50" height="4" rx="2" fill="#f39c12" opacity="0.7"/>
  <text x="46" y="36" text-anchor="end" class="sb-label">parse</text>
  <!-- powerprofilesctl: ~810ms dominates -->
  <rect x="50" y="38" width="50" height="190" rx="2" fill="#c0392b" opacity="0.85"/>
  <text x="46" y="136" text-anchor="end" class="sb-label">dbus</text>
  <text x="75" y="136" text-anchor="middle" class="sb-time" fill="rgba(255,255,255,0.6)">~810ms</text>
  <text x="70" y="250" text-anchor="middle" class="sb-time">Stage 2</text>
</svg>

The first rewrite eliminated almost every subprocess. A single Rust binary ran as a long-lived daemon, writing JSON lines to stdout. Waybar read these lines as they appeared, with no polling interval on Waybar's side and no repeated process spawning.

<svg viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" class="diagram-proc-roundtrip" role="img" aria-label="Diagram: /proc serialisation round-trip">
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
  <line x1="330" y1="8" x2="330" y2="215" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4,4"/>
  <!-- Row 1: open -->
  <text x="14" y="50" class="d-mono">open("/proc/123/stat")</text>
  <line x1="230" y1="46" x2="380" y2="46" class="d-arrow"/>
  <text x="390" y="50" class="d-label">allocate fd, find inode</text>
  <!-- Return: fd -->
  <text x="14" y="66" class="d-mono" fill="rgba(200,160,160,0.8)">&#x2190; fd</text>
  <line x1="380" y1="62" x2="80" y2="62" class="d-arrow-back"/>
  <!-- Row 2: read -->
  <text x="14" y="90" class="d-mono">read(fd, buf, 4096)</text>
  <line x1="210" y1="86" x2="380" y2="86" class="d-arrow"/>
  <text x="390" y="90" class="d-label">walk task_struct, format</text>
  <text x="390" y="104" class="d-label">52 fields as ASCII text</text>
  <!-- Row 3: parse back -->
  <text x="14" y="130" class="d-mono">"14523 (firefox) S 1 ..."</text>
  <line x1="380" y1="126" x2="250" y2="126" class="d-arrow-back"/>
  <text x="390" y="130" class="d-dim">only need fields 14 and 15</text>
  <!-- Row 4: close -->
  <text x="14" y="158" class="d-mono">close(fd)</text>
  <line x1="120" y1="154" x2="380" y2="154" class="d-arrow"/>
  <text x="390" y="158" class="d-label">release fd</text>
  <!-- Annotation -->
  <text x="350" y="178" text-anchor="middle" class="d-dim" font-size="10">Each arrow = syscall instruction (MSR-based kernel entry on x86-64; replaces legacy int 0x80)</text>
  <!-- Insight -->
  <rect x="14" y="184" width="672" height="28" rx="4" fill="rgba(168,200,160,0.08)" stroke="rgba(168,200,160,0.2)"/>
  <text x="350" y="203" text-anchor="middle" class="d-dim" font-size="11">The kernel has the numbers. It formats them as text. We parse the text back. A serialisation round-trip through ASCII — per PID, per file, per sample.</text>
</svg>

The key changes:

**Direct /proc parsing.** Instead of `cat /proc/stat | awk`, the daemon opened `/proc/stat` once, kept the file descriptor, and on each tick called `lseek(fd, 0, SEEK_SET)` followed by `read()`. The kernel regenerates the virtual file contents on each read from offset 0, but the open/close overhead is eliminated. Same pattern for `/proc/meminfo`, `/proc/loadavg`.

**In-memory delta computation.** CPU usage is computed from the difference in jiffies between two samples. The daemon kept the previous sample in memory and computed deltas on each tick. No need for an external tool, no need for two reads with a sleep in between.

**Per-PID metrics via /proc/[pid]/.** For the top-process breakdown (which processes are using the most CPU, memory, IO), the daemon walked `/proc/` with `readdir()`, filtered for numeric directory names, then for each PID opened and parsed:
- `/proc/[pid]/stat` -- CPU time (utime, stime fields)
- `/proc/[pid]/statm` -- RSS in pages
- `/proc/[pid]/io` -- read_bytes, write_bytes

**[serde_json](https://github.com/serde-rs/json) for output.** The daemon serialised a struct to JSON using [serde](https://serde.rs/). Convenient and correct, but not free.

The result was approximately 700ms per sample. Better than 2 seconds, but embarrassingly slow for a compiled binary. Profiling made the bottleneck obvious: one remaining subprocess was eating almost all of it. `powerprofilesctl get` spawns a process, connects to D-Bus, queries the power profile daemon, deserialises the response, and exits. One command, ~810ms. The /proc walk, delta computation, and JSON serialisation all fit in the remaining time.

The Rust binary wasn't slow. The single subprocess it still shelled out to was slow. The lesson was immediate: a compiled daemon that spawns one subprocess is only as fast as that subprocess.

---

## <svg class="stage-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M6 3 L14 3 L14 7 L11 10 L14 13 L14 17 L6 17 L6 13 L9 10 L6 7 Z" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linejoin="round"/></svg> Stage 2.5: Killing the Subprocess, Then the Overhead (~15ms)

<svg class="stage-breakdown" viewBox="0 0 140 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stage 2.5 time breakdown">
  <style>
    .sb-label { fill: rgba(255,255,255,0.7); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-time  { fill: rgba(255,255,255,0.5); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-title { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 10px; font-weight: bold; }
    .sb-struck { stroke: rgba(255,255,255,0.5); stroke-width: 1; }
  </style>
  <text x="70" y="14" text-anchor="middle" class="sb-title">~15ms</text>
  <!-- /proc reads: dominates at this scale -->
  <rect x="50" y="24" width="50" height="160" rx="2" fill="#e67e22" opacity="0.7"/>
  <text x="46" y="108" text-anchor="end" class="sb-label">/proc</text>
  <!-- dbus: eliminated (greyed + struck) -->
  <rect x="50" y="188" width="50" height="30" rx="2" fill="rgba(255,255,255,0.06)"/>
  <line x1="48" y1="203" x2="102" y2="203" class="sb-struck"/>
  <text x="46" y="206" text-anchor="end" class="sb-label" fill="rgba(255,255,255,0.3)">dbus</text>
  <text x="70" y="250" text-anchor="middle" class="sb-time">Stage 2.5</text>
</svg>

The 700ms number had one obvious cause. Eliminating `powerprofilesctl` was the first fix, and the rest followed in quick succession as a cascade of diminishing returns:

1. **sysfs instead of D-Bus: 700ms → 28ms.** The power profile that `powerprofilesctl` spent ~810ms querying via D-Bus is exposed directly at `/sys/firmware/acpi/platform_profile`. A single file read, no IPC, no subprocess. The entire 700ms was one subprocess.
2. **Reusable read buffers: ~900 allocations eliminated.** The initial implementation allocated a new `String` for each `/proc/[pid]/*` read. With 300+ PIDs and 3 files each, that was ~900 allocations and deallocations per sample. Switching to a single stack-allocated `[u8; 8192]` buffer reused across all reads eliminated the allocation overhead entirely.
3. **Skip kernel threads: halved PID count (~250 fewer).** Kernel threads (kworkers, ksoftirqd, migration threads) have no meaningful CPU, memory, or IO stats for a desktop status bar. Filtering them out by checking whether the virtual size is zero in `/proc/[pid]/stat` avoided unnecessary IO reads for 250+ PIDs.
4. **Byte-level parsing: reduced per-PID parse cost.** The initial parser used Rust's `str::split()` and `parse::<u64>()` on each `/proc/[pid]/stat` line. Replacing this with a hand-rolled byte scanner that walks the buffer once, skipping fields by counting spaces and converting digits inline, cut the parsing cost substantially.

Result: ~15ms per sample on a typical desktop. The remaining cost was the /proc walk itself: still hundreds of syscalls for the per-PID breakdown.

---

---

<div class="emphasis-block">

Before I started this project, this was about the limit of what I knew. 15ms per sample -- roughly where the established tools land. <a href="https://gitlab.com/procps-ng/procps">procps-ng</a> (<code>top</code>) walks <code>/proc</code> the same way: <code>openat()</code> per PID, read the stat files, parse the ASCII, close. It mitigates the cost with cached directory file descriptors, a gperf-generated hash table for field lookup, and double-buffered history arrays, but the fundamental pattern is the same -- hundreds of <code>/proc</code> reads per refresh. <a href="https://github.com/aristocratos/btop">btop++</a> does it with C++ <code>ifstream</code> per file per cycle, normalising CPU% against system ticks rather than wall-clock deltas.

Both tools are well-optimised for the /proc model. But they are still bound by it. Was 15ms the floor, or could you go further if you stopped reading files entirely? It was time to consult the kernel documentation -- specifically, the <a href="https://docs.kernel.org/bpf/">BPF documentation</a> and the <code>bpf(2)</code> man page -- and find out what happens when you stop asking the kernel for data and start running your code inside it.

</div>

---

---

## <svg class="stage-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><line x1="6" y1="7" x2="6" y2="13" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/><line x1="10" y1="7" x2="10" y2="13" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/><line x1="14" y1="7" x2="14" y2="13" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/><line x1="4" y1="10" x2="16" y2="10" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/><circle cx="6" cy="7" r="1" fill="#2ecc71" opacity="0.8"/><circle cx="14" cy="13" r="1" fill="#2ecc71" opacity="0.8"/></svg> Stage 3: Eliminating /proc Walks Entirely (sub-1ms)

<svg class="stage-breakdown" viewBox="0 0 140 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stage 3 time breakdown">
  <style>
    .sb-label { fill: rgba(255,255,255,0.7); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-time  { fill: rgba(255,255,255,0.5); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-title { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 10px; font-weight: bold; }
    .sb-struck { stroke: rgba(255,255,255,0.5); stroke-width: 1; }
  </style>
  <text x="70" y="14" text-anchor="middle" class="sb-title">&lt;1ms</text>
  <!-- BPF map read: small -->
  <rect x="50" y="24" width="50" height="40" rx="2" fill="#2ecc71" opacity="0.6"/>
  <text x="46" y="48" text-anchor="end" class="sb-label">BPF map</text>
  <!-- sysfs pread: small -->
  <rect x="50" y="66" width="50" height="30" rx="2" fill="#f39c12" opacity="0.5"/>
  <text x="46" y="84" text-anchor="end" class="sb-label">sysfs</text>
  <!-- /proc reads: eliminated -->
  <rect x="50" y="110" width="50" height="50" rx="2" fill="rgba(255,255,255,0.06)"/>
  <line x1="48" y1="135" x2="102" y2="135" class="sb-struck"/>
  <text x="46" y="138" text-anchor="end" class="sb-label" fill="rgba(255,255,255,0.3)">/proc</text>
  <!-- dbus: eliminated -->
  <rect x="50" y="164" width="50" height="30" rx="2" fill="rgba(255,255,255,0.06)"/>
  <line x1="48" y1="179" x2="102" y2="179" class="sb-struck"/>
  <text x="46" y="182" text-anchor="end" class="sb-label" fill="rgba(255,255,255,0.3)">dbus</text>
  <text x="70" y="250" text-anchor="middle" class="sb-time">Stage 3</text>
</svg>

### The /proc problem

Walking `/proc` for per-PID metrics is expensive because it is fundamentally a filesystem operation. For each PID: open, read, close, parse -- for three files per process, hundreds of processes. The kernel formats ~52 fields into ASCII text that we immediately parse back into the 2-3 numbers we need. The syscall count multiplies out fast:

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
  <text x="300" y="110" text-anchor="middle" class="sc-dim">Each syscall = transition to kernel mode.</text>
  <text x="300" y="128" text-anchor="middle" class="sc-dim">Each read = kernel formats ASCII text we immediately parse back into numbers.</text>
  <text x="300" y="146" text-anchor="middle" class="sc-dim">Each close = teardown of fd we'll just reopen next sample.</text>
</svg>

The full walk per sample:

1. `opendir("/proc")` -- one syscall
2. `readdir()` in a loop -- one syscall per batch of directory entries, hundreds of entries on a running system
3. Filter for numeric names (PIDs) -- string parsing in userspace
4. For each PID, `open("/proc/[pid]/stat")` -- one syscall
5. `read()` the contents -- one syscall, plus the kernel formats ~52 fields into a text buffer
6. `close()` -- one syscall
7. Parse the text to extract the 2-3 fields we actually need -- string scanning in userspace
8. Repeat for `/proc/[pid]/statm` and `/proc/[pid]/io` -- 6 more syscalls per PID

With 200-400 PIDs on a typical desktop, that is 1,500-3,000+ syscalls just for the per-process breakdown (the diagram above shows the worked example for 300 PIDs). Each syscall is a transition to kernel mode, and each `/proc` read triggers the kernel to walk its internal data structures and generate the result on demand.

### eBPF: reading kernel data in-kernel

The solution was to move the data collection into the kernel itself using eBPF. A BPF program attached to the `sched_switch` tracepoint fires every time the scheduler switches between tasks. At that moment, the kernel has the outgoing task's `task_struct` right there -- its PID, its accumulated CPU time, its memory maps, its IO accounting. Instead of asking the kernel to format this data into text files and then parsing it back, the BPF program reads the values directly from the kernel's data structures and writes them into a BPF hash map.

<svg viewBox="0 0 620 380" xmlns="http://www.w3.org/2000/svg" class="diagram-ebpf-rings" role="img" aria-label="Diagram: eBPF privilege rings — sandboxed code running inside the kernel">
  <style>
    .ring-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 13px; }
    .ring-title { fill: rgba(255,255,255,0.95); font-family: 'Lora', serif; font-size: 14px; font-weight: bold; }
    .ring-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 11px; }
    .ring-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 11px; font-style: italic; }
  </style>
  <!-- Ring 0 outer box -->
  <rect x="10" y="10" width="600" height="250" rx="12" fill="rgba(39,174,96,0.06)" stroke="rgba(39,174,96,0.3)" stroke-width="1.5"/>
  <text x="30" y="36" class="ring-title">Ring 0 (Kernel)</text>
  <!-- eBPF sandbox -->
  <rect x="30" y="50" width="260" height="130" rx="8" fill="rgba(46,204,113,0.08)" stroke="rgba(46,204,113,0.4)" stroke-width="1" stroke-dasharray="6,3"/>
  <text x="50" y="74" class="ring-label" font-weight="600">eBPF Sandbox</text>
  <text x="50" y="96" class="ring-mono">• Verified bytecode</text>
  <text x="50" y="114" class="ring-mono">• Can't crash the kernel</text>
  <text x="50" y="132" class="ring-mono">• Bounded execution time</text>
  <text x="50" y="150" class="ring-mono">• Direct struct access</text>
  <text x="50" y="168" class="ring-mono">• No text serialisation</text>
  <!-- Kernel data structures (BPF reads from these) -->
  <text x="360" y="60" text-anchor="middle" class="ring-dim">kernel structs</text>
  <rect x="320" y="66" width="130" height="28" rx="4" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.1)"/>
  <text x="385" y="84" text-anchor="middle" class="ring-mono">task_struct</text>
  <rect x="320" y="98" width="130" height="28" rx="4" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.1)"/>
  <text x="385" y="116" text-anchor="middle" class="ring-mono">mm_struct</text>
  <rect x="320" y="130" width="130" height="28" rx="4" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.1)"/>
  <text x="385" y="148" text-anchor="middle" class="ring-mono">task->ioac</text>
  <!-- Arrows: sandbox ← reads from structs -->
  <defs>
    <marker id="rng-arr" viewBox="0 0 10 7" refX="1" refY="3.5" markerWidth="7" markerHeight="5" orient="auto-start-reverse"><polygon points="0 0,10 3.5,0 7" fill="rgba(46,204,113,0.5)"/></marker>
  </defs>
  <line x1="295" y1="100" x2="316" y2="80" stroke="rgba(46,204,113,0.4)" stroke-width="1.5" marker-start="url(#rng-arr)"/>
  <line x1="295" y1="120" x2="316" y2="112" stroke="rgba(46,204,113,0.4)" stroke-width="1.5" marker-start="url(#rng-arr)"/>
  <line x1="295" y1="140" x2="316" y2="144" stroke="rgba(46,204,113,0.4)" stroke-width="1.5" marker-start="url(#rng-arr)"/>
  <!-- BPF maps bridge -->
  <text x="160" y="230" text-anchor="middle" class="ring-mono">↕ BPF maps (shared memory)</text>
  <!-- Divider -->
  <line x1="10" y1="260" x2="610" y2="260" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <!-- Ring 3 -->
  <rect x="10" y="260" width="600" height="110" rx="12" fill="rgba(52,152,219,0.06)" stroke="rgba(52,152,219,0.25)" stroke-width="1.5"/>
  <text x="30" y="288" class="ring-title">Ring 3 (Userspace)</text>
  <text x="50" y="312" class="ring-mono">rstat daemon</text>
  <text x="50" y="330" class="ring-mono">• Single batch read of BPF map</text>
  <text x="50" y="346" class="ring-mono">• No /proc  • No text parsing</text>
  <!-- Insight box -->
  <rect x="310" y="276" width="285" height="60" rx="6" fill="rgba(168,200,160,0.08)" stroke="rgba(168,200,160,0.2)"/>
  <text x="320" y="296" class="ring-dim">Instead of asking the kernel to format data</text>
  <text x="320" y="312" class="ring-dim">into text files, send a verified program into</text>
  <text x="320" y="328" class="ring-dim">the kernel. It reads structs directly.</text>
</svg>

eBPF is not a hack or a backdoor. It's a statically verified sandbox. The kernel's verifier proves the program can't crash, loop forever, or access memory it shouldn't. It's the kernel giving you a supervised desk in its office.

**The custom BPF loader.** The standard approach would be to use [aya](https://github.com/aya-rs/aya) or [libbpf-rs](https://github.com/libbpf/libbpf-rs), high-level frameworks that handle ELF parsing, map creation, relocation, and program loading. These were tried and discarded. aya pulls in [tokio](https://tokio.rs/) (an async runtime), libbpf-rs pulls in [libbpf-sys](https://github.com/libbpf/libbpf-sys) with its own C build step. Both add hundreds of milliseconds to startup time and megabytes to binary size. For a program that loads three tracepoint probes and three maps, this is absurd.

Instead, `rstat` implements its own loader in ~100 lines of Rust:

<svg viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg" class="diagram-bpf-loader" role="img" aria-label="BPF loader pipeline: ELF parse → map create → relocate → load → attach">
  <style>
    .bl-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 11px; }
    .bl-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 10px; }
    .bl-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 9px; font-style: italic; }
    .bl-box   { fill: rgba(0,0,0,0.2); stroke: rgba(46,204,113,0.3); stroke-width: 1; rx: 6; }
    .bl-arr   { stroke: rgba(168,200,160,0.4); stroke-width: 1.5; fill: none; marker-end: url(#bla); }
  </style>
  <defs><marker id="bla" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(168,200,160,0.4)"/></marker></defs>
  <!-- Step 1 -->
  <rect x="10" y="8" width="200" height="30" class="bl-box"/>
  <text x="110" y="28" text-anchor="middle" class="bl-mono">ELF parse (goblin)</text>
  <text x="230" y="28" class="bl-dim">pure Rust, no C deps</text>
  <line x1="110" y1="38" x2="110" y2="50" class="bl-arr"/>
  <!-- Step 2 -->
  <rect x="10" y="52" width="200" height="30" class="bl-box"/>
  <text x="110" y="72" text-anchor="middle" class="bl-mono">map create (bpf syscall)</text>
  <text x="230" y="72" class="bl-dim">BPF_MAP_CREATE</text>
  <line x1="110" y1="82" x2="110" y2="94" class="bl-arr"/>
  <!-- Step 3 -->
  <rect x="10" y="96" width="200" height="30" class="bl-box"/>
  <text x="110" y="116" text-anchor="middle" class="bl-mono">relocate (patch LD_IMM64)</text>
  <text x="230" y="116" class="bl-dim">symbol → map fd</text>
  <line x1="110" y1="126" x2="110" y2="138" class="bl-arr"/>
  <!-- Step 4 -->
  <rect x="10" y="140" width="200" height="30" class="bl-box"/>
  <text x="110" y="160" text-anchor="middle" class="bl-mono">load (bpf syscall)</text>
  <text x="230" y="160" class="bl-dim">BPF_PROG_LOAD</text>
  <line x1="110" y1="170" x2="110" y2="182" class="bl-arr"/>
  <!-- Step 5 -->
  <rect x="10" y="184" width="200" height="30" class="bl-box"/>
  <text x="110" y="204" text-anchor="middle" class="bl-mono">attach (perf_event)</text>
  <text x="230" y="198" class="bl-dim">perf_event_open</text>
  <text x="230" y="210" class="bl-dim">+ ioctl SET_BPF + ENABLE</text>
</svg>

One subtlety: `PERF_EVENT_IOC_SET_BPF` only needs to be called on a single CPU's perf event fd (CPU 0). The kernel's `tp_event` is shared, so the BPF program fires system-wide regardless of which CPU's fd was used for attachment. `PERF_EVENT_IOC_ENABLE`, however, must be called on every CPU's fd to actually enable the tracepoint event on each CPU. This was discovered empirically after initially attaching to all CPUs and getting duplicate firings.

### What was tried and discarded: block_rq_issue for IO

The initial approach was to collect all three per-PID metrics (CPU, memory, IO) entirely within BPF. CPU time was straightforward via `sched_switch`. For IO, the `block_rq_issue` tracepoint looked promising since it fires when the block layer issues an IO request.

The problem: PID attribution in the block layer is unreliable. `block_rq_issue` fires from interrupt or kernel worker context, not from the process that initiated the IO. `bpf_get_current_pid_tgid()` returns whichever PID happens to be running on that CPU when the block request is submitted, which may be a kworker thread, the block device's IRQ handler, or a completely unrelated process. The resulting per-PID IO stats were essentially random.

This was discarded. IO collection stayed with `/proc/[pid]/io` and delta tracking in userspace.

### The empty comm field problem

When the BPF map contained entries created by the (now-discarded) block layer path, some PIDs had all-zero `comm` fields because `bpf_get_current_comm()` was returning the kernel worker's name rather than the originating process. Even after removing the block layer tracepoint, this pattern served as a reminder: always validate BPF-collected data and implement fallbacks. The daemon fell back to reading `/proc/[pid]/comm` when a BPF entry's comm was all zeroes.

Collecting all three metrics (CPU, RSS, IO) directly from `task_struct` fields within the `sched_switch` probe worked cleanly.

<svg viewBox="0 0 580 240" xmlns="http://www.w3.org/2000/svg" class="diagram-sched-switch" role="img" aria-label="Diagram: sched_switch tracepoint firing on context switch">
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
  <rect x="20" y="120" width="240" height="76" class="ss-box"/>
  <text x="35" y="138" class="ss-label">BPF probe reads outgoing task's:</text>
  <text x="45" y="156" class="ss-mono">• cpu_ns</text>
  <text x="45" y="172" class="ss-mono">• mm&#x2192;rss_stat</text>
  <text x="45" y="188" class="ss-mono">• task&#x2192;ioac</text>
  <line x1="260" y1="158" x2="320" y2="158" class="ss-arr"/>
  <!-- Step 4: Map write -->
  <rect x="325" y="140" width="240" height="40" rx="6" fill="rgba(46,204,113,0.08)" stroke="rgba(46,204,113,0.3)"/>
  <text x="445" y="165" text-anchor="middle" class="ss-mono">writes to BPF map[pid]</text>
  <!-- Insight -->
  <rect x="10" y="206" width="560" height="22" rx="4" fill="rgba(168,200,160,0.08)" stroke="rgba(168,200,160,0.2)"/>
  <text x="290" y="222" text-anchor="middle" class="ss-dim">Every task eventually gets switched out. At that moment, all its accounting data is right there in the task_struct.</text>
</svg>

### RSS from mm->rss_stat

When the BPF probe fires on `sched_switch`, the current task's `task_struct` is available via `bpf_get_current_task()`. The task's memory descriptor (`task->mm`) contains `rss_stat`, an array of `percpu_counter` structs indexed by memory type:

- Index 0: file-backed pages (page cache)
- Index 1: anonymous pages (heap, stack)
- Index 2: swap entries
- Index 3: shared memory pages

RSS is the sum of indices 0, 1, and 3. The BPF probe reads the `.count` field of each `percpu_counter`, which is the approximate value. The exact value would require summing the per-CPU delta arrays (`percpu_counter->counters[cpu]`), but BPF cannot iterate over per-CPU data. The approximate value has a maximum error of `batch * num_cpus` pages (where `batch` is typically 32), giving an accuracy of +/-512KB on a 4-core system (32 * 4 = 128 pages * 4KB/page). For a status bar, this is more than sufficient.

Note: `rss_stat` uses `percpu_counter` on kernel 6.2+. Earlier kernels use `atomic_long_t` per memory type, which is exact but slightly more expensive to read.

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

The task accounting structure (`task->ioac`) contains cumulative `read_bytes` and `write_bytes` counters, the same values exposed via `/proc/[pid]/io`. Reading them directly in the BPF probe eliminates the filesystem entirely:

```c
    __u64 rb = 0, wb = 0;
    bpf_probe_read_kernel(&rb, sizeof(rb), &task->ioac.read_bytes);
    bpf_probe_read_kernel(&wb, sizeof(wb), &task->ioac.write_bytes);
    s->io_rb = rb;
    s->io_wb = wb;
```

These are cumulative counters. Userspace computes deltas between ticks by storing the previous snapshot in a sorted vector and performing binary search by PID.

### Process state from scheduler transitions

Load averages tell you the system is stressed. They don't tell you *why*. A load average of 8.0 on a 4-core system could mean 8 CPU-bound processes competing for time, or it could mean 4 processes are running while 4 are stuck in uninterruptible sleep waiting on a dead NFS mount. The distinction matters. One is normal, the other means something is broken.

Linux tracks two pathological process states that are invisible to most monitoring tools:

- **D (uninterruptible sleep)**: the process is blocked on IO or a kernel lock and cannot be interrupted, not even by `kill -9`. Common causes: NFS timeouts, disk IO stalls, journaling waits, driver bugs. D-state processes inflate the load average without consuming CPU, making load numbers misleading.
- **Z (zombie)**: the process has exited but its parent hasn't called `wait()` to collect its exit status. The process occupies a PID and a slot in the process table but consumes no resources. A handful of zombies is normal; hundreds suggest a buggy parent that's leaking children.

Both states are observable from the scheduler:

<svg viewBox="0 0 660 200" xmlns="http://www.w3.org/2000/svg" class="diagram-dz-lifecycle" role="img" aria-label="D/Z state lifecycle state machine">
  <style>
    .dz-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 11px; }
    .dz-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 10px; }
    .dz-dim   { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 9px; font-style: italic; }
    .dz-state { rx: 8; stroke-width: 1.5; }
    .dz-arr   { stroke-width: 1.5; fill: none; marker-end: url(#dza); }
  </style>
  <defs><marker id="dza" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(168,200,160,0.5)"/></marker></defs>
  <!-- D-state path (top row) -->
  <rect x="10" y="20" width="110" height="36" class="dz-state" fill="rgba(52,152,219,0.1)" stroke="rgba(52,152,219,0.4)"/>
  <text x="65" y="43" text-anchor="middle" class="dz-label" font-weight="600">Running</text>
  <line x1="120" y1="38" x2="210" y2="38" class="dz-arr" stroke="rgba(192,57,43,0.5)"/>
  <text x="165" y="30" text-anchor="middle" class="dz-mono" font-size="8">sched_switch</text>
  <text x="165" y="54" text-anchor="middle" class="dz-dim">prev_state &amp; 0x02</text>
  <rect x="215" y="20" width="110" height="36" class="dz-state" fill="rgba(192,57,43,0.1)" stroke="rgba(192,57,43,0.4)"/>
  <text x="270" y="43" text-anchor="middle" class="dz-label" font-weight="600" fill="#e74c3c">D-state</text>
  <line x1="325" y1="38" x2="420" y2="38" class="dz-arr" stroke="rgba(46,204,113,0.5)"/>
  <text x="372" y="30" text-anchor="middle" class="dz-mono" font-size="8">sched_switch in</text>
  <text x="372" y="54" text-anchor="middle" class="dz-dim">task wakes up</text>
  <rect x="425" y="20" width="110" height="36" class="dz-state" fill="rgba(46,204,113,0.08)" stroke="rgba(46,204,113,0.3)"/>
  <text x="480" y="43" text-anchor="middle" class="dz-label">Cleared</text>
  <!-- Z-state path (bottom row) -->
  <rect x="10" y="100" width="110" height="36" class="dz-state" fill="rgba(52,152,219,0.1)" stroke="rgba(52,152,219,0.4)"/>
  <text x="65" y="123" text-anchor="middle" class="dz-label" font-weight="600">Running</text>
  <line x1="120" y1="118" x2="210" y2="118" class="dz-arr" stroke="rgba(192,57,43,0.5)"/>
  <text x="165" y="108" text-anchor="middle" class="dz-mono" font-size="8">sched_process_exit</text>
  <rect x="215" y="100" width="110" height="36" class="dz-state" fill="rgba(142,68,173,0.1)" stroke="rgba(142,68,173,0.4)"/>
  <text x="270" y="123" text-anchor="middle" class="dz-label" font-weight="600" fill="#9b59b6">Z-state</text>
  <line x1="325" y1="118" x2="420" y2="118" class="dz-arr" stroke="rgba(46,204,113,0.5)"/>
  <text x="372" y="108" text-anchor="middle" class="dz-mono" font-size="8">sched_process_free</text>
  <text x="372" y="134" text-anchor="middle" class="dz-dim">parent reaps</text>
  <rect x="425" y="100" width="110" height="36" class="dz-state" fill="rgba(46,204,113,0.08)" stroke="rgba(46,204,113,0.3)"/>
  <text x="480" y="123" text-anchor="middle" class="dz-label">Deleted</text>
  <!-- Annotations -->
  <text x="330" y="165" text-anchor="middle" class="dz-dim">D-state entries persist while the process is stuck. Z-state entries persist until the parent reaps.</text>
  <text x="330" y="180" text-anchor="middle" class="dz-dim">BPF map mirrors the kernel's own lifecycle. No polling, no /proc walk, no missed entries.</text>
</svg>

The `prev_state` argument to `sched_switch` encodes the outgoing task's state: bit 1 (`0x02`) indicates `TASK_UNINTERRUPTIBLE`. When a D-state process is switched back in (woke up from its uninterruptible wait), the probe clears the flag. Zombie entries persist in the BPF map for exactly as long as the zombie exists in the process table.

Userspace collects up to 10 D/Z entries during the existing map iteration, requiring no extra passes or syscalls. They're rendered at the top of the CPU section:

```
 CPU    45°C    12%    2.1/4.5 GHz
    D  find
    D  git
    Z  sd_voxin
 5.1%  firefox
 2.3%  claude
```

The `D` and `Z` labels replace the CPU percentage because those processes aren't consuming CPU; they're stuck. Seeing `D find` at the top of the CPU list while `load: 6.2` is displayed immediately explains the discrepancy between high load and low CPU utilisation. No separate tool, no `ps aux | grep D`. Just glance at the status bar.

### System-wide metrics without /proc

With per-PID metrics handled by BPF, the remaining system-wide metrics were also migrated away from /proc:

- **Total/free memory**: `libc::sysinfo()` syscall. Returns `totalram`, `freeram`, `bufferram`, `mem_unit` in a single syscall. Replaces parsing `/proc/meminfo` (which involves reading a multi-line text file, scanning for specific field names, parsing the values and units).
- **Load averages**: Also from `sysinfo()`. Replaces `/proc/loadavg`. The load values are in fixed-point format (divide by 65536.0 for float).
- **Core count**: `sysconf(_SC_NPROCESSORS_ONLN)`. A single syscall, cached by libc.

### What was tried and discarded: idle-time CPU%

The natural approach to computing system CPU utilisation is to track idle time: `cpu% = 100 - (idle_ns / total_ns * 100)`. The BPF probe can track idle time by accumulating time spent in PID 0 (the swapper/idle task) during `sched_switch`.

This works on kernels with periodic ticks, but fails on modern kernels with `CONFIG_NO_HZ_IDLE` (tickless idle):

<svg viewBox="0 0 620 110" xmlns="http://www.w3.org/2000/svg" class="diagram-tickless-cascade" role="img" aria-label="Tickless idle failure cascade">
  <style>
    .tc-mono { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 10px; }
    .tc-dim  { fill: rgba(255,255,255,0.5); font-family: 'Lora', serif; font-size: 9px; }
    .tc-box  { fill: rgba(0,0,0,0.2); stroke: rgba(192,57,43,0.3); stroke-width: 1; rx: 4; }
    .tc-arr  { stroke: rgba(192,57,43,0.4); stroke-width: 1; fill: none; marker-end: url(#tca); }
  </style>
  <defs><marker id="tca" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(192,57,43,0.4)"/></marker></defs>
  <!-- Step 1 -->
  <rect x="2" y="6" width="90" height="40" class="tc-box"/>
  <text x="47" y="22" text-anchor="middle" class="tc-mono" font-size="9">CPU enters</text>
  <text x="47" y="36" text-anchor="middle" class="tc-mono" font-size="9">idle</text>
  <line x1="92" y1="26" x2="105" y2="26" class="tc-arr"/>
  <!-- Step 2 -->
  <rect x="107" y="6" width="90" height="40" class="tc-box"/>
  <text x="152" y="22" text-anchor="middle" class="tc-mono" font-size="9">NO_HZ disables</text>
  <text x="152" y="36" text-anchor="middle" class="tc-mono" font-size="9">tick</text>
  <line x1="197" y1="26" x2="210" y2="26" class="tc-arr"/>
  <!-- Step 3 -->
  <rect x="212" y="6" width="90" height="40" class="tc-box"/>
  <text x="257" y="22" text-anchor="middle" class="tc-mono" font-size="9">No</text>
  <text x="257" y="36" text-anchor="middle" class="tc-mono" font-size="9">sched_switch</text>
  <line x1="302" y1="26" x2="315" y2="26" class="tc-arr"/>
  <!-- Step 4 -->
  <rect x="317" y="6" width="90" height="40" class="tc-box"/>
  <text x="362" y="22" text-anchor="middle" class="tc-mono" font-size="9">PID 0 not</text>
  <text x="362" y="36" text-anchor="middle" class="tc-mono" font-size="9">accounted</text>
  <line x1="407" y1="26" x2="420" y2="26" class="tc-arr"/>
  <!-- Step 5 -->
  <rect x="422" y="6" width="90" height="40" class="tc-box"/>
  <text x="467" y="22" text-anchor="middle" class="tc-mono" font-size="9">idle_ns</text>
  <text x="467" y="36" text-anchor="middle" class="tc-mono" font-size="9">under-reported</text>
  <line x1="512" y1="26" x2="525" y2="26" class="tc-arr"/>
  <!-- Result -->
  <rect x="527" y="2" width="88" height="48" rx="4" fill="rgba(192,57,43,0.12)" stroke="rgba(192,57,43,0.5)" stroke-width="1.5"/>
  <text x="571" y="22" text-anchor="middle" class="tc-mono" font-size="10" fill="#e74c3c">CPU%</text>
  <text x="571" y="38" text-anchor="middle" class="tc-mono" font-size="10" fill="#e74c3c">reads 90%+</text>
  <!-- Annotation -->
  <text x="310" y="72" text-anchor="middle" class="tc-dim">On a 4-core system with 3 cores deeply idle, tracked idle_ns might reflect only 10% of actual idle time.</text>
  <text x="310" y="86" text-anchor="middle" class="tc-dim">CONFIG_NO_HZ_IDLE is the default on virtually all modern distributions.</text>
</svg>

The fix was to invert the computation. Instead of tracking idle time and subtracting from total, sum all per-PID `busy_ns` values (which *are* accurately tracked, because every non-idle task does get scheduled out eventually) and compute:

```
cpu% = sum(all per-PID busy_ns deltas) / (elapsed_seconds * num_cores * 1e9) * 100
```

This gives accurate CPU utilisation regardless of the kernel's tick configuration.

### What was discarded: D-Bus for power profile

The original script called `powerprofilesctl get`, which spawns a process that makes a D-Bus call to the power-profiles-daemon. D-Bus involves socket communication, message serialisation, and the overhead of the D-Bus daemon itself. The power profile is exposed directly via sysfs at `/sys/firmware/acpi/platform_profile`: a single file read, no IPC, no subprocess.

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
  <text x="175" y="35" text-anchor="middle" class="ba-title">Before (Rust + /proc)</text>
  <text x="30" y="60" class="ba-mono">Every 2s, for each of 300 PIDs:</text>
  <text x="40" y="80" class="ba-mono">open 3 files → read text → parse → close</text>
  <text x="40" y="100" class="ba-mono">= 2,700 syscalls</text>
  <text x="40" y="120" class="ba-mono">+ sysinfo() + sysfs reads</text>
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
  <text x="390" y="144" class="ba-mono">1 batch map read + 7 pread() = ~8 syscalls</text>
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

## <svg class="stage-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M11 1 L7 10 L12 10 L9 19" fill="none" stroke="#f1c40f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/></svg> Stage 4: Zero-Allocation Steady State

<svg class="stage-breakdown" viewBox="0 0 140 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stage 4 time breakdown">
  <style>
    .sb-label { fill: rgba(255,255,255,0.7); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-time  { fill: rgba(255,255,255,0.5); font-family: 'Courier New', monospace; font-size: 9px; }
    .sb-title { fill: rgba(255,255,255,0.9); font-family: 'Lora', serif; font-size: 10px; font-weight: bold; }
    .sb-struck { stroke: rgba(255,255,255,0.5); stroke-width: 1; }
  </style>
  <text x="70" y="14" text-anchor="middle" class="sb-title">&lt;1ms</text>
  <!-- BPF batch read -->
  <rect x="50" y="24" width="50" height="35" rx="2" fill="#2ecc71" opacity="0.6"/>
  <text x="46" y="44" text-anchor="end" class="sb-label">BPF batch</text>
  <!-- sysfs pread -->
  <rect x="50" y="61" width="50" height="25" rx="2" fill="#f39c12" opacity="0.5"/>
  <text x="46" y="76" text-anchor="end" class="sb-label">sysfs</text>
  <!-- hand-written JSON -->
  <rect x="50" y="88" width="50" height="15" rx="2" fill="#3498db" opacity="0.5"/>
  <text x="46" y="99" text-anchor="end" class="sb-label">JSON</text>
  <!-- serde: eliminated -->
  <rect x="50" y="116" width="50" height="30" rx="2" fill="rgba(255,255,255,0.06)"/>
  <line x1="48" y1="131" x2="102" y2="131" class="sb-struck"/>
  <text x="46" y="134" text-anchor="end" class="sb-label" fill="rgba(255,255,255,0.3)">serde</text>
  <!-- /proc: eliminated -->
  <rect x="50" y="150" width="50" height="30" rx="2" fill="rgba(255,255,255,0.06)"/>
  <line x1="48" y1="165" x2="102" y2="165" class="sb-struck"/>
  <text x="46" y="168" text-anchor="end" class="sb-label" fill="rgba(255,255,255,0.3)">/proc</text>
  <!-- dbus: eliminated -->
  <rect x="50" y="184" width="50" height="20" rx="2" fill="rgba(255,255,255,0.06)"/>
  <line x1="48" y1="194" x2="102" y2="194" class="sb-struck"/>
  <text x="46" y="197" text-anchor="end" class="sb-label" fill="rgba(255,255,255,0.3)">dbus</text>
  <text x="70" y="250" text-anchor="middle" class="sb-time">Stage 4</text>
</svg>

At this point, the sample loop was fast enough that allocator overhead and syscall count became the dominant factors. Profiling revealed several sources of heap allocation and unnecessary work:

### Eliminating HashMap

The BPF stats were initially stored in a `HashMap<u32, BpfPidStats>`, created fresh each tick, populated from the BPF map, used for delta computation, then dropped. HashMap allocation involves bucket array creation, hashing, and on drop, deallocation of the bucket array and any spilled entries.

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

For the 7 sysfs files read each tick, the original code called `lseek(fd, 0, SEEK_SET)` followed by `read(fd, buf, len)`. Two syscalls per file, 14 total.

`pread(fd, buf, len, 0)` combines both into a single syscall. Same result, half the syscalls, 7 instead of 14:

```rust
fn pread_raw(f: &fs::File, buf: &mut [u8]) -> usize {
    let n = unsafe { libc::pread(f.as_raw_fd(), buf.as_mut_ptr() as _, buf.len(), 0) };
    if n < 0 { 0 } else { n as usize }
}
```

### Pre-opened throttle sysfs files

GPU throttle status was read from `/sys/class/drm/card1/gt/gt0/throttle_reason_*`, a set of files discovered via `readdir()` at runtime. The initial implementation called `readdir()` each tick to enumerate the files, then opened, read, and closed each one.

Moved to init-time discovery: `readdir()` once at startup, open all matching files, store them in a `Vec<ThrottleFile>` with the file handle and a fixed-size name buffer. Each tick just does `pread()` on the pre-opened handles:

```rust
struct ThrottleFile { file: fs::File, name: [u8; 32], nl: u8 }
```

The throttle status output is built into a stack-allocated `[u8; 64]` buffer with no String and no allocation.

### Removing serde_json

serde_json is a powerful, correct, and general-purpose JSON serialiser. With derive-based serialisation (`#[derive(Serialize)]` + `to_string()`), it allocates a `String` for the output and runs through a generic `Formatter` that handles escaping and structure. It does not create intermediate `Value` trees in this mode, but the allocation and formatting overhead is still significant when called hundreds of times per second. For a fixed-schema output with two string fields and one string field that contains only ASCII and newlines, this is overkill.

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

**Result: 0.97ms average, 0.78ms minimum.** Zero heap allocations in the steady-state hot path. All memory is either stack-allocated (sample structs, Top5 arrays, sysfs buffers) or pre-allocated and reused (PidStats vecs, String buffers, BPF batch arrays).

---

## Things Tried and Discarded

### [io_uring](https://kernel.dk/io_uring.pdf) for batched sysfs reads

With 7 sysfs files to read each tick, io_uring's submission queue could theoretically batch all reads into a single `io_uring_enter()` syscall. The idea was to submit 7 read SQEs and reap 7 CQEs, reducing 7 pread syscalls to 1 io_uring_enter.

Discarded for two reasons:

1. **sysfs files are not real files.** They are kernel-generated virtual files. io_uring's async read path is optimised for block devices with actual IO queues. For sysfs, the kernel generates the content synchronously during the read, so there is nothing to parallelise. The io_uring SQE submission, CQE reaping, and ring buffer management overhead would likely exceed the savings from reducing 7 `pread()` calls to 1 `io_uring_enter()`.
2. **Code complexity.** io_uring requires ring buffer setup, memory mapping for the SQ/CQ rings, careful lifetime management, and error handling for partial completions. For 7 files, this is a net negative.

### block_rq_issue, idle-time CPU%, D-Bus, aya/libbpf-rs

These are covered in their respective Stage 3 sections above. In brief: `block_rq_issue` has unreliable PID attribution; idle-time tracking fails on tickless kernels; D-Bus was replaced by direct sysfs; aya and libbpf-rs have dependency trees disproportionate to the problem.

### PERF_EVENT_IOC_SET_BPF on all CPUs

The initial attachment logic called `ioctl(fd, PERF_EVENT_IOC_SET_BPF, prog_fd)` on every CPU's perf event fd. This is unnecessary. Tracepoint BPF programs are attached to the tracepoint's `tp_event`, which is a kernel-global structure. Setting the BPF program on one CPU's perf event fd is sufficient; the program fires on all CPUs.

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

<svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" class="diagram-architecture" role="img" aria-label="Architecture diagram: BPF probes, maps, userspace daemon, Waybar output">
  <style>
    .ar-title { fill: rgba(255,255,255,0.95); font-family: 'Lora', serif; font-size: 13px; font-weight: bold; }
    .ar-label { fill: rgba(255,255,255,0.85); font-family: 'Lora', serif; font-size: 11px; }
    .ar-mono  { fill: #c8d8c0; font-family: 'Courier New', monospace; font-size: 10px; }
    .ar-dim   { fill: rgba(255,255,255,0.45); font-family: 'Lora', serif; font-size: 9px; font-style: italic; }
    .ar-box   { rx: 8; stroke-width: 1; }
    .ar-arr   { stroke: rgba(168,200,160,0.5); stroke-width: 1.5; fill: none; marker-end: url(#ara); }
  </style>
  <defs><marker id="ara" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="rgba(168,200,160,0.5)"/></marker></defs>
  <!-- Kernel zone -->
  <rect x="10" y="10" width="660" height="170" class="ar-box" fill="rgba(39,174,96,0.05)" stroke="rgba(39,174,96,0.25)"/>
  <text x="30" y="32" class="ar-title">Kernel</text>
  <!-- BPF probes (injected code) -->
  <text x="105" y="48" text-anchor="middle" class="ar-dim">BPF probes (injected code)</text>
  <rect x="20" y="54" width="170" height="28" class="ar-box" fill="rgba(46,204,113,0.12)" stroke="rgba(46,204,113,0.4)" stroke-dasharray="5,3"/>
  <text x="105" y="73" text-anchor="middle" class="ar-mono">tp/sched/sched_switch</text>
  <rect x="20" y="86" width="170" height="28" class="ar-box" fill="rgba(46,204,113,0.12)" stroke="rgba(46,204,113,0.4)" stroke-dasharray="5,3"/>
  <text x="105" y="105" text-anchor="middle" class="ar-mono">tp/sched/process_exit</text>
  <rect x="20" y="118" width="170" height="28" class="ar-box" fill="rgba(46,204,113,0.12)" stroke="rgba(46,204,113,0.4)" stroke-dasharray="5,3"/>
  <text x="105" y="137" text-anchor="middle" class="ar-mono">tp/sched/process_free</text>
  <!-- BPF maps (shared memory) -->
  <text x="305" y="48" text-anchor="middle" class="ar-dim">BPF maps (kernel memory)</text>
  <rect x="240" y="54" width="130" height="28" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)"/>
  <text x="305" y="73" text-anchor="middle" class="ar-mono">stats (HASH)</text>
  <rect x="240" y="86" width="130" height="28" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)"/>
  <text x="305" y="105" text-anchor="middle" class="ar-mono">sys (ARRAY)</text>
  <rect x="240" y="118" width="130" height="28" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)"/>
  <text x="305" y="137" text-anchor="middle" class="ar-mono">sched_start (HASH)</text>
  <!-- Arrows: sched_switch → stats, sys, sched_start (all three maps) -->
  <line x1="190" y1="68" x2="235" y2="68" class="ar-arr"/>
  <line x1="190" y1="68" x2="235" y2="100" class="ar-arr"/>
  <line x1="190" y1="68" x2="235" y2="132" class="ar-arr"/>
  <!-- process_exit → stats -->
  <line x1="190" y1="100" x2="235" y2="68" class="ar-arr"/>
  <!-- process_free → stats, sched_start (deletes) -->
  <line x1="190" y1="132" x2="235" y2="68" class="ar-arr"/>
  <line x1="190" y1="132" x2="235" y2="132" class="ar-arr"/>
  <!-- sysfs files -->
  <rect x="420" y="54" width="230" height="92" class="ar-box" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.1)"/>
  <text x="535" y="72" text-anchor="middle" class="ar-label">sysfs (7 pre-opened files)</text>
  <text x="435" y="90" class="ar-mono">thermal_zone0/temp</text>
  <text x="435" y="104" class="ar-mono">cpufreq/scaling_cur_freq</text>
  <text x="435" y="118" class="ar-mono">drm/card1/gt/gt0/rps_act_freq_mhz</text>
  <text x="435" y="132" class="ar-mono">platform_profile ...</text>
  <!-- Divider -->
  <line x1="10" y1="188" x2="670" y2="188" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
  <!-- Userspace zone -->
  <rect x="10" y="188" width="660" height="160" class="ar-box" fill="rgba(52,152,219,0.04)" stroke="rgba(52,152,219,0.2)"/>
  <text x="30" y="210" class="ar-title">Userspace</text>
  <!-- rstat daemon -->
  <rect x="160" y="218" width="340" height="50" class="ar-box" fill="rgba(52,152,219,0.08)" stroke="rgba(52,152,219,0.3)"/>
  <text x="330" y="238" text-anchor="middle" class="ar-title">rstat daemon</text>
  <text x="330" y="256" text-anchor="middle" class="ar-mono">batch map read + 7× pread() + JSON emit</text>
  <!-- Arrows maps → daemon -->
  <line x1="305" y1="170" x2="305" y2="213" class="ar-arr"/>
  <!-- Arrow sysfs → daemon -->
  <line x1="535" y1="150" x2="440" y2="213" class="ar-arr"/>
  <!-- Waybar -->
  <rect x="250" y="292" width="160" height="34" class="ar-box" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)"/>
  <text x="330" y="314" text-anchor="middle" class="ar-label">Waybar (stdout → JSON)</text>
  <line x1="330" y1="268" x2="330" y2="287" class="ar-arr"/>
</svg>

### BPF probe (probe.bpf.c)

A single C source file compiled with [`clang`](https://clang.llvm.org/) `-target bpf -O2 -g`. Uses `vmlinux.h` for kernel type definitions (generated from BTF, avoids kernel header dependency).

Three tracepoint programs:

- **`handle_sched_switch`** (tracepoint/sched/sched_switch): On every context switch, accounts CPU time for the outgoing task (delta from `sched_start` map), snapshots RSS from `mm->rss_stat` and IO from `task->ioac`, stores cumulative values in the `stats` hash map. Also tracks D-state: if the outgoing task's `prev_state` has bit 1 set (`TASK_UNINTERRUPTIBLE`), marks it; clears the flag on the incoming task. Idle time (PID 0) is accumulated in the `sys` array map (currently unused in userspace -- CPU% is computed from busy_ns sum).
- **`handle_sched_exit`** (tracepoint/sched/sched_process_exit): Marks the exiting PID with `state = 'Z'` in the stats map. The entry persists so userspace can display zombies.
- **`handle_sched_free`** (tracepoint/sched/sched_process_free): Fires when the parent reaps a zombie. Deletes the PID from both `sched_start` and `stats` maps. This is the actual cleanup that prevents unbounded map growth.

Three BPF maps:

| Map | Type | Key | Value | Max Entries | Purpose |
|-----|------|-----|-------|-------------|---------|
| `stats` | HASH | u32 (PID) | pid_stats (56B) | 8192 | Per-PID cumulative stats + D/Z state |
| `sys` | ARRAY | u32 (0) | sys_stats (8B) | 1 | System-wide idle_ns |
| `sched_start` | HASH | u32 (PID) | sched_in (8B) | 8192 | Per-PID schedule-in timestamp |

### Rust daemon (main.rs)

A single-file ~795-line Rust program. No async runtime, no framework, no macros beyond `write!()`.

Key components:

- **Custom ELF loader** (`BpfLoader`): Parses BPF ELF via [goblin](https://github.com/m4b/goblin), creates maps with raw `bpf()` syscalls, resolves map relocations in program instructions, loads programs, attaches via perf_event.
- **Sorted vec with binary search** (`PidStats`): Two pre-allocated vecs swapped each tick. `clear()` + `push()` + `sort_unstable()` for population, `binary_search_by_key()` for O(log n) delta lookups.
- **Batch map reading**: `BPF_MAP_LOOKUP_BATCH` with pre-allocated key/value arrays. Falls back to iterative get_next_key + lookup if unsupported.
- **pread for sysfs**: 7 pre-opened file handles, `pread(fd, buf, len, 0)` per tick.
- **Stack-allocated top-N** (`Top5`, `IoTop5`): Fixed-size arrays with insertion, sorted on output.
- **D/Z state display** (`StateList`): Collects up to 10 blocked/zombie entries during the existing map iteration, rendered above CPU percentages in the tooltip.
- **Hand-written JSON**: Direct byte-level string building with a minimal escaper. No serde dependency.
- **Built-in benchmark mode**: `--bench N` runs N samples with 1ms spacing and reports avg/p50/p95/p99/min/max timings.

### Nix packaging (flake.nix)

Two-derivation build:

1. **rstat-probe**: `stdenv.mkDerivation` that compiles `probe.bpf.c` with `clang -target bpf -O2 -g` against libbpf headers and the local `vmlinux.h`. Produces `probe.bpf.o`.
2. **rstat**: `rustPlatform.buildRustPackage` that builds the Rust binary. `postInstall` copies the probe object from the first derivation into `$out/bin/` alongside the binary.

The binary discovers the probe at runtime by looking for `probe.bpf.o` adjacent to its own executable path, or accepts an explicit path as a command-line argument. The program requires `CAP_SYS_ADMIN` or equivalent (e.g., via [NixOS](https://nixos.org/) `security.wrappers` with setuid) for the `bpf()` and `perf_event_open()` syscalls.

---

## Performance Timeline

| Stage | Measured | Source | Approach |
|-------|----------|--------|----------|
| Bash + coreutils | ~2s | Benched (excl. 1s sleep) | Subprocesses for every metric, no state between runs |
| Rust + /proc | ~700ms | Dev measurement | Direct /proc parsing, kept file handles, `powerprofilesctl` subprocess (~810ms) |
| Sysfs + optimised /proc | ~15ms | Dev measurement | Sysfs replaces D-Bus, reusable buffers, byte-level parsing, skip kthreads |
| eBPF (no /proc walks) | sub-1ms | Commit `7601d77` | BPF probe reads task_struct directly, sysinfo() for system metrics |
| Zero-alloc optimised | min 0.78ms | Benched (500 samples) | Batch map reads, sorted vec, pread, hand-written JSON |

Development measurements were taken under heavier load conditions (HyprPanel running, more processes). Current-system benchmarks show lower figures for the /proc stages due to lighter load and fewer PIDs.

The final binary has two runtime dependencies (`libc`, `goblin` for ELF parsing at init), zero allocations in the hot path, and produces a complete system health JSON blob (CPU%, memory, load, temperature, frequency, GPU utilisation, power profile, throttle status, top-5 CPU/memory/IO processes with per-process breakdowns) in under a millisecond on a quiet desktop.

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

The first improvement, bash to Rust, captured more than 95% of the practical benefit. Going from 2 seconds to 15 milliseconds was a 130× improvement just by eliminating subprocesses and holding file descriptors open. For a tool that samples every 2 seconds, 15ms is already negligible. Nobody would notice the difference between 15ms and sub-1ms.

The subsequent journey from 15ms to sub-millisecond was intellectually rewarding. It taught me how /proc works under the hood, how BPF program loading actually happens at the syscall level, how the scheduler accounts CPU time on tickless kernels, and why `percpu_counter` values are approximate. I would do it again. But it was not practically necessary.

This is the shape of most performance work: the first 10% of effort captures 90% of the improvement. The remaining 90% of effort is for the remaining 10% of improvement. Knowing which side you're on matters.

There is a growing contingent of engineers who care about this distinction -- who insist that software should be fast because the hardware is fast, and that slowness is a choice made by layers of abstraction rather than an inevitability. [Casey Muratori](https://caseymuratori.com/)'s [Handmade Hero](https://handmadehero.org/) and [Computer Enhance](https://www.computerenhance.com/) have been catalysts for this shift, making the case that understanding the machine from the instruction set up changes what you consider acceptable.

We don't need everyone writing eBPF probes. We need people to stop embedding JavaScript runtimes in desktop utilities. The gap between "shell script that forks 15 processes" and "compiled binary that holds file descriptors open" is where almost all the real-world wins live. Everything beyond that is craft.

The lesson, if there is one: the cost is almost never in the computation. It is in the mechanism. The processes spawned, the files opened and closed, the text serialised and deserialised, the memory allocated and freed, the syscalls made. Eliminate the mechanism and the computation takes care of itself.

Meanwhile, Claude Code (a React SPA running on Node.js to print characters to a terminal) sits at 100% CPU with zram thrashing. Four `libuv-worker` processes, each consuming 700MB. The status bar daemon samples the carnage in under a millisecond.

Sometimes the message writes itself.
