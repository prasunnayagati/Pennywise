import axios from "axios";

export const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname || "localhost"}:5000/api`
  : "/api");
export const apiOrigin = new URL(apiBase, window.location.origin).origin;
const api=axios.create({baseURL:apiBase});
api.interceptors.response.use(r=>r,e=>Promise.reject(new Error(e.response?.data?.error||"Could not connect to Pennywise API. Check that the server is reachable.")));
export default api;