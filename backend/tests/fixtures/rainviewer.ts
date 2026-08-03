// Fixture RainViewer — structure de `GET /public/weather-maps.json`.
//
// Seuls `host`, `satellite.infrared`, `radar.past` et `radar.nowcast` sont
// consommés par `rainviewer.service.ts` ; `version` et `generated` figurent ici
// pour rappeler qu'ils existent et sont ignorés. La conformité au vrai contrat
// est vérifiée par `tests/contract/` (workflow nocturne).

const image = (time: number, path: string) => ({ time, path });

/** Assez d'images pour que les coupes du service soient observables. */
export const indexRainViewer = {
  version: '2.0',
  generated: 1_785_780_000,
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: Array.from({ length: 12 }, (_, i) =>
      image(1_785_700_000 + i * 600, `/v2/radar/${1_785_700_000 + i * 600}`)
    ),
    nowcast: Array.from({ length: 3 }, (_, i) =>
      image(1_785_780_000 + i * 600, `/v2/radar/nowcast_${i}`)
    ),
  },
  satellite: {
    infrared: Array.from({ length: 13 }, (_, i) =>
      image(1_785_700_000 + i * 600, `/v2/satellite/${1_785_700_000 + i * 600}`)
    ),
  },
};
