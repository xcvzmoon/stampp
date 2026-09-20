type MetricBucket = {
  count: number;
  durationMsSum: number;
};

const buckets = new Map<string, MetricBucket>();
let processStartedAt = Date.now();

function bucketKey(method: string, route: string, status: number): string {
  return `${method}|${route}|${status}`;
}

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number,
): void {
  const key = bucketKey(method, route, status);
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.count += 1;
    bucket.durationMsSum += durationMs;
    return;
  }
  buckets.set(key, { count: 1, durationMsSum: durationMs });
}

export function resetHttpRequestMetrics(): void {
  buckets.clear();
  processStartedAt = Date.now();
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  lines.push('# HELP stampp_http_requests_total Total HTTP requests');
  lines.push('# TYPE stampp_http_requests_total counter');
  lines.push('# HELP stampp_http_request_duration_ms_sum Total request duration in milliseconds');
  lines.push('# TYPE stampp_http_request_duration_ms_sum counter');
  lines.push('# HELP stampp_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE stampp_process_uptime_seconds gauge');
  lines.push('# HELP stampp_process_memory_bytes Process resident set size');
  lines.push('# TYPE stampp_process_memory_bytes gauge');

  let totalRequests = 0;
  for (const [key, bucket] of [...buckets.entries()].toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const [method = 'unknown', route = 'unknown', statusText = '0'] = key.split('|');
    const status = Number(statusText) || 0;
    totalRequests += bucket.count;
    lines.push(
      `stampp_http_requests_total{method="${method}",route="${route}",status="${status}"} ${bucket.count}`,
    );
    lines.push(
      `stampp_http_request_duration_ms_sum{method="${method}",route="${route}",status="${status}"} ${bucket.durationMsSum}`,
    );
  }

  const uptime = Math.max(0, Math.round((Date.now() - processStartedAt) / 1000));
  lines.push(`stampp_http_requests_total{method="*",route="*",status="*"} ${totalRequests}`);
  lines.push(`stampp_process_uptime_seconds ${uptime}`);
  const memory = process?.memoryUsage?.().rss ?? 0;
  lines.push(`stampp_process_memory_bytes ${memory}`);
  return `${lines.join('\n')}\n`;
}
