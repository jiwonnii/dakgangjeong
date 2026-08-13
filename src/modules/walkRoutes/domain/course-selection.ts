/**
 * 5.7절 최종 선정: 방위별 최고점 1개씩. Generic over whichever ranking
 * strategy produced the input (scoring-filter.ts's rankByHierarchicalFilter
 * or scoring-weighted.ts's rankByWeightedScore) — both already return a
 * best-first ordering, so this only needs to know how to read a bearing
 * bin out of each item.
 *
 * GraphHopper can occasionally return the same round-trip geometry for
 * different bearings. The optional route signature keeps those duplicates
 * from occupying multiple visible course cards.
 */

import type { BearingBin } from "../../../types/domain";
import { FINAL_COURSE_COUNT } from "../../../constants/walk-tuning";

/**
 * @param rankedBestFirst Candidates already sorted best-first by whichever
 *   ranking strategy is in use.
 * @param getBearingBin Extracts the bearing bin from one item — e.g.
 *   `(f) => f.bearing.bin` for CourseFacts, `(s) => s.facts.bearing.bin`
 *   for ScoredCourse.
 * @param getRouteSignature Optional stable identity for the actual path.
 * @returns Up to FINAL_COURSE_COUNT items in the same best-first relative
 *   order as the input. First prefers one course per distinct bearing bin,
 *   then backfills with unique routes from already-ranked candidates when
 *   GraphHopper only produced usable routes in one or two directions.
 */
export function selectFinalCourses<T>(
  rankedBestFirst: readonly T[],
  getBearingBin: (item: T) => BearingBin,
  getRouteSignature?: (item: T) => string
): T[] {
  const selected: T[] = [];
  const usedBearingBins = new Set<BearingBin>();
  const usedRouteSignatures = new Set<string>();

  for (const item of rankedBestFirst) {
    if (selected.length >= FINAL_COURSE_COUNT) {
      break;
    }

    const bin = getBearingBin(item);
    const routeSignature = getRouteSignature?.(item);

    if (usedBearingBins.has(bin)) {
      continue;
    }

    if (routeSignature && usedRouteSignatures.has(routeSignature)) {
      continue;
    }

    selected.push(item);
    usedBearingBins.add(bin);

    if (routeSignature) {
      usedRouteSignatures.add(routeSignature);
    }
  }

  if (selected.length >= FINAL_COURSE_COUNT) {
    return selected;
  }

  for (const item of rankedBestFirst) {
    if (selected.length >= FINAL_COURSE_COUNT) {
      break;
    }

    if (selected.includes(item)) {
      continue;
    }

    const routeSignature = getRouteSignature?.(item);

    if (routeSignature && usedRouteSignatures.has(routeSignature)) {
      continue;
    }

    selected.push(item);

    if (routeSignature) {
      usedRouteSignatures.add(routeSignature);
    }
  }

  return selected;
}
