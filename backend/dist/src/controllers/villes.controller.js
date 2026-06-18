import { CITIES } from '../data/cities.js';
export default {
    getAll: (_req, res) => {
        const villes = Object.values(CITIES).map(({ id, nom, latitude, longitude }) => ({
            id,
            nom,
            latitude,
            longitude,
        }));
        res.json(villes);
    },
};
