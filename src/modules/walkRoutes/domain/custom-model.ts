/**
 * Builds the per-dog GraphHopper custom model (spec 5.4). Pure function:
 * nearby park polygons are fetched by the caller (route-generation.service.ts,
 * round 7) and passed in as plain GeoJSON data.
 *
 * IMPORTANT — resolves a spec inconsistency (see round-6 report): spec
 * 5.4's example "기본 커스텀 모델" JSON lists `STEPS: multiply_by 0`
 * unconditionally, which would block every dog from ever using stairs.
 * That directly contradicts spec 3.2's explicit, research-backed decision:
 * "계단 필터는 노령견, 질환 기재 개체, 3개월 이하 대형견 퍼피에만 적용함"
 * (healthy adult dogs of any breed should NOT have stairs filtered — see
 * the DachsLife 2015 findings cited in spec 9/10). This implementation
 * treats 3.2 as authoritative: STEPS is priority 0 only when
 * `profile.needsStairFilter` is true, and priority 1 (neutral, no penalty)
 * otherwise. Under this reading, the override table's "노령견 STEPS 0" and
 * "3개월 이하 대형견 퍼피 STEPS 0" rows are not separate actions — they are
 * restating the two age-driven cases already covered by
 * `needsStairFilter`, which is computed once in dog-profile.ts.
 */

import type {
  GraphHopperAreaFeature,
  GraphHopperCustomModel,
  GraphHopperPriorityStatement
} from "../../../lib/graphhopper-client";
import {
  CAR_FEAR_PRIMARY_MULTIPLIER,
  CAR_FEAR_SECONDARY_MULTIPLIER,
  CUSTOM_MODEL_PARK_AREA_ID_PREFIX,
  DISTANCE_INFLUENCE_DEFAULT,
  LARGE_BREED_SLOPE_MULTIPLIER,
  LARGE_BREED_SLOPE_THRESHOLD_DEGREES,
  PARK_PREFERENCE_AREA_MULTIPLIER,
  ROAD_CLASS_PRIORITY_MULTIPLIER,
  SENIOR_SLOPE_MULTIPLIER,
  SENIOR_SLOPE_THRESHOLD_DEGREES
} from "../../../constants/walk-tuning";
import type { DogProfile } from "./dog-profile";

export type NearbyParkArea = {
  /** Stable identifier for this park within the request (e.g. its DB id or
   * array index) — used only to build a unique GraphHopper area id. */
  id: string;
  /** GeoJSON Polygon rings, [lon, lat] pairs, first point of each ring
   * equal to its last (spec 5.4 제약 3). Not validated for
   * self-intersection here — that is PostGIS's job when the polygon is
   * first stored; this function only enforces the ring-closure shape
   * GraphHopper itself requires. */
  ringCoordinates: number[][][];
};

function isRingClosed(ring: number[][]): boolean {
  if (ring.length < 4) {
    return false;
  }

  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];

  return firstLon === lastLon && firstLat === lastLat;
}

function toAreaFeature(park: NearbyParkArea, areaIndex: number): GraphHopperAreaFeature {
  for (const ring of park.ringCoordinates) {
    if (!isRingClosed(ring)) {
      throw new Error(
        `Park area "${park.id}" has an unclosed ring — GraphHopper areas require the ` +
          "first and last coordinate of every ring to match (spec 5.4 제약 3)."
      );
    }
  }

  return {
    id: `${CUSTOM_MODEL_PARK_AREA_ID_PREFIX}${areaIndex}`,
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: park.ringCoordinates
    }
  };
}

/**
 * Road-class multipliers keyed by class, so per-dog overrides (car fear's
 * PRIMARY/SECONDARY values) can REPLACE the base value for that class
 * rather than being appended as a second statement with the same `if`
 * condition. GraphHopper applies every matching statement in the `priority`
 * array multiplicatively — two statements both matching `road_class ==
 * PRIMARY` would compound (e.g. base 0.15 × override 0.05 = 0.0075), which
 * is far more extreme than spec 5.4's override table appears to intend
 * ("PRIMARY 0.05" reads as "becomes 0.05", not "on top of 0.15"). Building
 * the map first and emitting one statement per class avoids that.
 */
