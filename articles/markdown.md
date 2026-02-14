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

Executive memos. Financial reports. Case studies. The documents that shape decisions in organisations are, almost universally, drafted in Google Docs or Microsoft Word -- tools that require a browser engine or a desktop application to edit a few paragraphs of text.

<div class="emphasis-block">
This article is a Markdown file. Plain text, editable in Notepad, readable on any device. The same source file produces the webpage you are reading now and can generate a typeset PDF with a single command.
</div>

Markdown is plain text with a handful of formatting conventions. It can be written in any editor on any device -- desktop, phone, or browser. A `.md` file opens instantly because there is nothing to load: no XML to parse, no rendering engine to initialise, no application to boot. Google Docs needs a Chromium browser tab to *edit text* and will drain your laptop battery doing it. A Markdown file runs on anything. It could run on a toaster.

What has changed since Markdown's creation in 2004 is the tooling around it. [Pandoc](https://pandoc.org/) can produce PDFs with LaTeX-quality typesetting. [KaTeX](https://katex.org/) renders publication-grade mathematics in the browser. [Git](https://git-scm.com/) provides line-by-line version control that no word processor can match. The format that powers GitHub READMEs, Jupyter notebooks, and most technical documentation can produce boardroom-ready output with minimal effort.

---

## Getting Started

The entire workflow:

1. Write a `.md` file in any text editor
2. Run `pandoc` to convert it to PDF or HTML

Everything below expands on these two steps.

---

## Step 1: Write

