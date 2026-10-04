import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const ACCESS_TOKEN = __ENV.PERF_ACCESS_TOKEN || '';
const errors = new Rate('journey_errors');
const assignmentListLatency = new Trend('assignment_list_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    journey_errors: ['rate<0.05'],
    assignment_list_latency: ['p(95)<500'],
    'http_req_duration{name:classrooms}': ['p(95)<500'],
  },
};

const requestParams = {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
};

export default function () {
  group('Browse classrooms and assignments', () => {
    const classroomsResponse = http.get(`${BASE_URL}/api/classrooms`, {
      ...requestParams,
      tags: { name: 'classrooms' },
    });
    const classroomsOk = check(classroomsResponse, {
      'classroom list responds 200': (res) => res.status === 200,
      'classroom list has items': (res) => {
        const items = res.json('items');
        return Array.isArray(items) && items.length > 0;
      },
    });
    errors.add(!classroomsOk);

    const classrooms = classroomsResponse.json('items') || [];
    if (!Array.isArray(classrooms) || classrooms.length === 0) {
      sleep(1);
      return;
    }

    sleep(1);
    const classroomId = classrooms[0].id;
    const assignmentsResponse = http.get(
      `${BASE_URL}/api/classrooms/${encodeURIComponent(classroomId)}/assignments`,
      { ...requestParams, tags: { name: 'assignments' } },
    );
    const assignmentsOk = check(assignmentsResponse, {
      'assignment list responds 200': (res) => res.status === 200,
      'assignment list has items array': (res) =>
        Array.isArray(res.json('items')),
    });
    errors.add(!assignmentsOk);
    assignmentListLatency.add(assignmentsResponse.timings.duration);
    sleep(2);
  });
}