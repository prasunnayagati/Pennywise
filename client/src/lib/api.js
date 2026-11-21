import axios from "axios";

const apiPort = "5000";
const apiHost = window.location.hostname || "localhost";
const api=axios.create({baseURL:`${window.location.protocol}//${apiHost}:${apiPort}/api`});
api.interceptors.response.use(r=>r,e=>Promise.reject(new Error(e.response?.data?.error||"Could not connect to Pennywise API. Check that the server is reachable.")));
export default api;