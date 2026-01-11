# Monitoring & Observability Setup

**Status**: ✅ Integrated  
**Last Updated**: January 10, 2026

## Overview

The auth service includes comprehensive monitoring and observability using:

1. **Sentry** - Error tracking and performance monitoring
2. **Cloudflare Analytics** - Built-in request metrics and logs
3. **Structured Logging** - JSON-formatted logs for easy parsing

## Sentry Integration

### Setup

1. **Create Sentry Project**
   ```bash
   # Go to https://sentry.io
   # Create new project > Cloudflare Workers
   # Copy the DSN
   ```

2. **Add DSN to Pulumi ESC**
   ```bash
   # Open ESC environment
   pulumi env open loganpowell/cf-auth/dev
   
   # Add Sentry DSN secret
   ```

   ```yaml
   # In ESC environment
   values:
     secrets:
       sentryDsn:
         fn::secret: "https://xxx@xxx.ingest.sentry.io/xxx"
     
     environmentVariables:
       SENTRY_DSN: ${secrets.sentryDsn}
   ```

3. **Deploy to Worker**
   ```bash
   # Set secret via wrangler
   wrangler secret put SENTRY_DSN
   # Or deploy with ESC:
   pulumi env run loganpowell/cf-auth/dev -- wrangler deploy
   ```

### Features

**Automatic Error Capture:**
- All unhandled exceptions
- Request errors (4xx, 5xx)
- Middleware errors

**Context Enrichment:**
- Request method and path
- HTTP headers (sanitized)
- Tenant ID (if available)
- User ID (if authenticated)
- Request duration

**Performance Monitoring:**
- Request duration tracking
- Slow query detection
- Endpoint performance metrics

## Cloudflare Analytics

### Built-in Metrics

Cloudflare automatically tracks:
- Request count
- Response status codes
- Request duration (p50, p95, p99)
- Bandwidth usage
- Geographic distribution

### Access Analytics

**Via Dashboard:**
```
https://dash.cloudflare.com/
→ Workers & Pages
→ auth-service
→ Metrics tab
```

**Via GraphQL API:**
```graphql
query {
  viewer {
    accounts(filter: {accountTag: "YOUR_ACCOUNT_ID"}) {
      workersInvocationsAdaptive(
        filter: {
          scriptName: "auth-service"
          datetime_geq: "2026-01-01T00:00:00Z"
          datetime_lt: "2026-01-11T00:00:00Z"
        }
        limit: 1000
      ) {
        sum {
          requests
          errors
          subrequests
        }
      }
    }
  }
}
```

### Custom Analytics

Add custom data points using Analytics Engine:

```typescript
// In worker code
ctx.waitUntil(
  env.ANALYTICS.writeDataPoint({
    blobs: [tenantId, endpoint, userId],
    doubles: [responseTime, dataSize],
    indexes: [timestamp, statusCode]
  })
);
```

## Structured Logging

### Log Format

All logs follow structured JSON format:

```json
{
  "type": "request",
  "method": "POST",
  "path": "/auth/login",
  "status": 200,
  "duration": 45,
  "tenantId": "tenant:acme-corp",
  "userId": "user:alice",
  "timestamp": "2026-01-10T22:15:30.123Z"
}
```

### Log Levels

- **INFO**: Successful requests (2xx, 3xx)
- **WARN**: Client errors (4xx)
- **ERROR**: Server errors (5xx), exceptions

### Accessing Logs

**Real-time via wrangler:**
```bash
wrangler tail auth-service --format=pretty
```

**Historical via Logpush:**
```bash
# Set up Logpush to S3, R2, or external service
wrangler logpush create \
  --name auth-service-logs \
  --destination s3://your-bucket/logs
```

## Monitoring Dashboard

### Recommended Dashboards

1. **Sentry Performance Dashboard**
   - Transaction rates
   - Error rates
   - p95 response times
   - Apdex score

2. **Cloudflare Workers Dashboard**
   - Request volume
   - CPU time
   - Memory usage
   - Error rates by status code

3. **Custom Dashboard** (Grafana/Datadog)
   - Tenant-specific metrics
   - Authentication success/failure rates
   - DO connection count
   - R2 operations

## Alerts

### Sentry Alerts

Configure in Sentry dashboard:
- Error rate exceeds 1%
- Response time p95 > 1000ms
- New error types detected

### Cloudflare Alerts

Configure in Cloudflare dashboard:
- Worker errors > 100/minute
- Response time > 500ms (p95)
- Request volume spike (>200% of baseline)

### Custom Alerts

Use Sentry webhooks or Cloudflare notifications:

```typescript
// In worker - send custom alert
if (errorRate > 0.05) {
  await fetch("https://hooks.slack.com/services/YOUR/WEBHOOK", {
    method: "POST",
    body: JSON.stringify({
      text: `⚠️ High error rate: ${(errorRate * 100).toFixed(2)}%`
    })
  });
}
```

## Debugging

### Reproduce Issues

1. **From Sentry:**
   - Click error in Sentry dashboard
   - View full stack trace
   - See request context (headers, params)
   - Replay user session (if enabled)

2. **From Logs:**
   ```bash
   # Tail logs and filter for errors
   wrangler tail auth-service | grep ERROR
   
   # Search historical logs
   wrangler logpush jobs list
   ```

3. **Local Testing:**
   ```bash
   # Run with Sentry in dev mode
   SENTRY_DSN=your-dsn wrangler dev
   
   # Test error capture
   curl -X POST http://localhost:8787/trigger-error
   ```

## Performance Optimization

### Identify Slow Endpoints

1. Check Sentry Performance tab
2. Sort by p95 duration
3. Investigate slow queries/operations

### Common Optimizations

- Cache frequent D1 queries in KV
- Use Durable Objects for hot data
- Batch R2 operations
- Enable HTTP/2 caching headers

## Cost Management

### Sentry

- **Free tier**: 5,000 errors/month
- **Team**: $26/month - 50,000 errors
- **Business**: $80/month - 250,000 errors

### Cloudflare Analytics

- **Included** in Workers plan
- **Analytics Engine**: $0.05 per million writes

### Recommendations

- Start with Sentry free tier
- Enable Analytics Engine only for critical metrics
- Use sampling for high-volume endpoints

## Next Steps

- [ ] Set up Sentry project and configure DSN
- [ ] Create monitoring dashboard
- [ ] Configure error alerts
- [ ] Set up log aggregation (optional)
- [ ] Enable Analytics Engine for custom metrics (optional)
- [ ] Document runbook for common issues

## Resources

- [Sentry for Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)
- [Cloudflare Analytics](https://developers.cloudflare.com/analytics/)
- [Workers Logpush](https://developers.cloudflare.com/logs/get-started/enable-destinations/r2/)
- [Grafana Cloud Integration](https://grafana.com/grafana/plugins/grafana-simple-json-datasource/)
