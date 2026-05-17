# alessandrorosa.com

My personal website hosted at [alessandrorosa.com](https://alessandrorosa.com)

## 🔧 Maintenance

### Redis Keep-Alive

The site uses Upstash Redis for caching. On the free tier, databases are deleted after 28 days of inactivity.

**To prevent this:**
- An endpoint `/api/health/redis` is available for health checks
- Set up a cron job to call this endpoint at least once per day
- See [REDIS-KEEPALIVE.md](./REDIS-KEEPALIVE.md) for setup instructions

**Test the endpoint:**
```powershell
# Local
.\test-redis-health.ps1

# Production
.\test-redis-health.ps1 -Production
```

