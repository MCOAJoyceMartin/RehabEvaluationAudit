import { detectDisciplineFromText } from "../src/engine/pdf/DocumentClassifier";
import { extractOriginalSignature, extractCosignature } from "../src/engine/extraction/sharedExtraction";
import { STANDARDIZED_TESTS } from "../src/engine/extraction/ClinicalNormalizer";

let fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", label, ok ? "" : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}
// discipline detection
eq("SLP header", detectDisciplineFromText("SLP Evaluation & Plan of Treatment"), "SLP");
eq("ST header", detectDisciplineFromText("ST Evaluation & Plan of Treatment"), "SLP");
eq("Speech Therapy", detectDisciplineFromText("Speech Therapy Progress Report"), "SLP");
eq("SLP full name", detectDisciplineFromText("Speech-Language Pathology Discharge Summary"), "SLP");
eq("ST discharge", detectDisciplineFromText("ST Discharge Summary"), "SLP");
eq("street St. not ST", detectDisciplineFromText("Princeton Health 123 Main St Springfield"), null);
eq("'and' title is an evaluation page", /\bEvaluation\s*(?:&|and)?\s*Plan of Treatment\b/i.test("SLP Evaluation and Plan of Treatment"), true);
eq("name with M.S. degree", extractOriginalSignature("Original Signature: Electronically signed by Rachel Cereceros-Felix, M.S. CCC-SLP 9/13/2026 12:50:55 PM CDT")?.name, "Rachel Cereceros-Felix");
eq("PT still PT", detectDisciplineFromText("PT Evaluation & Plan of Treatment"), "PT");
eq("OT still OT", detectDisciplineFromText("OT Evaluation & Plan of Treatment"), "OT");
// signatures
const sig = (n: string, c: string) => `Original Signature: Electronically signed by ${n}, ${c} 6/2/2026 04:30:45 PM CDT`;
for (const c of ["SLP", "CCC-SLP", "ST", "SLPA", "PT", "OTR", "OTA", "COTA", "OTR/L"]) {
  const r = extractOriginalSignature(sig("Jane Doe", c));
  eq(`sig ${c}`, [r?.name, r?.credential], ["Jane Doe", c]);
}
// names ending in credential letters must not be truncated
eq("name ending 'st'", extractOriginalSignature(sig("Darla Forest", "SLP"))?.name, "Darla Forest");
eq("name ending 'ot' no comma", extractOriginalSignature("Original Signature: Electronically signed by Margot OTR 6/2/2026 04:30:45 PM CDT")?.name, "Margot");
eq("cosig ST", extractCosignature("Cosignature: Electronically co-signed by Ann Lee, ST 6/3/2026 08:00:00 AM EDT")?.credential, "ST");
// tests
const slp = STANDARDIZED_TESTS.SLP;
const hit = (t: string) => slp.some((re) => re.test(t));
eq("MoCA", hit("MoCA 22/30"), true);
eq("CLQT", hit("Cognitive Linguistic Quick Test"), true);
eq("ACL knee not a test", hit("ACL repair"), false);
process.exit(fail ? 1 : 0);
