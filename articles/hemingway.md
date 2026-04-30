---
title: "The answer is not caveman; it is Hemingway."
date: 2026-04-29
author: Kieran Hannigan
tags: [ai, writing, skills, readability]
---

# The answer is not caveman; it is Hemingway.

<div class="author-badge">
  <img src="https://github.com/KaiStarkk.png?size=64" alt="Kieran Hannigan" />
  <a href="https://github.com/KaiStarkk">Kieran Hannigan</a>
</div>

AI agents talk too much, and much of that talk is padding dressed as warmth: a
useful answer arrives wrapped in apology, preface, process notes, and soft
phrases that do no work.

[Caveman](https://github.com/JuliusBrussee/caveman) takes one path: drop
articles, break grammar, keep nouns and verbs. It is funny, memorable, and good
at saving tokens, but for readable work it gives the reader too little.

Removing articles does not make writing easier to read. Readability comes from
movement, structure, and concrete language: brevity helps when the sentence still
moves like thought, structure helps when it carries the reader forward, and
concrete language helps because the reader can see what the sentence means. A
sentence with articles can be short, clean, and fast; a sentence stripped of
articles can still be ugly, vague, and hard to parse. Hemingway gives us a
better test.

English uses articles because they carry meaning. "A fix" and "the fix" are
different, as are "open file" and "open the file"; in technical work, those
differences matter.

When articles vanish, the reader has to infer relationships the sentence could
have stated directly. That may save a token, but it may also spend attention.
Good compression removes work for both writer and reader, and what remains should
feel more human.

Caveman compression often makes prose shorter by damaging the sentence;
Hemingway compression makes prose shorter by improving it.

## The useful part

The useful part is a discipline: write short answers that remain human, in plain
English, with concrete nouns, active verbs, little throat-clearing, no corporate
fog, and articles wherever English needs them. It asks the agent to write clearly
enough that the reader can relax.

The difference is small but material:

> Default AI training priors: "I found the issue in the authentication
> middleware. The token expiry comparison was using `<` instead of `<=`, which
> meant tokens at the boundary were handled incorrectly. I updated the
> comparison, verified the fix, and touched `auth/middleware.ts`. Let me know if
> you want me to add broader regression coverage."

> Caveman: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix."

> Hemingway: "The bug is in the auth middleware. The expiry check uses `<`; it
> should use `<=`."

The default version is tidy but padded, while the Hemingway version is almost as
short as Caveman and easier to read because the small words do work.

## Hemingway Was Brief, Not Broken

Ernest Hemingway's style is often reduced to "short sentences," but that misses
the point. His best prose is direct, physical, and plain; the words are common,
the sentences move, and the surface can look brisk without becoming brusque. The
reader is drawn in because the prose does not get between the reader and the
thing being seen.

Orwell made the same point another way in [_Why I
Write_](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/Why%20i%20write/):
"Good prose is like a windowpane." The prose has personality because the reader
can see through it, and sincerity and warmth come from that transparency. The
writer is present through honest work, rather than through sentences that point
back at the writer.

In _The Old Man and the Sea_, Santiago's world is made from ordinary words: a
skiff, a line, a fish, a hand, the sea. Hemingway lets concrete things carry the
weight. There is a passage that will stay with me forever:

> He could feel the steady hard pull of the line and his left hand was cramped.
> It drew up tight on the heavy cord and he looked at it in disgust.
>
> "What kind of a hand is that," he said. "Cramp then if you want. Make yourself
> into a claw. It will do you no good."
>
> Come on, he thought and looked down into the dark water at the slant of the
> line. Eat it now and it will strengthen the hand. It is not the hand's fault
> and you have been many hours with the fish. But you can stay with him forever.
> Eat the bonito now.
>
> [...]
>
> "How do you feel, hand?" he asked the cramped hand that was almost as stiff as
> rigor mortis. "I'll eat some more for you."
>
> He ate the other part of the piece that he had cut in two. He chewed it
> carefully and then spat out the skin.
>
> "How does it go, hand? Or is it too early to know?"
>
> He took another full piece and chewed it.
>
> [...]
>
> "God help me to have the cramp go," he said. "Because I do not know what the
> fish is going to do."
>
> [...]
>
> He rubbed the cramped hand against his trousers and tried to gentle the
> fingers. But it would not open. Maybe it will open with the sun, he thought.
> Maybe it will open when the strong raw tuna is digested. If I have to have it,
> I will open it, cost whatever it costs. But I do not want to open it now by
> force. Let it open by itself and come back of its own accord. After all I
> abused it much in the night when it was necessary to free and unite the
> various lines.
>
> [...]
>
> His left hand was still cramped, but he was unknotting it slowly.
>
> I hate a cramp, he thought. It is a treachery of one's own body. [...] If the
> boy were here he could rub it for me and loosen it down from the forearm, he
> thought. But it will loosen up.
>
> [...]
>
> Then, with his right hand he felt the difference in the pull of the line
> before he saw the slant change in the water. Then, as he leaned against the
> line and slapped his left hand hard and fast against his thigh he saw the line
> slanting slowly upward.
>
> "He's coming up," he said. "Come on hand. Please come on."

The passage stays clear of fake profundity by keeping feeling inside the action:
the hand cramps, the old man talks to it, and he eats because the body needs
strength. The sentences stay with the body, the fish, the line, and the work,
which is why the passage is warm. It lets an old sailor speak to his failing
hands, and the reader feels age, courage, and bodily betrayal without being told
to feel them.

Even one short line shows the method: "He was an old man..." The sentence begins
with the simplest possible claim and gives the reader an open door. That is the
lesson for an AI agent: say the thing with the right nouns and verbs, while
remembering that bluntness and truth are different things. The work is done when
the reader sees clearly.

## The old [Hemingway Editor](https://hemingwayapp.com/) had the right instinct

Before AI writing tools became rewrite engines, the old [Hemingway
Editor](https://hemingwayapp.com/) was useful because it was modest: it
highlighted hard-to-read sentences, adverbs, passive voice, and dense phrasing,
using yellow and red to show where the reader might stumble while leaving the
writer in charge.

The lesson was to revise for the reader. Passive voice is sometimes correct, an
adverb can be the right word, and a long sentence can carry a thought a short
sentence cannot carry alone. That is the work here too: remove friction and make
the agent easier to understand.

## Patterns worth knowing

Bad AI prose is a vocabulary problem, a rhythm problem, and a sincerity problem:
the same shapes repeat until the reader distrusts them.

Most readers know simile, metaphor, alliteration, assonance, and consonance. The
more useful patterns here are the ones that shape the sentence itself. A writer
who knows grammar and rhetoric uses those shapes on purpose.

Yes, the title uses antithesis: not this, but that. The old form still works
when the contrast is real. It fails when it pretends to find depth where there is
only symmetry.

**Antithesis** sets one idea against another. "Not caveman; Hemingway" is
antithesis. It works when the contrast is the argument. It fails when the
contrast is fake depth.

**Isocolon** balances phrases of similar length and structure. "Brief, but
grammatical; plain and adult; direct and civil." It can make prose feel ordered,
though too much of it starts to sound engineered.

**Chiasmus** reverses structure across two clauses. "Ask not what your country
can do for you..." is the famous example. It can make a sentence memorable, and
it can just as easily become a machine for fake depth.

**Polysyndeton** repeats conjunctions: "the code and the tests and the docs and
the release." It can create weight, rhythm, accumulation, or exhaustion. Used by
accident, it sounds breathless. Thankfully, training priors already avoid this.

**Asyndeton** removes conjunctions: "the code, the tests, the docs, the
release." It is faster and harder, which can feel clean or clipped depending on
the sentence.

**Syndetic listing** uses normal conjunctions: "the code, the tests, the docs,
and the release." The Oxford comma helps here because it matches how people
pause when speaking, and most technical prose should live in this default rhythm.

**Anaphora** repeats the opening of clauses or sentences. "It should be brief.
It should be clear. It should be true." This can build force, though AI often
overuses it to simulate conviction.

**Epistrophe** repeats the ending of clauses or sentences. "Readable for the
writer, readable for the agent, readable for the reader." It can close a rhythm
tightly, but used by accident it sounds like a slogan.

**Parataxis** places clauses side by side without much subordination. "The test
failed. The fixture was wrong. The parser never saw an id." It is direct and
close to Hemingway, but too much of it becomes a drumbeat.

**Hypotaxis** nests one thought inside another. "The test failed because the
fixture, which was copied from the old parser, omitted the id that the new
parser requires." It handles real dependency, but too much of it makes the
reader hold a tree in memory.

> **Humans should learn this too.** This author has a branching mind and is wont
> to diverge into recursive and branching parenthetical hypotaxis:
>
> The dog, he realised, was not a mutt (like the one he'd had when he was
> younger), but was instead a thoroughbred, one of those pampered things that
> men of means kept and -- he hoped -- the kind of dog that he would find
> himself the owner of someday in the (not too distant, mind you) future.
>
> That is a natural expression for a thinker who does not serialize thoughts,
> but it is usually bad writing because the reader should not have to run a call
> stack to finish a sentence.

There are shibboleths too, and they change: "delve" was a tell for a while until
later tuning brushed it out; newer ones include "name," "naming," and the habit
of turning every thought into an act of naming; older ones persist, such as em
dashes everywhere, semicolons used correctly but too often, and labeled bullet
lists where the first phrase is bold and the rest of the sentence explains it.
Another current tell is the phrase "earns its keep," along with its cousin
"earns its place." The labeled-list form is useful, but it is also overused by
machines, which annoys people who have written that way for twenty years and
have the email archive to prove it.

Line feeds can become a shibboleth too. Agents often put a conclusion in its own
paragraph so it looks important, and humans do the same thing when they want a
sentence to land. A strong point can earn that silence, but a weak point standing
alone under a spotlight only looks weaker, so keep it in the paragraph until it
has earned the space around it.

Brevity is not staccato: brevity carries meaning in fewer words, while staccato
chops cadence into fragments. Short sentences can be clear, but a page full of
them starts to sound like a person tapping the table to prove they mean it, so
use the pattern when you mean it and let clarity invite the reader in.

## The test

An answer shaped this way should be:

- brief, but grammatical
- plain and adult
- direct and civil
- complete and lean
- technical, but readable

It should preserve code, commands, filenames, errors, and exact terms. It should
cut ceremony and keep meaning. It should be brief enough to respect the reader
and warm enough to remember that there is one.

The answer is not caveman; it is Hemingway. Keep the articles. Cut the wasted
words.

A note on the man: this argument uses Hemingway's prose as a model, not
Hemingway himself. *The Old Man and the Sea* is a great book; *Across the River
and into the Trees* is not. That late novel gives us the worse Hemingway: the
aging colonel, the teenage Renata, and the fantasy of male importance returned
through a young woman's devotion. His chauvinism and insecurity were ugly parts
of his character, and they shaped parts of his life and work. Learn from the
sentences without excusing the man.
