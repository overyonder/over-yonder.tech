---
title: "Professional documents from plain text"
date: 2026-02-13
author: Kieran Hannigan
tags: [markdown, pandoc, writing, productivity]
---

# Professional documents from plain text

<div class="author-badge">
  <img src="https://github.com/KaiStarkk.png?size=64" alt="Kieran Hannigan" />
  <a href="https://github.com/KaiStarkk">Kieran Hannigan</a>
</div>

Most professional documents -- executive memos, financial reports, case studies -- are drafted in Google Docs or Microsoft Word. These are applications that need a full browser engine or a multi-gigabyte desktop installation to let you type paragraphs of text, and they'll happily drain your laptop battery in the process. The formatting you carefully arranged will shift when someone opens the file on a different machine, and the version history is a list of timestamps with no indication of what actually changed.

<div class="emphasis-block">
This article is a Markdown file -- plain text, editable in Notepad, readable on any device. The same source produces this webpage and can generate a typeset PDF with a single command.
</div>

Markdown is plain text with a handful of formatting hints. You can write it in any editor on any device -- desktop, phone, browser, anything with a keyboard. A `.md` file opens instantly because there's nothing to load: no XML to unpack, no rendering engine to boot, no application to initialise. Google Docs needs a Chromium tab running just to let you *edit text*, and your battery pays for that privilege. Markdown could run on a toaster.

