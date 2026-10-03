// Bundled into the server's public/ folder at build time (see Dockerfile).
// When the frontend is served by this same server, the API is same-origin,
// so a relative path works and avoids the cross-origin Basic Auth/CORS
// dance that config.example.js's cross-origin setup needs.
window.VUETODO_API_BASE = '/api';
