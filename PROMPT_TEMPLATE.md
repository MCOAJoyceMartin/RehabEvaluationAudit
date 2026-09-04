# Prompt template — clinical documentation audit tool

This is a reconstruction of the prompt that produced the Rehab Evaluation
Audit app, written as a reusable template. The level of detail here is
the point: a vague version of this request ("build me an app that scores
therapy notes") would have forced me to guess at clinical logic, invent
scoring rules, or quietly hallucinate what "good documentation" means.
Every section below removed one category of guess I would otherwise have
had to make.

Reuse this structure for a future module (Progress Notes, Daily
Treatment Notes, Recertification, Discharge) by swapping the specifics —
keep the shape.

---

## 1. Frame what it is and isn't

> Build me a [domain] documentation audit tool. This is NOT a
> [generic/naive version of the tool] — it needs to [do the actual
> specialized thing: extract evidence, apply a rubric, distinguish real
> failure from missing access], and it must never fabricate, assume, or
> infer [the specific kind of content that must never be invented].

Naming the wrong version of the tool up front (here: "not a PDF
summarizer") is doing real work — it rules out the lazy implementation
before I can drift toward it.

## 2. Name your reference materials and their authority, explicitly ranked

> I'm providing [N] reference files: [file A] is the official
> [rubric/rules/source of truth]. [file B] is a [human-scored
> example/sample output] — use it to validate your logic, but never treat
> its specific [scores/values/decisions] as the rule itself. [file C] is
> the actual [record/document] to process.
>
> Source hierarchy, never reversed: [A] > [B] > [C].

Without an explicit hierarchy, I can't tell "the human happened to score
this 3/3" apart from "3/3 is the rule" — and I will eventually blend
them without telling you.

## 3. Scope the first version, and say why

> V1 scope: only handle [the specific subset]. Do not attempt
> [adjacent subsets] yet — but architect it so those become additive
> modules later, not a rebuild.

This is what makes "add a Progress Notes module" later a data change
instead of a rewrite — see `README.md`'s "Adding future audit modules."

## 4. Require a pre-build report, and invite pushback

> Before writing code, tell me: (A) what you extracted from [the source]
> as the actual rule set, (B) how you mapped [the validation example] to
> those rules, (C) [any structural boundary you need me to identify,
> e.g. which pages/sections are in scope], (D) any ambiguity or conflict
> you found — **including between the source of truth and my own
> instructions below**, if any exist. Don't silently pick one.

That last clause is the one that matters most. It's an explicit
invitation to disagree with you, which is what actually surfaces
mistakes before they're built into 2,000 lines of code. In this
project it's also what produced the two real design decisions (see §6).

## 5. Spell out the scoring/decision logic in clinical (or domain) terms, not code terms

Don't describe data structures — describe the actual judgment calls a
human expert makes, including the ones that are easy to get subtly
wrong:

> For [criterion], the logic is: [the actual multi-step reasoning a
> human auditor does] — e.g. diagnosis → impairment → functional
> limitation → skilled need → risk without treatment. A score here
> should reflect that whole chain being present, not boilerplate
> language that merely mentions the diagnosis.

The more of this you write in clinical prose, the less of it I invent.

## 6. Name the distinctions that are easy to collapse into each other

This project's single most important sentence was the one that kept two
different failure modes from being treated as the same thing:

> If [X] cannot be confirmed from the uploaded record, that is
> **UNABLE TO VALIDATE**, not a failure. Never treat lack of access to
> [external system/data] as a clinical failure. Never treat [adjacent
> but distinct evidence, e.g. a physician's general certification] as
> proof that [the specific narrower thing, e.g. a matching order] exists
> unless [the source of truth] explicitly says so.

Also worth naming explicitly, if true for your domain: the difference
between "documentation is missing" and "documentation exists but this
tool can't validate it" — these should never be scored the same way or
displayed the same way.

## 7. Give the calculation rule in exact arithmetic terms

> [Metric] = [numerator] ÷ [denominator] × 100. [Excluded category] is
> excluded from the denominator entirely. [Another excluded category] is
> tracked as a **separate** number, never blended into the main score, so
> that [the reason it must stay separate — e.g. an incomplete upload
> isn't misread as a failed audit].

## 8. Ask for a validation report with an explicit non-goal

> Compare your output against [the human-scored example], criterion by
> criterion. If your score differs from the human's, **do not
> automatically change your logic to force a match** — categorize why
> they differ ([list the real categories: bad extraction, wrong rule
> interpretation, missing source documentation, ambiguous human
   judgment, evidence unavailable to you, legitimate interpretation
   difference]) and report it. The goal is not to agree with one human's
   session — it's to correctly apply the methodology.

This is the sentence that turned a disagreement (PCC scoring) into a
documented, defensible design decision instead of either a silent bug or
a forced 11/11 that would have been fake.

## 9. Require the rule set to live as data, not code

> [The rubric/rule set] must be centralized in its own data file(s), not
> hardcoded inside UI or pipeline logic, so that adding [a future
> variant] is a data change, not a rebuild.

## 10. State the non-negotiables plainly, in one place each

- **No fabrication**: "Never fabricate, assume, or infer [category] —
  show 'Not Found' instead."
- **Evidence traceability**: "Every finding must cite its exact source
  location (page/section) and the original text — never a paraphrase
  presented as a quote."
- **Privacy/security constraints**: name the actual constraint (e.g. "no
  PHI in logs/analytics/URLs," "no permanent storage unless explicitly
  configured," "process client-side").
- **Human-in-the-loop**: "A human reviewer must be able to override a
  score/finding, but the original AI output must never be overwritten —
  keep both."

## 11. Ask for the deliverables as a list, including the boring ones

Working code is not the whole deliverable. Ask explicitly for: the
pre-build report itself, a validation report (not just a passing test),
setup/run instructions a non-developer can follow, and instructions for
extending the system later. These are the things that get silently
dropped if you only ask for "the app."

---

### Why this worked better than a shorter prompt would have

Every ambiguous sentence in a prompt like this becomes a coin flip I
make silently on your behalf, once, and then build on top of. A vague
version of this request wouldn't have failed loudly — it would have
produced something that *looked* finished (a working app, plausible
scores, a UI that renders) while quietly getting the PCC question, the
partial-credit question, and the missing-vs-unvalidatable distinction
wrong in ways that wouldn't surface until an audit actually got acted
on. The length of the original prompt is exactly proportional to the
number of judgment calls it took off my plate.
