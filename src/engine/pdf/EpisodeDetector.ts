import type { DocumentClassificationEntry, EpisodeBoundary, Discipline, NotFound } from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";
import type { PageText } from "./PDFParser";
import { detectDisciplineFromHeading } from "./DocumentClassifier";

/**
 * EpisodeDetector
 * ================
 * Groups classified pages into contiguous document boundaries and tags each
 * with the discipline detected within its own page range — critical for the
 * v2 requirement that a batch containing both PT and OT documentation
 * produces two entirely separate, never-blended audits (see
 * PRE_BUILD_RUBRIC_ANALYSIS.md principle #6). A batch with only one
 * discipline still works exactly as before; nothing here changes v1's single
 * -discipline behavior when only one discipline is present.
 *
 * IMPORTANT: a boundary break happens on either a documentType change OR a
 * discipline change — NOT documentType alone. A real NetHealth batch can
 * place an OT Evaluation immediately after a PT Evaluation (both classified
 * as documentType "EVALUATION"); grouping purely by documentType would
 * silently merge two different disciplines' documents into one boundary and
 * then have to guess a single discipline for the merged block. Discipline is
 * instead detected per PAGE (from that page's own repeated heading — see
 * detectDisciplineFromHeading) and carried forward across pages whose own
 * heading didn't yield a discipline (a sparse continuation page), the same
 * way DocumentClassifier carries documentType forward.
 */
export function detectEpisodeBoundaries(classification: DocumentClassificationEntry[], pages: PageText[]): EpisodeBoundary[] {
  const pageDiscipline = new Map<number, Discipline | NotFound>();
  for (const entry of classification) {
    const page = pages.find((p) => p.pageNumber === entry.page);
    pageDiscipline.set(entry.page, (page ? detectDisciplineFromHeading([page]) : null) ?? NOT_FOUND);
  }

  const boundaries: EpisodeBoundary[] = [];
  let current: EpisodeBoundary | null = null;

  for (const entry of classification) {
    const discipline = pageDiscipline.get(entry.page) ?? NOT_FOUND;
    const sameDocument =
      current !== null &&
      current.documentType === entry.documentType &&
      (discipline === NOT_FOUND || current.discipline === NOT_FOUND || current.discipline === discipline);

    if (current && sameDocument) {
      current.endPage = entry.page;
      // A sparse continuation page whose own heading didn't yield a
      // discipline shouldn't erase an already-known one; conversely, adopt a
      // real discipline the FIRST page of the group failed to detect.
      if (current.discipline === NOT_FOUND && discipline !== NOT_FOUND) current.discipline = discipline;
    } else {
      if (current) boundaries.push(current);
      current = { documentType: entry.documentType, discipline, startPage: entry.page, endPage: entry.page };
    }
  }
  if (current) boundaries.push(current);

  return boundaries;
}

export function findInitialEvaluationBoundary(boundaries: EpisodeBoundary[]): EpisodeBoundary | null {
  return boundaries.find((b) => b.documentType === "EVALUATION") ?? null;
}

/** All disciplines with at least one EVALUATION boundary in this batch —
 *  the unit the pipeline segregates audits by. A boundary whose discipline
 *  could not be detected is not counted as its own "discipline" (that would
 *  fabricate a 4th audit out of nothing); its documents are still available
 *  to whichever discipline's boundary they fall nearest, but classification
 *  never guesses a discipline that wasn't actually detected in the text. */
export function detectDisciplinesInBatch(boundaries: EpisodeBoundary[]): Discipline[] {
  const found = new Set<Discipline>();
  for (const b of boundaries) {
    if (b.documentType === "EVALUATION" && b.discipline !== NOT_FOUND) found.add(b.discipline);
  }
  return [...found];
}

export function boundariesForDiscipline(boundaries: EpisodeBoundary[], discipline: Discipline): EpisodeBoundary[] {
  return boundaries.filter((b) => b.discipline === discipline);
}
