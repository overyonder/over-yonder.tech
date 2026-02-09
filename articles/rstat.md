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

This is not an indictment of the people who built HyprPanel -- it's genuinely useful software. It is an indictment of the architectural norms that led us here. Somewhere along the way, "desktop widget" became synonymous with "embedded web browser." We treat the desktop like it's a deployment target for web applications, and then wonder why a laptop battery lasts four hours.

A status bar reads a few integers from the kernel and renders them into a strip of pixels. It should behave like a real-time system: bounded memory, bounded latency, no garbage collection pauses, no interpreter overhead. So I switched to Waybar, which is written in C++ and renders with GTK. And then I needed a system monitor module that actually took its job seriously.

This is the story of `rstat`: a system health monitor that started as a bash script running every 3 seconds and ended as a sub-millisecond eBPF-instrumented Rust daemon with zero heap allocations in steady state. Each stage of optimisation was motivated by the same question: where is the time actually going, and can we eliminate the mechanism entirely rather than just making it faster?

---

## Stage 1: The Baseline -- Bash + Coreutils (~3-5 seconds)

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

The 3-second polling interval was chosen not because the data changed that slowly, but to hide how slow the collection was. Even so, the script occasionally lagged Waybar's rendering, causing the status bar to display stale data or briefly blank.

This was the motivation for a rewrite: not performance for its own sake, but the observation that a status bar module should not be a measurable load on the system it monitors.

---

## Stage 2: Rust + /proc Parsing (~12ms)

The first rewrite eliminated every subprocess. A single Rust binary ran as a long-lived daemon, writing JSON lines to stdout. Waybar read these lines as they appeared -- no polling interval on Waybar's side, no repeated process spawning.

The key changes:

**Direct /proc parsing.** Instead of `cat /proc/stat | awk`, the daemon opened `/proc/stat` once, kept the file descriptor, and on each tick called `lseek(fd, 0, SEEK_SET)` followed by `read()`. The kernel regenerates the virtual file contents on each read from offset 0, but the open/close overhead is eliminated. Same pattern for `/proc/meminfo`, `/proc/loadavg`.

**In-memory delta computation.** CPU usage is computed from the difference in jiffies between two samples. The daemon kept the previous sample in memory and computed deltas on each tick. No need for an external tool, no need for two reads with a sleep in between.

**Per-PID metrics via /proc/[pid]/.** For the top-process breakdown (which processes are using the most CPU, memory, IO), the daemon walked `/proc/` with `readdir()`, filtered for numeric directory names, then for each PID opened and parsed:
- `/proc/[pid]/stat` -- CPU time (utime, stime fields)
- `/proc/[pid]/statm` -- RSS in pages
- `/proc/[pid]/io` -- read_bytes, write_bytes

**serde_json for output.** The daemon serialised a struct to JSON using serde. Convenient, correct, and -- as would later become relevant -- not free.

The result was approximately 12ms per sample. A 250x improvement over the bash script. The daemon consumed negligible CPU, and Waybar always had fresh data.

But 12ms is still a long time. A CPU running at 5 GHz executes 60 million cycles in 12ms. Reading a few dozen integers from the kernel should not require 60 million cycles. The bottleneck was obvious: the `/proc/[pid]/*` walk.

---

## Stage 3: Eliminating /proc Walks for Process Metrics (~3.3ms)

### The /proc problem

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

**Result: ~3.3ms.** The /proc walk for CPU was eliminated entirely. IO and memory still required per-PID /proc reads, but the most expensive part -- the directory walk and stat file parsing -- was gone.

---

## Stage 4: Pure BPF -- No /proc, No /sys/net (~1.34ms avg, 0.98ms p50)

The 3.3ms result from Stage 3 was dominated by the remaining `/proc/[pid]/io` and `/proc/[pid]/statm` reads. Each PID still required opening, reading, parsing, and closing two files. The solution was to collect RSS and IO directly from kernel data structures within the `sched_switch` BPF probe.

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

**Result: 1.34ms average, 0.98ms p50.** The median was sub-millisecond. The tail was dominated by occasional kernel scheduling latency and sysfs read variability.

---

## Stage 5: Zero-Allocation Steady State (~0.97ms avg, 0.74ms min)

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

| Stage | Avg | P50 | Min | Approach |
|-------|-----|-----|-----|----------|
| Bash + coreutils | ~3-5s | -- | -- | Subprocesses for every metric, no state between runs |
| Rust + /proc | 12.4ms | -- | -- | Direct /proc parsing, kept file handles, in-memory deltas |
| Rust + eBPF (hybrid) | 3.28ms | -- | -- | BPF for CPU via sched_switch, /proc for IO and memory |
| Pure BPF (no /proc) | 1.34ms | 0.98ms | -- | RSS and IO read in-kernel, sysinfo() for system metrics |
| Zero-alloc optimised | 0.97ms | 0.97ms | 0.74ms | Batch map reads, sorted vec, pread, hand-written JSON |

Each stage represents roughly a 3-4x improvement. The total improvement from bash to final is approximately 4000x. The final binary has two runtime dependencies (`libc`, `goblin` for ELF parsing at init), zero allocations in the hot path, and produces a complete system health JSON blob -- CPU%, memory, load, temperature, frequency, GPU utilisation, power profile, throttle status, top-5 CPU/memory/IO processes with per-process breakdowns -- in under a millisecond.

The lesson, if there is one: the cost is almost never in the computation. It is in the mechanism -- the processes spawned, the files opened and closed, the text serialised and deserialised, the memory allocated and freed, the syscalls made. Eliminate the mechanism and the computation takes care of itself.
