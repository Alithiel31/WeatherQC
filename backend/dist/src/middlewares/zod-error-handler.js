import { ZodError } from 'zod';
export const zodErrorHandler = (err, _req, res, next) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            erreur: 'Paramètres invalides',
            details: err.errors.map((e) => ({
                chemin: e.path.join('.'),
                message: e.message,
            })),
        });
    }
    next(err);
};
