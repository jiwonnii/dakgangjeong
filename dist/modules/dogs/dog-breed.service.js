import { dogBreeds as generatedDogBreeds } from "../../generated/dog-breeds.generated.js";
import { supabaseAdmin } from "../../lib/supabase.js";
const fallbackDogBreeds = [...generatedDogBreeds];
function normalizeSearch(value) {
    return value.toLowerCase().replace(/[\s_-]+/g, "");
}
function mapDogBreedRow(row) {
    return {
        id: row.id,
        nameKo: row.name_ko,
        nameEn: row.name_en,
        groupName: row.group_name,
        aliases: row.aliases ?? [],
        isPopular: row.is_popular,
        source: row.source,
        sortOrder: row.sort_order
    };
}
function matchesSearch(breed, search) {
    const query = normalizeSearch(search?.trim() ?? "");
    if (!query) {
        return true;
    }
    const values = [
        breed.id,
        breed.nameKo,
        breed.nameEn,
        breed.groupName ?? "",
        ...breed.aliases
    ];
    return values.some((value) => normalizeSearch(value).includes(query));
}
function sortDogBreeds(breeds) {
    return [...breeds].sort((a, b) => {
        if (a.isPopular !== b.isPopular) {
            return a.isPopular ? -1 : 1;
        }
        if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
        }
        return a.nameKo.localeCompare(b.nameKo, "ko");
    });
}
function listFallbackDogBreeds(search) {
    return sortDogBreeds(fallbackDogBreeds.filter((breed) => matchesSearch(breed, search)));
}
export async function listDogBreedOptions(search) {
    if (!supabaseAdmin) {
        return listFallbackDogBreeds(search);
    }
    const { data, error } = await supabaseAdmin
        .from("dog_breeds")
        .select("id, name_ko, name_en, group_name, aliases, is_popular, source, sort_order")
        .order("is_popular", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("name_ko", { ascending: true });
    if (error || !data) {
        return listFallbackDogBreeds(search);
    }
    return data.map(mapDogBreedRow).filter((breed) => matchesSearch(breed, search));
}
export async function findDogBreedById(id) {
    const normalizedId = id.trim();
    if (!normalizedId) {
        return null;
    }
    if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
            .from("dog_breeds")
            .select("id, name_ko, name_en, group_name, aliases, is_popular, source, sort_order")
            .eq("id", normalizedId)
            .maybeSingle();
        if (!error && data) {
            return mapDogBreedRow(data);
        }
    }
    return fallbackDogBreeds.find((breed) => breed.id === normalizedId) ?? null;
}
