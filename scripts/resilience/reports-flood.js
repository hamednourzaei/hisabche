import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 20,
  duration: '30s',
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const TOKEN = __ENV.AUTH_TOKEN || ''

export default function () {
  const res = http.get(`${BASE_URL}/api/system/metrics`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  check(res, { 'status is 200': (r) => r.status === 200 })
  sleep(0.1)
}
