/**
 * cptGoalMapping
 * ================
 * The CPT -> functional-area associations the spec gives as worked examples
 * (97116 gait training -> gait/mobility goal; 97535 self-care training ->
 * ADL goal; 97112 neuromuscular reeducation -> balance/coordination/motor-
 * control goal), extended with the remaining CPT codes actually observed in
 * the James Askew fixture so DN_LINKED_TO_GOALS and the Goal Lifecycle
 * Engine's "treatment after goal met" check have somewhere to look up every
 * code that appears. A CPT code alone never PROVES the linkage (spec
 * principle #13) — this table only narrows which goal(s) a code is
 * plausibly targeting; the narrative text is still what the evaluator
 * checks for an actual documented connection.
 */
export const CPT_TO_AREA: Record<string, string[]> = {
  "97110": ["Strength", "Endurance"], // therapeutic exercise
  "97112": ["Balance", "Cognition/Safety"], // neuromuscular reeducation
  "97116": ["Ambulation/Gait"], // gait training
  "97140": ["Transfers", "Bed Mobility"], // manual therapy
  "97150": ["Strength", "Endurance", "Balance"], // group therapeutic procedure
  "97530": ["ADL/IADL", "Transfers", "Balance"], // therapeutic activities
  "97535": ["ADL/IADL"], // self-care/home management training
  "97162": [], // PT evaluation — not a treatment-toward-a-goal code
  "97166": [], // OT evaluation — not a treatment-toward-a-goal code
};

export function areasForCpt(code: string): string[] {
  return CPT_TO_AREA[code] ?? [];
}
