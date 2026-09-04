import type { PageText } from "../pdf/PDFParser";
import { NOT_FOUND } from "../../types/audit";
import { detectDisciplineFromHeading } from "../pdf/DocumentClassifier";
import { extractOriginalSignature, extractCosignature, extractRevisionSignature } from "./sharedExtraction";
import type { DailyEncounter, ExtractedDailyNoteDocument } from "./extractionTypes";

/**
 * DailyNoteExtractor
 * ====================
 * A single "Treatment Encounter Note(s)" PDF boundary packs MANY dated
 * encounters back-to-back (one per date of service), each with its own
 * signature block and occasionally a later "Revision Signature" changelog
 * entry appended after the fact. This is genuinely different from every
 * other document type's single-record-per-boundary shape, so it gets its
 * own bespoke line-based parser rather than reusing the row/table engine.
 *
 * Every field defaults to an empty string / null rather than throwing when
 * a line doesn't match an expected pattern — an unmatched line is dropped
 * (e.g. the "Summary of Daily Skilled Services" section caption, an orphan
 * "Target Heart Rate Range:" line with no left-column label) rather than
 * guessed into the wrong field.
 */

const DOS_RE = /^Date of Service:\s*([\d/]+)\s+Completed Date:\s*([\d/]+)\s*$/i;
const CPT_LINE_RE = /^(\d{5})\s+\1:\s*(.*)$/;
const EVAL_CPT_RE = /^Evaluation\s+(\d{5}):\s*(.*)$/i;
const REVISION_CHANGELOG_NOISE_RE =
  /^(Changes\s+Modified By|Assessment$|Assessment (added|modified|removed)|Discipline:|Changes For:|\[.*\]\s*:\s*Treatment Encounter Note)/i;

type FreeTextField = "precautions" | "contraindications" | "preTx" | "coTreatmentRaw" | "responseToTx" | "complexities" | "supervisionRaw";

const LABEL_STARTS: { re: RegExp; field: FreeTextField }[] = [
  { re: /^Precautions\s+(.*)$/i, field: "precautions" },
  { re: /^Contraindications\s+(.*)$/i, field: "contraindications" },
  { re: /^Pre-Tx\s+(.*)$/i, field: "preTx" },
  { re: /^Co-Treatment\s+(.*)$/i, field: "coTreatmentRaw" },
  { re: /^Response to Tx\s+(.*)$/i, field: "responseToTx" },
  { re: /^Complexities\s+(.*)$/i, field: "complexities" },
  { re: /^Supervision\s+(.*)$/i, field: "supervisionRaw" },
];

function emptyEncounter(dos: string, completedDate: string, page: number): DailyEncounter {
  return {
    dos: dos || NOT_FOUND,
    completedDate: completedDate || NOT_FOUND,
    precautions: "",
    contraindications: "",
    preTx: "",
    cptEntries: [],
    coTreatmentRaw: "",
    responseToTx: "",
    complexities: "",
    supervisionRaw: "",
    originalSignature: null,
    cosignature: null,
    revisionSignature: null,
    page,
  };
}

export function extractDailyNoteEncounters(pages: PageText[]): ExtractedDailyNoteDocument {
  const discipline = detectDisciplineFromHeading(pages) ?? NOT_FOUND;

  const encounters: DailyEncounter[] = [];
  let current: DailyEncounter | null = null;
  let currentField: FreeTextField | "cpt" | null = null;
  let currentCptIndex = -1;

  const flush = () => {
    if (current) encounters.push(current);
    current = null;
    currentField = null;
    currentCptIndex = -1;
  };

  for (const page of pages) {
    for (const rawLine of page.lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const dosMatch = line.match(DOS_RE);
      if (dosMatch) {
        flush();
        current = emptyEncounter(dosMatch[1], dosMatch[2], page.pageNumber);
        continue;
      }
      if (!current) continue; // header/title lines before the first encounter

      if (REVISION_CHANGELOG_NOISE_RE.test(line)) {
        currentField = null;
        continue;
      }
      if (/^Original Signature:/i.test(line)) {
        current.originalSignature = extractOriginalSignature(line);
        currentField = null;
        continue;
      }
      if (/^Cosignature:/i.test(line)) {
        current.cosignature = extractCosignature(line);
        currentField = null;
        continue;
      }
      if (/^Revision Signature:/i.test(line)) {
        current.revisionSignature = extractRevisionSignature(line);
        currentField = null;
        continue;
      }
      if (/^Date$/i.test(line)) continue; // standalone "Date" column caption under each signature

      const cpt = line.match(CPT_LINE_RE);
      if (cpt) {
        current.cptEntries.push({ code: cpt[1], narrative: cpt[2] });
        currentField = "cpt";
        currentCptIndex = current.cptEntries.length - 1;
        continue;
      }
      const evalCpt = line.match(EVAL_CPT_RE);
      if (evalCpt) {
        current.cptEntries.push({ code: evalCpt[1], narrative: evalCpt[2] });
        currentField = "cpt";
        currentCptIndex = current.cptEntries.length - 1;
        continue;
      }

      let matched = false;
      for (const { re, field } of LABEL_STARTS) {
        const m = line.match(re);
        if (m) {
          if (currentField === field && current[field]) {
            current[field] += ` ${m[1]}`;
          } else {
            current[field] = m[1];
          }
          currentField = field;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // Continuation line: append to whichever field/CPT entry is active.
      if (currentField === "cpt" && currentCptIndex >= 0) {
        current.cptEntries[currentCptIndex].narrative += ` ${line}`;
      } else if (currentField && currentField !== "cpt") {
        current[currentField] += ` ${line}`;
      }
      // else: unattached boilerplate (section caption, orphan sub-line) — dropped.
    }
  }
  flush();

  return {
    discipline,
    encounters,
    boundaryPages: { start: pages[0]?.pageNumber ?? 0, end: pages[pages.length - 1]?.pageNumber ?? 0 },
  };
}