What's changed since Markdown's creation in 2004 isn't the format itself -- it's the tooling around it. [Pandoc](https://pandoc.org/) can now produce PDFs with LaTeX-quality typesetting. [KaTeX](https://katex.org/) renders publication-grade mathematics in the browser. [Git](https://git-scm.com/) gives you line-by-line version control that no word processor can match. The same format that powers GitHub READMEs, Jupyter notebooks, and most technical documentation can produce boardroom-ready output with minimal ceremony.

---

## Getting Started

Here's the entire workflow:

1. Write a `.md` file in any text editor
2. Run `pandoc` to convert it to PDF or HTML

That's it. Everything below expands on these two steps.

---

## Step 1: Write

Open any text editor. Notepad will do, VS Code is fine, [Markor](https://github.com/gsantner/markor) works on your phone. The examples in this article come from [Neovim](https://neovim.io/), but it doesn't matter where you type -- it's just text.

Markdown's formatting conventions are designed to be obvious even in their raw form. A `#` before a line makes it a heading. Pipes (`|`) define table columns. Dollar signs (`$`) wrap formulas. Here's how each of those looks in practice, using an executive memo as the running example.

### Headings

```markdown
# Quarterly Review: Widget Division

## Executive Summary (BLUF)

Revenue exceeded forecast by 8%.

---

## 1) Revenue Analysis

### a) Domestic markets

Domestic revenue grew to $15.8M in Q2.

### b) International markets

International revenue declined 3%.
```

Each `#` level maps to a heading in the output -- `##` is a subheading, `###` is a sub-subheading. The `---` produces a horizontal rule between major sections. Bold uses `**double asterisks**`, italics use `*single*`.

### Numbered lists

```markdown
Key findings:

1. Revenue exceeded forecast by 8%
2. Customer acquisition cost decreased 12%
3. Net promoter score improved from 42 to 57
```

Numbered lists start with `1.`, `2.`, and so on. Bullets use `-` or `*`. Indent to nest them.

### Tables

```markdown
| Quarter | Revenue ($M) | Growth |
|---------|-------------|--------|
| Q1 2025 | 14.2        | 3.1%   |
| Q2 2025 | 15.8        | 11.3%  |
| Q3 2025 | 16.1        | 1.9%   |
```

Pipes define columns, and the dashed row separates the header from the data. The alignment doesn't need to be precise -- pandoc handles the layout.

### Formulas

```markdown
The effective tax rate:

$$\text{ETR} = \frac{\text{Tax Expense}}{\text{Pre-tax Income}}
             = \frac{11{,}122}{41{,}332} = 26.9\%$$
```

The `$$` delimiters mark a display-mode equation (centred, on its own line). Inline math uses single `$` -- so `$x^2 + y^2 = r^2$` renders the formula right there in the paragraph. The syntax between the delimiters is standard LaTeX math notation, the same system used for mathematical typesetting in journals and textbooks. When pandoc converts this, you get a properly typeset fraction -- identical to what you'd see in a published paper.

<div class="info">
<details>
<summary>What is Markdown?</summary>

Markdown is a lightweight markup language created by John Gruber and Aaron Swartz in 2004. It uses plain text formatting conventions -- `#` for headings, `**` for bold, `-` for lists -- that are readable in source form and convertible to structured formats like HTML and PDF.

The `.md` file extension is standard. [CommonMark](https://commonmark.org/) (2014) and [GitHub Flavoured Markdown](https://github.github.com/gfm/) formalised the specification, resolving ambiguities in Gruber's original description. Most code hosting platforms, documentation tools, and note-taking applications use Markdown as their default format.

</details>
</div>

<div class="info">
<details>
<summary>What is KaTeX?</summary>

[KaTeX](https://katex.org/) is a math typesetting library created by [Khan Academy](https://www.khanacademy.org/). It renders LaTeX math notation directly in the browser, producing publication-quality formulas without server-side processing. It's significantly faster than the older [MathJax](https://www.mathjax.org/) library because it parses and renders in a single pass rather than doing multiple layout passes.

Pandoc's `--katex` flag embeds the KaTeX library in HTML output, so math expressions like `$\frac{a}{b}$` render as properly typeset fractions in any modern browser.

</details>
</div>

---

## Step 2: Convert

Once the document's written, conversion is a single command.

**To PDF** (typeset with LaTeX):

```bash
pandoc memo.md -o memo.pdf --pdf-engine=pdflatex -V geometry:margin=1in
```

**To HTML** (with rendered math):

```bash
pandoc memo.md -o memo.html --katex --standalone
```

`--pdf-engine=pdflatex` tells pandoc to typeset the PDF using LaTeX's engine -- the same system behind academic journals and textbooks. `--katex` renders math in the browser using [KaTeX](https://katex.org/). `--standalone` produces a complete HTML file with proper `<head>` and `<body>` tags rather than just a fragment.

For finer control over the PDF's appearance:

```bash
pandoc memo.md -o memo.pdf \
  --pdf-engine=pdflatex \
  -V geometry:margin=1in \
  -V fontsize=11pt \
  -V mainfont="Palatino" \
  --highlight-style=tango
```

These are variables passed to the underlying LaTeX template. Pandoc exposes a lot of knobs -- the full list is in the [pandoc manual](https://pandoc.org/MANUAL.html).

<div class="info">
<details>
<summary>What is Pandoc?</summary>

[Pandoc](https://pandoc.org/) is a universal document converter written by John MacFarlane, a philosophy professor at UC Berkeley. It converts between dozens of formats: Markdown, LaTeX, HTML, DOCX, EPUB, PDF, reStructuredText, and more.

For PDF output, pandoc generates intermediate LaTeX and typesets it with an engine like `pdflatex`, `xelatex`, or `lualatex`. Pandoc's Markdown dialect extends CommonMark with tables, footnotes, citations, maths, and YAML metadata -- features that bring it close to LaTeX's capabilities while retaining Markdown's readability.

Install: [pandoc.org/installing](https://pandoc.org/installing.html). Most Linux distributions include it in their package manager. On macOS: `brew install pandoc`. On Windows: the MSI installer or `choco install pandoc`.

</details>
</div>

---

## Beyond Formatting

### Readable anywhere, no software required

A `.md` file is plain text. It opens instantly in any editor on any operating system -- a 1990s terminal, a modern IDE, your phone's built-in text editor, anything. There's no proprietary format to decode, no rendering engine required. Anyone can read the raw source regardless of what tools they have installed.

The rendered output is just as portable. A pandoc-generated HTML page is static text and basic CSS -- it loads in milliseconds and works offline. The same content served through Google Docs requires downloading and bootstrapping an entire JavaScript application before the first sentence becomes visible. On a laptop, the difference shows up in your battery meter.

### Line-by-line version control

Word processors store documents as opaque binary blobs (`.doc`) or zipped XML archives (`.docx`, `.odt`). Version control systems like Git can tell you *that* the file changed, but not *what* changed -- diff tools produce unintelligible output because the format was designed for the application, not for human eyes.

Because Markdown is line-oriented text, every change produces a clean, readable diff. This unlocks capabilities that are simply impossible with traditional document formats:

- **Meaningful diffs** -- see exactly which sentence was reworded, which figure was updated, which section was added
- **Attribution** -- `git blame` shows who wrote each line and when it was last modified
- **Branching** -- draft two alternative versions in parallel and merge the preferred one
- **Complete history** -- every edit, by every author, preserved with timestamps and commit messages

For teams producing reports, proposals, or policy documents, this is the end of emailing `memo_v3_final_FINAL_jm-edits.docx`.

<div class="detour">
<details>
<summary>Advanced: collaborative editing with Git</summary>

When a Markdown document lives in a Git repository, the full power of version control applies to prose the same way it applies to code.

**Commit history** shows who changed what and why:

```
$ git log --oneline memo.md
a3f7c21 Update Q2 revenue figures    (Sarah Chen)
e8b2d15 Draft executive summary      (James Miller)
```

**Diffs** reveal exactly what changed between versions:

```diff
 | Quarter | Revenue ($M) | Growth |
 |---------|-------------|--------|
 | Q1 2025 | 14.2        | 3.1%   |
-| Q2 2025 | 15.1        | 6.3%   |
+| Q2 2025 | 15.8        | 11.3%  |
 | Q3 2025 | 16.1        | 1.9%   |
```

Sarah corrected Q2's revenue from $15.1M to $15.8M and the growth rate from 6.3% to 11.3%. The diff shows exactly what changed, in context. Try getting that out of a `.docx`.

**Blame** traces every line to its author:

```
$ git blame memo.md

e8b2d15 (James Miller  2025-03-01) # Quarterly Review: Widget Division
e8b2d15 (James Miller  2025-03-01)
e8b2d15 (James Miller  2025-03-01) ## Executive Summary (BLUF)
a3f7c21 (Sarah Chen    2025-03-03) Revenue exceeded forecast by 8%.
e8b2d15 (James Miller  2025-03-01)
a3f7c21 (Sarah Chen    2025-03-03) | Quarter | Revenue ($M) | Growth |
a3f7c21 (Sarah Chen    2025-03-03) |---------|-------------|--------|
e8b2d15 (James Miller  2025-03-01) | Q1 2025 | 14.2        | 3.1%   |
a3f7c21 (Sarah Chen    2025-03-03) | Q2 2025 | 15.8        | 11.3%  |
e8b2d15 (James Miller  2025-03-01) | Q3 2025 | 16.1        | 1.9%   |
```

James wrote the original structure and data. Sarah updated the executive summary and corrected Q2. Every line is attributed, timestamped, and linked to a commit message explaining *why* the change was made.

This is standard workflow in software development, and it's increasingly showing up in document-heavy fields -- legal, finance, compliance -- where knowing who changed what and when isn't optional.

</details>
</div>

---

## Further Reading: LaTeX

Markdown borrows its math syntax from a tool worth knowing about: [LaTeX](https://www.latex-project.org/).

LaTeX has been the standard typesetting system in academia since the 1980s -- journals, theses, textbooks. It produces byte-identical output from the same source on any machine, which is one of the same benefits Markdown inherits through pandoc. But where Markdown opts for lightweight conventions, LaTeX is a full document programming language, and its syntax reflects that.

The same content in both formats:

**Markdown:**

```markdown
## Executive Summary

Revenue grew **12%** year-over-year. The effective tax rate:

$$\text{ETR} = \frac{11{,}122}{41{,}332} = 26.9\%$$
```

**LaTeX:**

```latex
\section{Executive Summary}

Revenue grew \textbf{12\%} year-over-year. The effective tax rate:

\begin{equation}
  \text{ETR} = \frac{11{,}122}{41{,}332} = 26.9\%
\end{equation}
```

Both produce identical typeset output. The Markdown is readable at a glance; the LaTeX requires knowing the command vocabulary. For a one-page memo, the difference in verbosity is minor. For a fifty-page document, it compounds.

LaTeX's advantages are real, especially at scale:

- **Automatic numbering** -- sections, figures, tables, and equations are numbered and cross-referenced automatically. Insert a new section and everything downstream renumbers itself.
- **Citation management** -- [BibTeX](http://www.bibtex.org/) integrates bibliography databases, formatting citations across dozens of journal styles automatically.
- **Collaborative editing** -- platforms like [Overleaf](https://www.overleaf.com/) provide real-time collaborative LaTeX editing with live preview, essentially Google Docs for LaTeX.
- **Precision layout control** -- every dimension of the output -- margins, headers, footnotes, column widths, float placement -- is programmable.

Markdown, through pandoc, is steadily picking up these capabilities with simpler syntax:

- `--citeproc` with a `.bib` file handles citations in common styles
- [`pandoc-crossref`](https://github.com/lierdakil/pandoc-crossref) adds numbered references to figures, tables, and equations
- YAML metadata in the document header controls layout, numbering, and styling
- Custom LaTeX templates give you full typographic control when the defaults aren't enough

For most professional documents -- memos, reports, proposals, briefs -- Markdown with pandoc does the job at a fraction of the syntactic overhead. For a 300-page thesis with hundreds of citations and complex cross-references, LaTeX is still the right tool. But the gap is closing.
