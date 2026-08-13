import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { createDog, joinDogByInviteCode, listDogBreeds, listDogs } from "./dog.controller.js";
export const dogRouter = Router();
dogRouter.get("/breeds", listDogBreeds);
dogRouter.use(requireAuth);
dogRouter.get("/", listDogs);
dogRouter.post("/", createDog);
dogRouter.post("/join", joinDogByInviteCode);
