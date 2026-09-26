// Fixture Open-Meteo Geocoding — structure de `GET /v1/search`.
//
// Seuls `name`, `latitude`, `longitude`, `country_code`, `admin1` et
// `population` sont consommés par `geocode.service.ts`. La conformité au
// vrai contrat est vérifiée par `tests/contract/` (workflow nocturne).

export const reponseGeocodageMontreal = {
  results: [
    {
      id: 6077243,
      name: 'Montréal',
      latitude: 45.50884,
      longitude: -73.58781,
      country_code: 'CA',
      admin1: 'Québec',
      population: 3519595,
    },
    // Une homonyme hors Québec, pour vérifier que le filtre de province écarte
    // bien tout ce qui n'est pas admin1 = Québec.
    {
      id: 4164138,
      name: 'Montreal',
      latitude: 25.35,
      longitude: -80.4,
      country_code: 'US',
      admin1: 'Florida',
      population: 8000,
    },
  ],
};

// Deux villes homonymes au Québec, pour vérifier que la plus peuplée gagne.
export const reponseGeocodageSaintJean = {
  results: [
    {
      id: 1,
      name: 'Saint-Jean-sur-Richelieu',
      latitude: 45.30742,
      longitude: -73.26202,
      country_code: 'CA',
      admin1: 'Québec',
      population: 98676,
    },
    {
      id: 2,
      name: 'Saint-Jean',
      latitude: 48.6,
      longitude: -64.3,
      country_code: 'CA',
      admin1: 'Québec',
      population: 1200,
    },
  ],
};
