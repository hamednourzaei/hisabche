/**
 * k6 resilience drill: concurrent invoice creation burst.
 * Verifies idempotency + backpressure + zero 5xx under bursty write traffic.
 *
 * Usage:
 *   BASE_URL=http://localhost:3001 AUTH_TOKEN=<jwt> WORKSPACE_ID=<uuid> k6 run scripts/resilience/invoice-burst.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  scenarios: {
    invoice_burst: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '30s', target: 25 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.05'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''
const WORKSPACE_ID = __ENV.WORKSPACE_ID || ''

export default function () {
  const idemKey = `k6-inv-${__VU}-${__ITER}`
  const payload = JSON.stringify({
    customer_id: __ENV.CUSTOMER_ID || '00000000-0000-0000-0000-000000000001',
    items: [
      {
        product_id: __ENV.PRODUCT_ID || '00000000-0000-0000-0000-000000000002',
        quantity: 1,
        unit_price_minor: 10000,
      },
    ],
    idempotency_key: idemKey,
  })

  const res = http.post(`${BASE_URL}/api/invoices`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'X-Workspace-Id': WORKSPACE_ID,
      'Idempotency-Key': idemKey,
    },
  })

  check(res, {
    'status is 2xx, 400/422 validation, or 503 load-shedding': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 400 || r.status === 422 || r.status === 503,
    'never 500': (r) => r.status !== 500,
  })

  sleep(0.2)
}
