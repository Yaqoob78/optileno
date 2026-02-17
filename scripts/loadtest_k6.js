import http from "k6/http";
import { check, sleep } from "k6";

// Usage:
// k6 run -e BASE_URL=https://your-domain.com scripts/loadtest_k6.js
const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const API_PREFIX = __ENV.API_PREFIX || "/api/v1";

export const options = {
  scenarios: {
    health_readiness_ramp: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { duration: "2m", target: 500 },
        { duration: "3m", target: 1000 },
        { duration: "5m", target: 2500 },
        { duration: "5m", target: 5000 },
        { duration: "3m", target: 1000 },
        { duration: "2m", target: 100 },
      ],
      gracefulRampDown: "30s",
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
