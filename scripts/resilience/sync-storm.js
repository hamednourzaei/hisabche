import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 50,
  duration: '30s',
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const TOKEN = __ENV.AUTH_TOKEN || ''

export default function () {
  const res = http.post(
    `${BASE_URL}/api/sync/push`,
    JSON.stringify({ mutations: [] }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  )
  check(res, { 'status is 200 or 503': (r) => r.status === 200 || r.status === 503 })
  sleep(0.2)
}
