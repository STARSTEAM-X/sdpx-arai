import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
  });

  check(response, {
    'health responds 200': (res) => res.status === 200,
    'health reports ready': (res) => res.json('status') === 'ok',
  });
  sleep(1);
}