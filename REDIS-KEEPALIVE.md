# Redis Keep-Alive Setup

## Il Problema

Upstash nel piano gratuito elimina i database Redis dopo **28 giorni di inattività**. Per evitare questo, è necessario effettuare almeno **1 chiamata al giorno** al database.

## La Soluzione

È stato creato un endpoint `/api/health/redis` che:
- Effettua una semplice operazione di ping al database Redis
- Salva un timestamp dell'ultimo check
- Mantiene attivo il database

## Come Configurare il Cron Job

### Opzione 1: Cron Job Gratuito con EasyCron (Consigliato)

1. Vai su [https://www.easycron.com/](https://www.easycron.com/) (piano gratuito disponibile)
2. Registrati e crea un nuovo cron job
3. Configura:
   - **URL**: `https://alessandror.dk/api/health/redis`
   - **Frequenza**: Una volta al giorno (es. ogni giorno alle 12:00)
   - **Metodo**: GET

### Opzione 2: Cron-job.org

1. Vai su [https://cron-job.org/](https://cron-job.org/)
2. Crea un account gratuito
3. Crea un nuovo cron job:
   - **URL**: `https://alessandror.dk/api/health/redis`
   - **Schedule**: Daily at 12:00 (o qualsiasi ora tu preferisca)

### Opzione 3: UptimeRobot (Doppio beneficio)

1. Vai su [https://uptimerobot.com/](https://uptimerobot.com/)
2. Crea un monitor HTTP(s):
   - **URL**: `https://alessandror.dk/api/health/redis`
   - **Monitoring Interval**: 24 hours
   
**Bonus**: Oltre a mantenere attivo Redis, monitora anche l'uptime del tuo sito!

### Opzione 4: GitHub Actions (Se il tuo repo è pubblico)

Crea `.github/workflows/redis-keepalive.yml`:

```yaml
name: Redis Keep-Alive

on:
  schedule:
    # Runs every day at 12:00 UTC
    - cron: '0 12 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  ping-redis:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Redis endpoint
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://alessandror.dk/api/health/redis)
          echo "Response status: $response"
          if [ $response -eq 200 ]; then
            echo "✓ Redis is healthy"
          else
            echo "✗ Redis health check failed with status $response"
            exit 1
          fi
```

### Opzione 5: Cloudflare Workers (Se usi Cloudflare)

Dato che il tuo sito è su Cloudflare Pages, puoi usare Cron Triggers (piano Workers gratuito):

```javascript
export default {
  async scheduled(event, env, ctx) {
    await fetch('https://alessandror.dk/api/health/redis');
  },
};
```

In `wrangler.toml`:
```toml
[triggers]
crons = ["0 12 * * *"]
```

## Verifica Manuale

Puoi sempre verificare manualmente che l'endpoint funzioni visitando:
```
https://alessandror.dk/api/health/redis
```

Dovresti vedere una risposta JSON simile a:
```json
{
  "status": "healthy",
  "redis": "connected",
  "timestamp": "2026-05-09T10:30:00.000Z",
  "lastCheck": "2026-05-09T10:30:00.000Z",
  "message": "Redis database is active and responding"
}
```

## Alternative a Lungo Termine

Se il problema persiste o vuoi una soluzione più robusta, considera:

1. **Upgrade a Upstash Pro** (~$0.20 per 100k comandi, nessuna eliminazione)
2. **Migrare a SQLite locale** (usa `better-sqlite3` già presente nel progetto)
3. **Vercel KV** (se deployi su Vercel)
4. **Redis Labs** (piano gratuito con 30MB, nessuna eliminazione per inattività)

## Monitoraggio

Consiglio di impostare un alert (con UptimeRobot o simili) per ricevere notifiche se:
- L'endpoint `/api/health/redis` smette di rispondere
- Il database Redis viene eliminato

