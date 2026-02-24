# 🔒 SECURITY GUIDE - IMPORTANT!

## ⚠️ Sensitive Information to NEVER Commit

Your repository contains several API keys and secrets that should **NEVER** be committed to GitHub:

### 🚨 Critical Secrets (Currently in `.env`)

1. **WakaTime API Key**: `NUXT_WAKATIME_API_KEY`
   - Used to fetch your coding statistics
   - If exposed: Someone could read your WakaTime data or make API calls on your behalf
   - **Action if leaked**: Regenerate at https://wakatime.com/settings/api-key

2. **Upstash Redis Token**: `NUXT_UPSTASH_REDIS_REST_TOKEN`
   - Used to access your Redis database
   - If exposed: Someone could read/write/delete your cached data, potentially incurring costs
   - **Action if leaked**: Regenerate at https://console.upstash.com/

3. **Strava Client Secret**: `NUXT_STRAVA_CLIENT_SECRET`
   - OAuth credentials for Strava API
   - If exposed: Someone could impersonate your application
   - **Action if leaked**: Regenerate at https://www.strava.com/settings/api

4. **Strava Refresh Token**: `NUXT_STRAVA_REFRESH_TOKEN`
   - Used to access your Strava data
   - If exposed: Someone could access your Strava activities
   - **Action if leaked**: Revoke and regenerate at Strava settings

5. **GitHub API Key** (if you add one): `NUXT_GITHUB_API_KEY`
   - Personal access token
   - If exposed: Someone could access repositories and data on your behalf
   - **Action if leaked**: Revoke at https://github.com/settings/tokens

## ✅ Current Protection Status

### Protected (Good!)
- ✅ `.env` file is in `.gitignore`
- ✅ `.env` file has never been committed to Git
- ✅ No secrets are hardcoded in source files
- ✅ All secrets use environment variables via `useRuntimeConfig()`

### Public Information (Safe to Commit)
- ✅ `NUXT_GITHUB_USERNAME` - This is public anyway
- ✅ `NUXT_STRAVA_CLIENT_ID` - OAuth client IDs are meant to be public
- ✅ `NUXT_UPSTASH_REDIS_REST_URL` - The URL alone is not sensitive

## 📋 Checklist Before Pushing to GitHub

- [ ] Verify `.env` is in `.gitignore` ✅ (Already done)
- [ ] No API keys hardcoded in code ✅ (Already done)
- [ ] `.env.example` created with placeholder values ✅ (Already done)
- [ ] Secrets stored in environment variables only ✅ (Already done)
- [ ] No sensitive data in commit history ✅ (Already done)

## 🔧 What to Do If You Accidentally Commit Secrets

### If you haven't pushed yet:
```bash
# Remove the file from the last commit
git reset HEAD~1
# Or amend the commit
git commit --amend
```

### If you've already pushed:
1. **Immediately rotate all exposed secrets** (regenerate API keys)
2. Remove from Git history using BFG Repo-Cleaner or git-filter-repo
3. Force push the cleaned history
4. Consider the old secrets compromised permanently

## 🚀 Deployment Security

When deploying to production (Vercel, Netlify, etc.):

1. **Never include `.env` in deployments**
2. **Set environment variables in the hosting platform's dashboard**:
   - Vercel: Project Settings → Environment Variables
   - Netlify: Site Settings → Environment Variables
   - Railway: Project → Variables

3. **Use different secrets for development and production**

## 📝 Files That Should Be in `.gitignore`

Already configured:
```
.env
.env.*
!.env.example
.output
.nuxt
node_modules
.cache
```

## 🔍 Regular Security Checks

### Before Each Commit:
```bash
# Check if .env is accidentally staged
git status

# Search for potential secrets in staged files
git diff --cached | grep -i "api_key\|secret\|token\|password"
```

### Periodic Audits:
```bash
# Check entire codebase for potential secrets
git grep -i "api_key\|secret\|token\|password" -- '*.ts' '*.js' '*.vue'
```

## 🛡️ Additional Security Recommendations

### 1. Use GitHub Secret Scanning
- GitHub automatically scans for known secret patterns
- Enable "Push protection" in repository settings to block accidental commits

### 2. Limit API Key Permissions
- **GitHub PAT**: Use fine-grained tokens with minimum required scopes
- **WakaTime**: Regenerate keys regularly
- **Strava**: Use read-only scopes where possible

### 3. Rotate Secrets Regularly
- Change API keys every 3-6 months
- Immediately rotate if:
  - Employee/collaborator leaves
  - Suspicious activity detected
  - Keys potentially exposed

### 4. Monitor API Usage
- **Upstash**: Check usage dashboard for unexpected spikes
- **Strava**: Monitor API rate limits
- **GitHub**: Check API rate limit usage

### 5. Use Secret Management Tools (Advanced)
For production deployments:
- **Doppler**: Centralized secret management
- **AWS Secrets Manager**: For AWS deployments
- **Azure Key Vault**: For Azure deployments
- **HashiCorp Vault**: Self-hosted option

## 📚 Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP: Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Git Secret Scanning Tools](https://github.com/thoughtworks/talisman)

## 🎯 Summary

### Your Current Status: ✅ SECURE

You are currently following best practices:
1. All secrets in `.env` (ignored by Git)
2. No secrets in code or Git history
3. Using environment variables properly
4. `.env.example` provided for documentation

### Key Takeaway
**NEVER commit files containing**:
- API keys
- Tokens
- Passwords
- Database credentials
- OAuth secrets
- Private keys

Your repository is secure! Just maintain these practices going forward. 🔒

