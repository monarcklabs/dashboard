# Cloudflare Security Checklist

Use these settings when the customer-facing dashboard is served behind Cloudflare.

## 1. Turnstile

- Create a dedicated Turnstile widget for login.
- Add the apex domain or each distinct root hostname you serve in Turnstile Hostname Management. `monarck.ai` covers subdomains such as `app.monarck.ai`, and Cloudflare does not use wildcard hostname entries.
- In this app, set:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET_KEY`
  - `TURNSTILE_ALLOWED_HOSTNAMES`

## 2. WAF Managed Rules

- Enable the Cloudflare Managed Ruleset.
- Enable the Cloudflare OWASP Core Ruleset.
- Review Security Events for false positives before tightening exceptions.

## 3. Login Rate Limiting

Start with two rules on `POST /api/auth/preflight`.

### Rule A: Managed Challenge burst traffic

- Expression:

```text
http.request.method eq "POST" and http.request.uri.path eq "/api/auth/preflight"
```

- Threshold: 10 requests per minute per IP.
- Action: Managed Challenge.

### Rule B: Block repeated abuse

- Expression:

```text
http.request.method eq "POST" and http.request.uri.path eq "/api/auth/preflight"
```

- Threshold: 30 requests per 10 minutes per IP.
- Action: Block for 1 hour.

Tune the thresholds from real traffic and failed-login volume. If you have large NATed customer networks, increase the thresholds before enforcing a hard block.

## 4. Monitoring

- Watch Security Events for `POST /api/auth/preflight`.
- Watch Turnstile Analytics for solve rate, invalid tokens, and hostname mismatches.
- If you have Bot Management, review bot score data before adding custom bot rules.
