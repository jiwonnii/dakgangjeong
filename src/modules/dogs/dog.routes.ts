import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import {
  createDog,
  joinDogByInviteCode,
  listDogBreeds,
  listDogs
} from "./dog.controller";

export const dogRouter = Router();

dogRouter.get("/breeds", listDogBreeds);
dogRouter.use(requireAuth);
dogRouter.get("/", listDogs);
dogRouter.post("/", createDog);
dogRouter.post("/join", joinDogByInviteCode);
