import { useCallback, useState } from "react";
import type { AuditStatus, Discipline, NotFound } from "../types/audit";

export interface ReviewerOverride {
  overriddenScore: number | null;
  overriddenStatus?: AuditStatus;
  reviewerNote: string;
  marked: boolean;
}

/**
 * Criterion ids are NOT globally unique across disciplines — a PT and an OT
 * audit both have a criterion with id "EVAL_MEDICAL_HISTORY", for instance,
 * because the same rubric is applied independently to each discipline's own
 * documentation. Keying overrides by criterionId alone would silently blend
 * a PT reviewer's override into OT's card (or vice versa) whenever both
 * disciplines are present in one batch. Every override is therefore keyed
 * by `${discipline}:${criterionId}`.
 */
export function overrideKey(discipline: Discipline | NotFound, criterionId: string): string {
  return `${discipline}:${criterionId}`;
}

/**
 * Reviewer overrides are held ONLY in React state for the lifetime of the
 * session — never written to localStorage/sessionStorage/a backend. This
 * keeps PHI-adjacent review notes off persistent browser storage by
 * default (see PHI/Security requirements). A production deployment that
 * needs overrides to survive a refresh should wire this to whatever
 * secure, access-controlled store the organization already uses for
 * clinical review — NOT generic browser storage.
 */
export function useReviewerOverrides() {
  const [overrides, setOverrides] = useState<Record<string, ReviewerOverride>>({});

  const setOverrideScore = useCallback((discipline: Discipline | NotFound, criterionId: string, score: number | null) => {
    const key = overrideKey(discipline, criterionId);
    setOverrides((prev) => ({ ...prev, [key]: { ...emptyOverride(prev[key]), overriddenScore: score } }));
  }, []);

  const setReviewerNote = useCallback((discipline: Discipline | NotFound, criterionId: string, note: string) => {
    const key = overrideKey(discipline, criterionId);
    setOverrides((prev) => ({ ...prev, [key]: { ...emptyOverride(prev[key]), reviewerNote: note } }));
  }, []);

  const setMarked = useCallback((discipline: Discipline | NotFound, criterionId: string, marked: boolean) => {
    const key = overrideKey(discipline, criterionId);
    setOverrides((prev) => ({ ...prev, [key]: { ...emptyOverride(prev[key]), marked } }));
  }, []);

  const clearOverride = useCallback((discipline: Discipline | NotFound, criterionId: string) => {
    const key = overrideKey(discipline, criterionId);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return { overrides, setOverrideScore, setReviewerNote, setMarked, clearOverride };
}

function emptyOverride(existing?: ReviewerOverride): ReviewerOverride {
  return existing ?? { overriddenScore: null, reviewerNote: "", marked: false };
}
