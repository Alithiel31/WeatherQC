/**
 * URL de base de l'API backend.
 * Utilise le hostname courant pour fonctionner aussi bien sur localhost
 * que depuis un autre appareil Tailscale (ex. 100.109.50.124).
 */
export const API_URL = `http://${window.location.hostname}:3005`;
