import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "https://api.optileno.com").replace(/\/$/, "");
const API_PREFIX = __ENV.API_PREFIX || "/api/v1";

export const options = {
  scenarios: {
    probe_300: { executor: "constant-vus", vus: 300, duration: "30s", exec: "healthFlow" },
    probe_600: { executor: "constant-vus", vus: 600, duration: "30s", startTime: "35s", exec: "healthFlow" },
    probe_900: { executor: "constant-vus", vus: 900, duration: "30s", startTime: "70s", exec: "healthFlow" },
    probe_1200: { executor: "constant-vus", vus: 1200, duration: "30s", startTime: "105s", exec: "healthFlow" },
    probe_1500: { executor: "constant-vus", vus: 1500, duration: "30s", startTime: "140s", exec: "healthFlow" },
    probe_1800: { executor: "constant-vus", vus: 1800, duration: "30s", startTime: "175s", exec: "healthFlow" },
    probe_2200: { executor: "constant-vus", vus: 2200, duration: "30s", startTime: "210s", exec: "healthFlow" },
  },
  thresholds: {
    "http_req_failed{scenario:probe_300}": ["rate<0.02"],
    "http_req_failed{scenario:probe_600}": ["rate<0.02"],
    "http_req_failed{scenario:probe_900}": ["rate<0.02"],
    "http_req_failed{scenario:probe_1200}": ["rate<0.02"],
    "http_req_failed{scenario:probe_1500}": ["rate<0.02"],
    "http_req_failed{scenario:probe_1800}": ["rate<0.02"],
    "http_req_failed{scenario:probe_2200}": ["rate<0.02"],
  },
};

export function healthFlow() {
  const r1 = http.get(`${BASE_URL}/health`, { timeout: "5s" });
  check(r1, { "h1 200": (r) => r.status === 200 });
  const r2 = http.get(`${BASE_URL}${API_PREFIX}/health`, { timeout: "5s" });
  check(r2, { "h2 200": (r) => r.status === 200 });
  const r3 = http.get(`${BASE_URL}${API_PREFIX}/system/health/simple`, { timeout: "5s" });
  check(r3, { "h3 200": (r) => r.status === 200 });
  sleep(0.2);
}
