/**
 * Conference-specific dates for seasonal solemnities (Epiphany, Corpus Christi, Ascension).
 * Configured in particular calendar YAML via `seasonal_observance`.
 */

export type EpiphanyObservance = "fixed_jan_6" | "sunday_jan_2_8";

export type CorpusChristiObservance =
  | "thursday_after_trinity"
  | "second_sunday_after_pentecost";

export type AscensionObservance = "thursday" | "sunday";

export type SeasonalFeast = "epiphany" | "corpus_christi" | "ascension";

export interface SeasonalObservancePolicy {
  epiphany: EpiphanyObservance;
  corpusChristi: CorpusChristiObservance;
  ascension: AscensionObservance;
}

export type SeasonalObservanceOverride = Partial<SeasonalObservancePolicy>;

export const DEFAULT_SEASONAL_OBSERVANCE: SeasonalObservancePolicy = {
  epiphany: "fixed_jan_6",
  corpusChristi: "thursday_after_trinity",
  ascension: "thursday",
};

export const EPIPHANY_OBSERVANCE_VALUES: readonly EpiphanyObservance[] = [
  "fixed_jan_6",
  "sunday_jan_2_8",
];

export const CORPUS_CHRISTI_OBSERVANCE_VALUES: readonly CorpusChristiObservance[] =
  ["thursday_after_trinity", "second_sunday_after_pentecost"];

export const ASCENSION_OBSERVANCE_VALUES: readonly AscensionObservance[] = [
  "thursday",
  "sunday",
];
