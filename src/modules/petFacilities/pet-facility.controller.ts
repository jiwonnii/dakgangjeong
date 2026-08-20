import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import type { petFacilityListQuerySchema } from "./pet-facility.schemas";

type PetFacilityRow = {
  id: string;
  name: string;
  facility_type: "hospital" | "grooming" | "cafe" | "other";
  source: string;
  lat: number;
  lon: number;
  distance_m: number;
};

function toPetFacility(row: PetFacilityRow) {
  return {
    id: row.id,
    name: row.name,
    facilityType: row.facility_type,
    source: row.source,
    lat: row.lat,
    lon: row.lon,
    distanceMeters: Math.round(row.distance_m)
  };
}

export const listNearbyPetFacilities: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof petFacilityListQuerySchema>;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("list_pet_facilities_nearby", {
      origin_lat: query.lat,
      origin_lon: query.lon,
      radius_m: query.radiusM,
      facility_type_filter: query.type ?? null,
      result_limit: query.limit
    });

    if (error) {
      throw new AppError(error.message, 500, "PET_FACILITY_LIST_FAILED");
    }

    res.json({ facilities: ((data ?? []) as PetFacilityRow[]).map(toPetFacility) });
  } catch (error) {
    next(error);
  }
};
