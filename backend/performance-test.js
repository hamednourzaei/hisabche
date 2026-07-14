import http from 'k6/http' 
import { check, sleep } from 'k6' 
 
export const options = { 
  stages: [ 
    { duration: '30s', target: 10 }, 
    { duration: '1m', target: 50 }, 
    { duration: '30s', target: 0 }, 
  ], 
} 
 
const BASE = 'https://hisabche.onrender.com' 
 
export default function () { 
  http.get(`${BASE}/api/health`) 
  sleep(1) 
} 
