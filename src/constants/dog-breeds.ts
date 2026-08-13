import { dogBreeds as generatedDogBreeds } from "../generated/dog-breeds.generated";

export const dogBreeds = generatedDogBreeds.map((breed) => ({
  value: breed.id,
  label: breed.nameKo === breed.nameEn ? breed.nameEn : `${breed.nameKo} (${breed.nameEn})`
}));

export const dogBreedValues: readonly string[] = generatedDogBreeds.map(
  (breed) => breed.id
);