function buildRoadClassMultipliers(needsStairFilter: boolean): Map<string, number> {
  const multipliers = new Map<string, number>(Object.entries(ROAD_CLASS_PRIORITY_MULTIPLIER));
  multipliers.set("STEPS", needsStairFilter ? 0 : 1);
  return multipliers;
}

/**
 * @param now Currently unused — was read to decide whether the 야간(저녁)
 *   lighting preference (spec 3.5) applies, but that preference is disabled
 *   (see the `lit` comment below) since GraphHopper has no such encoded
 *   value. Kept in the signature so route-generation.service.ts doesn't
 *   need a matching change to re-enable it once `lit` is real.
 * @param nearbyParks Parks within the search radius of the course being
 *   generated. Only consulted (and only added to the model) when the dog's
 *   personality prefers parks — keeping `areas` empty for the common case,
 *   which also limits how large the `areas` array can grow per request
 *   (spec 8 미확정 항목: "areas 개수 한계").
 */
export function buildCustomModel(
  profile: DogProfile,
  now: Date,
  nearbyParks: readonly NearbyParkArea[]
): GraphHopperCustomModel {
  const roadClassMultipliers = buildRoadClassMultipliers(profile.needsStairFilter);

  if (profile.personality.isCarFearful) {
    roadClassMultipliers.set("PRIMARY", CAR_FEAR_PRIMARY_MULTIPLIER);
    roadClassMultipliers.set("SECONDARY", CAR_FEAR_SECONDARY_MULTIPLIER);
  }

  const priority: GraphHopperPriorityStatement[] = Array.from(
    roadClassMultipliers.entries()
  ).map(([roadClass, multiplier]) => ({
    if: `road_class == ${roadClass}`,
    multiply_by: multiplier
  }));

  const isSeniorOrGeriatric = profile.lifeStage === "senior" || profile.lifeStage === "geriatric";

  if (isSeniorOrGeriatric) {
    priority.push({
      if: `average_slope > ${SENIOR_SLOPE_THRESHOLD_DEGREES}`,
      multiply_by: SENIOR_SLOPE_MULTIPLIER
    });
  }

  const isLargeOrGiant = profile.sizeClass === "large" || profile.sizeClass === "giant";

  if (isLargeOrGiant) {
    priority.push({
      if: `average_slope > ${LARGE_BREED_SLOPE_THRESHOLD_DEGREES}`,
      multiply_by: LARGE_BREED_SLOPE_MULTIPLIER
    });
  }

  // `lit` is NOT a real GraphHopper encoded value — confirmed 2026-08-10 via
  // a live 400 error ("'lit' not available") plus GraphHopper's own docs/
  // forum: OSM tags become encoded values only from their built-in catalog
  // (road_class, surface, average_slope, ...) or a custom Java TagParser
  // registered at server build time, neither of which covers an arbitrary
  // `lit=yes/no` OSM tag through YAML config alone. This spec 5.4 "저녁 →
  // 가로등 많은 길" preference (previously: `if isEveningOrNight, priority
  // push "lit == true"`) is disabled at the routing-priority level until a
  // real `lit` encoded value exists (custom GraphHopper build, or an
  // `areas` FeatureCollection built from our own `road_segments.lit` rows
  // the way parks already does it) — every evening/night request was
  // failing outright before this was found. See round-12+ follow-up.

  const customModel: GraphHopperCustomModel = {
    priority,
    distance_influence: DISTANCE_INFLUENCE_DEFAULT
  };

  if (profile.personality.prefersParks && nearbyParks.length > 0) {
    const areaFeatures = nearbyParks.map((park, index) => toAreaFeature(park, index));
    const combinedCondition = areaFeatures.map((feature) => `in_${feature.id}`).join(" || ");

    customModel.areas = {
      type: "FeatureCollection",
      features: areaFeatures
    };
    customModel.priority!.push({
      if: combinedCondition,
      multiply_by: PARK_PREFERENCE_AREA_MULTIPLIER
    });
  }

  return customModel;
}
