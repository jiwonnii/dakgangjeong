import { listDogBreedOptions } from "./dog-breed.service.js";
export const listDogBreeds = async (req, res, next) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search : undefined;
        const breeds = await listDogBreedOptions(search);
        res.json({
            breeds,
            count: breeds.length
        });
    }
    catch (error) {
        next(error);
    }
};
export const listDogs = (_req, res) => {
    res.status(501).json({
        message: "List dog profiles API is not implemented yet."
    });
};
export const createDog = (_req, res) => {
    res.status(501).json({
        message: "Create dog profile API is not implemented yet."
    });
};
export const joinDogByInviteCode = (_req, res) => {
    res.status(501).json({
        message: "Join dog profile by invite code API is not implemented yet."
    });
};
