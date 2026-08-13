import { AppError } from "../lib/app-error.js";
export const notFoundHandler = (req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.path}`, 404, "NOT_FOUND"));
};
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details
            }
        });
        return;
    }
    console.error(err);
    res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected server error."
        }
    });
};
