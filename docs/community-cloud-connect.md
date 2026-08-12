# Connect your self-hosted instance to Nodaro Cloud

> **Rollout-gated.** The cloud side of this feature is enabled by the
> `COMMUNITY_CONNECT_ENABLED` flag on Nodaro Cloud — availability may lag
> this document.

Self-hosted community instances can connect to Nodaro Cloud and use it as a
**provider in your provider list** — the same way you'd connect ElevenLabs
or KIE. You keep your own provider keys for anything you already run
locally; the Nodaro connection adds:

- **One-click start, no credit card.** Connecting signs you into (or
  creates) a Nodaro Cloud account. New accounts receive the standard
  one-time 1,500-credit signup grant. Free-account outputs are
  watermarked; the first credit purchase lifts the watermark and unlocks
  every model. Connected-instance usage has **no daily spending cap**.
- **Standard models without wrangling keys** — image and video generation
  route through your Nodaro balance.
- **Nodaro-exclusive capabilities** — cloud-only models run through the
  connection and bill only that usage.

## How to connect

1. In your instance: **Integrations → Nodaro Cloud → Connect**.
2. Your browser opens the Nodaro Cloud consent screen — sign in (or sign
   up) and approve. The instance registers itself with its own OAuth
   credential; the requested scopes are exactly what generation needs
   (`assets:write workflows:execute jobs:read credits:read`).
3. You land back on your instance with the connection active. The card
   shows your live cloud balance. Generation through the Nodaro provider
   takes effect after the next instance restart.

The instance's credential is stored server-side only — it never reaches
your browser.

## Managing connected instances (cloud side)

On app.nodaro.ai → Billing → **Connected Instances**, the account owner
sees every connected instance with its spend this month, and can:

- set a **monthly spend cap** per instance (auto-saved; the instance gets
  `402 instance_cap_reached` past it), and
- **Disconnect** an instance — its tokens die immediately.

## Configuration reference

| Where | Variable | Meaning |
|---|---|---|
| Instance | `NODARO_CLOUD_URL` | Cloud host to connect to (default `https://app.nodaro.ai`) |
| Instance | `PUBLIC_URL` | Your instance's public URL — used for the OAuth callback |
| Cloud | `COMMUNITY_CONNECT_ENABLED` | Master flag for instance registrations + the Connected Instances surface |

Disconnecting from the instance only forgets the local credential; revoke
from the cloud's Connected Instances page to kill access outright.
