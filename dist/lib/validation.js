import { AppError } from "./app-error.js";
export function validateRequest(schema, part = "body") {
    return (req, _res, next) => {
        const result = schema.safeParse(req[part]);
        if (!result.success) {
            next(new AppError("Invalid request data.", 400, "VALIDATION_ERROR", result.error.flatten()));
            return;
        }
        req[part] = result.data;
        next();
    };
}
