import type { Discipline, DocumentationConsistencyFinding, DocumentType, NotFound } from "../../types/audit";

/**
 * DocumentationConsistencyEngine
 * =================================
 * Compares a longitudinally-tracked field's values across documents and
 * flags POTENTIAL inconsistencies for reviewer attention — never an
 * automatic scored failure, and never asserted as a contradiction. Per
 * spec: different dates/tasks/contexts, performance-vs-capacity framing,
 * device changes, and genuine clinical progression are all legitimate
 * reasons two values could differ, so this only ever reports "Potential
 * inconsistency — reviewer validation recommended", it does not judge
 * which value (if either) is wrong.
 */
export function checkFieldConsistency(
  field: string,
  discipline: Discipline | NotFound,
  values: { date: string | NotFound; value: string; sourceDocType: DocumentType; page: number | NotFound }[],
): DocumentationConsistencyFinding | null {
  const nonEmpty = values.filter((v) => v.value && v.value.trim().length > 0);
  if (nonEmpty.length < 2) return null;
  const distinct = new Set(nonEmpty.map((v) => v.value.trim().toLowerCase()));
  if (distinct.size < 2) return null;
  return {
    field,
    discipline,
    values: nonEmpty,
    note: "Potential inconsistency — reviewer validation recommended. Different values across documents may reflect a legitimate change over time (e.g. a payer transition, a resolved precaution, or genuine clinical progression) rather than a documentation error.",
  };
}
