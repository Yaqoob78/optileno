import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const API_PREFIX = __ENV.API_PREFIX || "/api/v1";

export const options = {
  scenarios: {
    quick_5k_probe: {
      executor: "ramping-vus",
      startVUs: 20,
      stages: [
        { duration: "30s", target: 500 },
        { duration: "30s", target: 1000 },
        { duration: "60s", target: 2500 },
        { duration: "90s", target: 5000 },
        { duration: "30s", target: 1000 },
        { duration: "20s", target: 100 },
      ],
      gracefulRampDown: "20s",
      exec: "healthFlow",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
    checks: ["rate>0.98"],
  },
};

export function healthFlow() {
  const res1 = http.get(`${BASE_URL}/health`, { timeout: "5s" });
  check(res1, { "app health status is 200": (r) => r.status === 200 });

  const res2 = http.get(`${BASE_URL}${API_PREFIX}/health`, { timeout: "5s" });
  check(res2, { "api health status is 200": (r) => r.status === 200 });

  const res3 = http.get(`${BASE_URL}${API_PREFIX}/system/health/simple`, { timeout: "5s" });
  check(res3, { "api simple health status is 200": (r) => r.status === 200 });

  sleep(0.2);
}
