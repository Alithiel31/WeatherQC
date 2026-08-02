// Fixture Zippopotam — structure de `GET /ca/{rta}`.
//
// Seuls `places[].place name`, `state`, `latitude` et `longitude` sont consommés
// par `geocode.service.ts`. La conformité au vrai contrat est vérifiée par
// `tests/contract/` (workflow nocturne).

export const reponseZippopotam = {
  'post code': 'H2X',
  country: 'Canada',
  'country abbreviation': 'CA',
  places: [
    {
      'place name': 'Montreal',
      longitude: '-73.5673',
      state: 'Quebec',
      'state abbreviation': 'QC',
      latitude: '45.5088',
    },
  ],
};
