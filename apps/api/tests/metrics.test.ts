import { describe, expect, it } from 'vite-plus/test';
import {
  recordHttpRequest,
  renderPrometheusMetrics,
  resetHttpRequestMetrics,
} from '~/server/utils/metrics.ts';

describe('prometheus metrics', () => {
  it('renders counters and process gauges', () => {
    resetHttpRequestMetrics();
    recordHttpRequest('GET', '/api/v1/workspaces/ws_1/clients', 200, 12);
    recordHttpRequest('GET', '/api/v1/workspaces/ws_1/clients', 200, 8);
    recordHttpRequest('POST', '/api/v1/workspaces/ws_1/time-entries', 201, 40);
    const text = renderPrometheusMetrics();
    expect(text).toContain('stampp_http_requests_total');
    expect(text).toContain('route="/api/v1/workspaces/ws_1/clients"');
    expect(text).toContain('status="200"} 2');
    expect(text).toContain('stampp_process_uptime_seconds');
    expect(text).toContain('stampp_process_memory_bytes');
  });
});
