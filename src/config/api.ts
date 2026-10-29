/** Single source of truth for the backend used by the frontend and API tests. */
export const API_BASE_URL = 'https://scm-api.emeraldcfze.com/api';

/** Backend origin for file URLs whose paths already include `/api`. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
