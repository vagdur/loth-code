/**
 * Per-day options and user choices.
 *
 * A liturgical day can carry several legitimate choices: which celebration
 * to observe (optional memorials, Saturday BVM), which source an ad libitum
 * part is taken from (common vs. feria, office-spec §5.4), which melody to
 * sing a text to ("eller" alternatives), and whether a Daytime Hour is the
 * first said today (current vs. complementary psalmody).
 *
 * `enumerateDayOptions` (src/options/enumerate.ts) produces `DayOption`s for
 * display; the caller feeds selected `DayChoices` back into resolveDay /
 * buildDay / the assemblers. Absent or stale choice ids are silently ignored
 * and fall back to the default, so a UI holding an outdated option set can
 * never produce an invalid office. Changing an upstream choice (celebration,
 * a `.source` choice) may invalidate downstream option ids — re-enumerate
 * after each change.
 */

export type DayOptionKind = "celebration" | "part_source" | "melody" | "psalmody";

export interface OptionChoice {
  /**
   * Stable within the option, e.g. "feria", "saint:teresa_av_jesus",
   * "bvm_saturday", "common:martyrs:0", "psalter", or a melody ref id.
   */
  id: string;
  /** Human-readable display label (locale language). */
  label: string;
}

export interface DayOption {
  /**
   * Stable id addressing the decision point:
   *   "celebration"
   *   "<hour>.<slot>.source"            e.g. "lauds.hymn.source"
   *   "<hour>.<slot>[.<path>].melody"   e.g. "lauds.benedictusAntiphon.melody"
   *   "<hour>.psalmody"                 daytime hours only
   * Hour keys: invitatory | officeOfReadings | lauds | terce | sext | none
   *            | firstVespers | vespers | compline.
   */
  id: string;
  kind: DayOptionKind;
  /** Display label for the option itself (what is being chosen). */
  label: string;
  choices: OptionChoice[];
  /** Always one of choices[].id; selecting it reproduces default behavior. */
  defaultChoiceId: string;
}

/** Map of optionId -> chosen choiceId. Unknown entries are ignored. */
export type DayChoices = Readonly<Record<string, string>>;

/** Choice ids for the daytime psalmody option. */
export const PSALMODY_CURRENT = "current";
export const PSALMODY_COMPLEMENTARY = "complementary";
