import { ref } from 'vue';

export const BASE_URL_AI_STABLE = "https://aihorde.net";
export const BASE_URL_EU_STABLE = "https://libertas.zapto.org";
export const MODELS_DB_URL = "https://raw.githubusercontent.com/db0/AI-Horde-image-model-reference/main/stable_diffusion.json";
export const POLL_DASHBOARD_INTERVAL = 30; // seconds
export const POLL_WORKERS_INTERVAL   = 60; // seconds
export const POLL_MODELS_INTERVAL    = 30; // seconds
export const POLL_STYLES_INTERVAL    = 60 * 30; // seconds
export const POLL_USERS_INTERVAL     = 60 * 5; // seconds
export const MAX_PARALLEL_IMAGES     = 20;
export const MAX_PARALLEL_REQUESTS   = 10;
export const DEBUG_MODE = false;
export const dots = ref("...");