/**
 * Backend API configuration — the single place the backend URL lives.
 * Used by the app and the Playwright API tests. To point at a different
 * backend, change API_BASE_URL below (no .env needed).
 */
//export const API_BASE_URL = 'https://scm-api.emeraldcfze.com/api';
export const API_BASE_URL = 'https://supply-chain-backend-hwh6.onrender.com/api';

/** Backend origin for file URLs whose paths already include `/api`. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/** Realtime websocket endpoint (used by src/services/websocket.ts). */
export const WS_URL = 'ws://localhost:3000/ws';
