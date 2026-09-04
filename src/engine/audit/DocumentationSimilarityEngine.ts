import type { Discipline, DocumentationSimilarityFinding, NotFound, SimilarityClassification, SimilarityDimension } from "../../types/audit";

/**
 * DocumentationSimilarityEngine
 * ===============================
 * Compares daily-note text across the episode for four dimensions
 * (Response to Treatment, Treatment Narrative, Caregiver Education, Skilled
 * -Need Language) SEPARATELY per dimension — never merging them, since a
 * therapist can write patient-specific treatment narratives while still
 * reusing a stock response-to-treatment phrase, and collapsing the two
 * would hide that. Per spec: never call something "copy/paste" based
 * solely on shared therapy terminology — classification here requires the
 * normalized text to be identical or near-identical (Jaccard word-overlap
 * >= 0.85), not just clinically similar wording.
 */

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter((w) => w.length > 2));
  const setB = new Set(b.split(" ").filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersect = 0;
  for (const w of setA) if (setB.has(w)) intersect++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersect / union;
}

function classify(entries: { date: string | NotFound; text: string }[]): { classification: SimilarityClassification; note: string; sample: string } {
  const nonEmpty = entries.filter((e) => e.text.trim().length > 0);
  if (nonEmpty.length < 2) {
    return { classification: "Patient-specific", note: "Fewer than two documented instances to compare.", sample: nonEmpty[0]?.text ?? "" };
  }

  const normalized = nonEmpty.map((e) => ({ date: e.date, text: e.text, norm: normalize(e.text) }));
  const groups = new Map<string, typeof normalized>();
  for (const n of normalized) {
    if (!groups.has(n.norm)) groups.set(n.norm, []);
    groups.get(n.norm)!.push(n);
  }
  const exactGroup = [...groups.values()].find((g) => g.length >= 2);
  if (exactGroup) {
    return {
      classification: "Exact duplicate",
      note: `Identical text appears on ${exactGroup.length} of ${nonEmpty.length} documented dates (${exactGroup.map((g) => g.date).join(", ")}) — potential repetitive/template documentation, reviewer validation recommended.`,
      sample: exactGroup[0].text,
    };
  }

  let maxSim = 0;
  let simPair: [typeof normalized[number], typeof normalized[number]] | null = null;
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const sim = jaccard(normalized[i].norm, normalized[j].norm);
      if (sim > maxSim) {
        maxSim = sim;
        simPair = [normalized[i], normalized[j]];
      }
    }
  }
  if (maxSim >= 0.85 && simPair) {
    return {
      classification: "Near duplicate",
      note: `Near-identical text (${Math.round(maxSim * 100)}% word overlap) between ${simPair[0].date} and ${simPair[1].date} — potential repetitive/template documentation, reviewer validation recommended.`,
      sample: simPair[0].text,
    };
  }
  if (maxSim >= 0.6 && simPair) {
    return {
      classification: "Template-heavy",
      note: `Substantial shared phrasing (${Math.round(maxSim * 100)}% word overlap) across documented dates, with some patient-specific variation — reviewer validation recommended.`,
      sample: simPair[0].text,
    };
  }
  return { classification: "Patient-specific", note: "Documented text varies meaningfully across dates.", sample: normalized[0].text };
}

export function analyzeDocumentationSimilarity(
  discipline: Discipline | NotFound,
  byDimension: Partial<Record<SimilarityDimension, { date: string | NotFound; text: string }[]>>,
): DocumentationSimilarityFinding[] {
  const findings: DocumentationSimilarityFinding[] = [];
  for (const dimension of Object.keys(byDimension) as SimilarityDimension[]) {
    const entries = byDimension[dimension];
    if (!entries || entries.length === 0) continue;
    const { classification, note, sample } = classify(entries);
    findings.push({
      dimension,
      discipline,
      classification,
      datesCompared: entries.map((e) => String(e.date)),
      sampleText: sample,
      note,
    });
  }
  return findings;
}