Open any text editor. Notepad works. VS Code works. [Markor](https://github.com/gsantner/markor) works on a phone. The examples here come from [Neovim](https://neovim.io/), but the content is the same regardless of where you type it -- it is just text.

Markdown's formatting conventions are designed to be obvious even in their raw form. A `#` is a heading. A `|` separates table columns. A `$` wraps a formula. Here is how each of those looks in practice, using an executive memo as the running example.

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

Each `#` level maps to a heading level in the output. `##` is a subheading, `###` is a sub-subheading. The `---` produces a horizontal rule between major sections. Bold text uses `**double asterisks**` and italics use `*single asterisks*`.

### Numbered lists

```markdown
Key findings:

1. Revenue exceeded forecast by 8%
2. Customer acquisition cost decreased 12%
3. Net promoter score improved from 42 to 57
```

Numbered lists start with `1.`, `2.`, etc. Bullet lists use `-` or `*`. Indenting creates nested lists.

### Tables

```markdown
| Quarter | Revenue ($M) | Growth |
|---------|-------------|--------|
| Q1 2025 | 14.2        | 3.1%   |
| Q2 2025 | 15.8        | 11.3%  |
| Q3 2025 | 16.1        | 1.9%   |
```

Pipes define columns. The dashed row separates the header from the data. Column alignment does not need to be precise -- the converter handles the layout.

### Formulas

```markdown
The effective tax rate:

$$\text{ETR} = \frac{\text{Tax Expense}}{\text{Pre-tax Income}}
             = \frac{11{,}122}{41{,}332} = 26.9\%$$
```

`$$` delimiters mark a display-mode equation. Inline math uses single `$` -- writing `$x^2 + y^2 = r^2$` renders the formula inline with the surrounding text. The syntax between the delimiters is LaTeX math notation, the standard for mathematical typesetting in academia and publishing. When converted with pandoc, this renders as a properly typeset fraction -- identical to what you would see in a journal paper or textbook.

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

[KaTeX](https://katex.org/) is a math typesetting library created by [Khan Academy](https://www.khanacademy.org/). It renders LaTeX math notation directly in the browser, producing publication-quality formulas without server-side processing. KaTeX is significantly faster than the older [MathJax](https://www.mathjax.org/) library because it parses and renders in a single pass.

Pandoc's `--katex` flag embeds the KaTeX library in HTML output, so math expressions like `$\frac{a}{b}$` render as properly typeset fractions in any modern browser.

</details>
</div>

---

## Step 2: Convert

With the document written, conversion is a single command.

**To PDF** (typeset with LaTeX):

```bash
pandoc memo.md -o memo.pdf --pdf-engine=pdflatex -V geometry:margin=1in
```

**To HTML** (with rendered math):

```bash
pandoc memo.md -o memo.html --katex --standalone
```

`--pdf-engine=pdflatex` tells pandoc to typeset the PDF using LaTeX's engine -- the same system used in academic journals and textbooks. `--katex` renders math notation in the browser. `--standalone` produces a complete HTML file rather than a fragment.

For finer control over PDF appearance:

```bash
pandoc memo.md -o memo.pdf \
  --pdf-engine=pdflatex \
  -V geometry:margin=1in \
  -V fontsize=11pt \
  -V mainfont="Palatino" \
  --highlight-style=tango
```

These are variables passed to the LaTeX template. The full list is in the [pandoc manual](https://pandoc.org/MANUAL.html).

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

A `.md` file is plain text. It opens instantly in any editor on any operating system -- a 1990s terminal, a modern IDE, a phone's built-in text editor. There is no proprietary format to decode, no rendering engine required. Anyone can read the source, regardless of what tools they have installed.

The rendered output is equally portable. A pandoc-generated HTML file is static text and basic CSS -- it loads in milliseconds and works offline. The same content in Google Docs requires downloading and bootstrapping a JavaScript application before the first sentence is visible. On a laptop, the difference is measured in battery life.

### Line-by-line version control

Word processors store documents as opaque binary blobs or zipped XML archives. Version control systems can tell you that the file changed, but not what changed in a meaningful way. Diff tools produce unintelligible output because the file format is designed for the application, not for human readers.

Markdown is line-oriented text. Every change is a clean, readable diff. This unlocks capabilities that are impossible with traditional document formats:

- **Meaningful diffs** -- see exactly which sentence was reworded, which figure was updated, which section was added
- **Attribution** -- `git blame` shows who wrote each line and when it was last modified
- **Branching** -- draft two alternative versions in parallel and merge the preferred one
- **Complete history** -- every edit, by every author, preserved with timestamps and commit messages

For teams producing reports, proposals, or policy documents, this replaces emailing `memo_v3_final_FINAL_jm-edits.docx`.

<div class="detour">
<details>
<summary>Advanced: collaborative editing with Git</summary>

When a Markdown document is stored in a Git repository, the full power of version control applies to prose the same way it applies to code.

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

Sarah corrected Q2's revenue from $15.1M to $15.8M and the growth rate from 6.3% to 11.3%. The diff shows the exact change, in context. Try getting that from a `.docx`.

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

James wrote the structure and initial data. Sarah updated the executive summary and corrected the Q2 figures. Every line is attributed, timestamped, and linked to a commit message explaining the change.

This workflow is standard in software development and increasingly adopted for document-heavy work in legal, finance, and compliance teams.

</details>
</div>

---

## Further Reading: LaTeX

Markdown borrows its math syntax from a tool worth knowing about: [LaTeX](https://www.latex-project.org/).

LaTeX has been the standard typesetting system in academia since the 1980s, used for journals, theses, and textbooks. It produces byte-identical output from the same source on any machine -- one of the same benefits Markdown inherits through pandoc. But where Markdown uses lightweight conventions, LaTeX is a full document programming language, and its syntax reflects that.

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

Both produce identical typeset output. Markdown is readable at a glance; LaTeX requires familiarity with its command vocabulary.

LaTeX's advantages are real, particularly at scale:

- **Automatic numbering** -- sections, figures, tables, and equations are numbered and cross-referenced automatically. Inserting a new section renumbers everything downstream.
- **Citation management** -- [BibTeX](http://www.bibtex.org/) integrates bibliography databases, formatting citations across dozens of journal styles automatically.
- **Collaborative editing** -- platforms like [Overleaf](https://www.overleaf.com/) provide real-time collaborative LaTeX editing with live preview, similar to Google Docs but for LaTeX documents.
- **Precision layout control** -- every dimension of the output -- margins, headers, footnotes, column widths, float placement -- is programmable.

Markdown, through pandoc, is steadily acquiring these capabilities with simpler syntax:

- `--citeproc` with a `.bib` file handles citations in common styles
- [`pandoc-crossref`](https://github.com/lierdakil/pandoc-crossref) adds numbered references to figures, tables, and equations
- YAML metadata in the document header controls layout, numbering, and styling
- Custom LaTeX templates provide full typographic control when the defaults are not sufficient

For most professional documents -- memos, reports, proposals, briefs -- Markdown with pandoc provides what is needed at a fraction of the syntactic cost. For a 300-page thesis with hundreds of citations and complex cross-references, LaTeX remains the more capable tool. The gap is narrowing.
