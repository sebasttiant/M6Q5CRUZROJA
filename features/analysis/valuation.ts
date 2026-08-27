import { CATEGORIES, MAX_MAIN_CAUSES, type CategoryKey } from "./constants";

/**
 * Mirrors AC-43!G30 of the source format: multiply only the impact cells that were filled in,
 * and score the block as 0 when none of them was.
 */
export function calculateValuation(impacts: ReadonlyArray<number | null | undefined>): number {
  const completed = impacts.filter((impact): impact is number => impact !== null && impact !== undefined);
  if (completed.length === 0) return 0;
  return completed.reduce((total, impact) => total * impact, 1);
}

export interface RankableSubcause {
  description: string;
  impact: number | null | undefined;
}

export interface RankableCategory {
  category: CategoryKey;
  subcauses: ReadonlyArray<RankableSubcause>;
}

export interface MainCauseCandidate {
  category: CategoryKey;
  valuation: number;
  /** Highest impact subcause of the category, offered as the default associated subcause. */
  subcause: string;
}

const canonicalOrder = (category: CategoryKey) => CATEGORIES.findIndex(({ key }) => key === category);

function highestImpactSubcause(subcauses: ReadonlyArray<RankableSubcause>): string {
  const described = subcauses.filter((subcause) => subcause.description.trim().length > 0);
  if (described.length === 0) return "";
  return described.reduce((best, current) => ((current.impact ?? 0) > (best.impact ?? 0) ? current : best)).description.trim();
}

/**
 * The format leaves the two main causes to be typed by hand after reading the valuation column.
 * We rank them instead: highest valuation first, ties resolved by the canonical 6M order so the
 * suggestion never depends on the order the form happens to hold the categories in.
 */
export function rankMainCauseCandidates(
  categories: ReadonlyArray<RankableCategory>,
  limit: number = MAX_MAIN_CAUSES,
): MainCauseCandidate[] {
  return categories
    .map((category) => ({
      category: category.category,
      valuation: calculateValuation(category.subcauses.map(({ impact }) => impact)),
      subcause: highestImpactSubcause(category.subcauses),
    }))
    .filter((candidate) => candidate.valuation > 0)
    .sort((left, right) => right.valuation - left.valuation || canonicalOrder(left.category) - canonicalOrder(right.category))
    .slice(0, limit);
}
