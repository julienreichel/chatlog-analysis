# chatlog-analysis

Monorepo for the LLM chat analysis platform. Contains a **Nuxt 4 + Nuxt UI** frontend (`app/`) and an **Amplify Gen 2** infrastructure backend (`amplify/`).

## Overview

This platform lets users:

1. **Sign in** with their email via Amazon Cognito.
2. **Generate API keys** from the dashboard and use them to call the analysis REST endpoints.
3. **Analyse LLM conversations** – every message in a discussion is run through Amazon Comprehend:
   - `POST /api/v1/analysis/sentiment` → per-message sentiment + aggregated summary
   - `POST /api/v1/analysis/toxicity` → per-message toxicity scores + aggregated summary
4. **Browse history** – every call is persisted to DynamoDB; users can review all past calls and their results from the dashboard.

## Repository Structure

```
chatlog-analysis/
├── app/                         # Nuxt 4 + Nuxt UI frontend + server API routes
│   ├── pages/
│   │   ├── login.vue            # Cognito sign-in page
│   │   ├── index.vue            # Authenticated home / dashboard
│   │   ├── history/
│   │   │   ├── index.vue        # Analysis call history table
│   │   │   └── [requestId].vue  # Per-call detail with per-message results
│   │   └── settings/
│   │       └── api-keys.vue     # Generate / revoke API keys
│   ├── server/
│   │   ├── api/v1/
│   │   │   ├── analysis/        # Sentiment & toxicity REST endpoints (X-API-Key)
│   │   │   ├── auth/api-keys/   # API key CRUD (Cognito JWT)
│   │   │   └── internal/history/# History endpoints for the dashboard (Cognito JWT)
│   │   ├── middleware/
│   │   │   └── api-key-auth.ts  # X-API-Key validation middleware
│   │   └── utils/
│   │       ├── cognito-auth.ts  # Cognito JWT verification helper
│   │       ├── comprehendClient.ts # AWS Comprehend wrappers
│   │       ├── dynamodb.ts      # DynamoDB data-access layer
│   │       └── key-utils.ts     # API key generation & SHA-256 hashing
│   ├── composables/             # useAuth, useApiKeys, useHistory
│   ├── middleware/auth.ts       # Client-side route guard
│   └── plugins/amplify.client.ts# AWS Amplify initialisation
└── amplify/                     # Amplify Gen 2 infrastructure definition
    ├── auth/resource.ts         # Cognito User Pool (email/password)
    ├── backend.ts               # DynamoDB tables, IAM policies, Cognito
    └── functions/api/           # Lambda health-check endpoint
```

## Architecture

```
Browser (Nuxt SPA)
  │  Cognito sign-in (Amplify Auth JS)
  │
  ▼
Nuxt Server (API routes)
  ├─ POST /api/v1/analysis/sentiment  ──► Amazon Comprehend DetectSentiment
  ├─ POST /api/v1/analysis/toxicity   ──► Amazon Comprehend DetectToxicContent
  ├─ GET  /api/v1/analysis/calls      ──► DynamoDB (AnalysisRequests table)
  ├─ GET  /api/v1/auth/api-keys       ──► DynamoDB (ApiKeys table)
  ├─ POST /api/v1/auth/api-keys       ──► DynamoDB (ApiKeys table)
  └─ POST /api/v1/auth/api-keys/:id/revoke

AWS Amplify Gen 2 (infrastructure)
  ├─ Cognito User Pool  (email / password)
  ├─ DynamoDB: amplify-<app>-<env>-...-ApiKeysTable...          (API key records)
  └─ DynamoDB: amplify-<app>-<env>-...-AnalysisRequestsTable... (analysis call records)
```

### Authentication flows

| Route group | Protection | Token |
|---|---|---|
| `POST /api/v1/analysis/*` | `X-API-Key` header | SHA-256 verified API key |
| `GET /api/v1/analysis/calls*` | `X-API-Key` header | Same |
| `GET/POST /api/v1/auth/api-keys*` | `Authorization: Bearer <jwt>` | Cognito ID Token |
| `GET /api/v1/internal/history*` | `Authorization: Bearer <jwt>` | Cognito ID Token |

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- AWS CLI configured (credentials with DynamoDB + Comprehend access)
- An Amazon Cognito User Pool (provisioned via `npx ampx sandbox` or deployment – see [Deploy](#deploy))

### Backend (`amplify/`)

```bash
npm install -g @aws-amplify/backend-cli
cd amplify
npm install
npx ampx sandbox       # provisions Cognito + DynamoDB in your AWS account
```

The sandbox auto-generates `amplify_outputs.json` at the repo root.  This file contains the Cognito settings **and the DynamoDB table names** that were created for this environment.  The app reads it automatically – no manual environment variable entry is needed for table names.

### Frontend (`app/`)

```bash
cd app
cp .env.example .env   # fill in AWS credentials
npm install
npm run dev            # starts Nuxt dev server at http://localhost:3000
```

## Environment Variables

Create `app/.env` based on `app/.env.example`:

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | Optional. IAM access key for local dev / non-role runtime. |
| `AWS_SECRET_ACCESS_KEY` | Optional. IAM secret key for local dev / non-role runtime. |

> **AWS region** is read automatically from `amplify_outputs.json` (`auth.aws_region`).  You do not need to set `AWS_REGION` manually.
>
> **DynamoDB table names** are read automatically from `amplify_outputs.json` (`custom.dynamoTableName` and `custom.dynamoAnalysisTableName`).  You no longer need to set `DYNAMO_TABLE_NAME` or `DYNAMO_ANALYSIS_TABLE_NAME` manually.  Each Amplify environment (sandbox, production branch, etc.) gets its own uniquely-named tables, eliminating the risk of accidental cross-environment data access.
>
> If you need to override the table names (e.g. when pointing to pre-existing tables without Amplify), set `DYNAMO_TABLE_NAME` and `DYNAMO_ANALYSIS_TABLE_NAME` in `app/.env`.
>
> **Cognito settings** (`user_pool_id`, `user_pool_client_id`, `aws_region`) are likewise read automatically from `amplify_outputs.json`.  You only need to set them manually if you are not using Amplify to provision your Cognito User Pool.
>
> **Amplify CI simplification:** for deployed environments, prefer attaching permissions to the Amplify Hosting compute/service role instead of creating a dedicated IAM user with long-lived access keys.

## REST API

All analysis endpoints accept and return `application/json`.

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/v1/health` | None | `{ "ok": true, "version": "…" }` |

### Analysis endpoints

Both endpoints are protected with an `X-API-Key` header containing a valid, non-revoked API key.

#### `POST /api/v1/analysis/sentiment`

Runs Amazon Comprehend `DetectSentiment` on every message and returns per-message results plus an aggregated summary.

**Request body**

```json
{
  "messages": [
    { "role": "user",      "content": "I love this product!", "timestamp": "2025-01-01T10:00:00Z" },
    { "role": "assistant", "content": "Thank you for the feedback." }
  ],
  "conversationId": "conv-123",   // optional
  "languageCode": "en",           // optional, default "en"
  "model": "gpt-4",               // optional metadata
  "channel": "web-chat",          // optional metadata
  "tags": ["support"]             // optional metadata
}
```

**Response**

```json
{
  "requestId": "uuid",
  "callId": "uuid",
  "endpointType": "sentiment",
  "createdAt": "2025-01-01T10:00:00.000Z",
  "durationMs": 210,
  "messages": [
    {
      "index": 0,
      "role": "user",
      "contentLength": 22,
      "sentiment": "POSITIVE",
      "scores": { "POSITIVE": 0.99, "NEGATIVE": 0.01, "NEUTRAL": 0.00, "MIXED": 0.00 }
    }
  ],
  "summary": {
    "dominant": "POSITIVE",
    "counts": { "POSITIVE": 1, "NEGATIVE": 0, "NEUTRAL": 1, "MIXED": 0 },
    "avgScores": { "POSITIVE": 0.55, "NEGATIVE": 0.02, "NEUTRAL": 0.42, "MIXED": 0.01 }
  }
}
```

#### `POST /api/v1/analysis/toxicity`

Runs Amazon Comprehend `DetectToxicContent` on every message (batched in groups of 10) and returns per-message toxicity scores plus an aggregated summary.

**Request body** – same shape as sentiment (no `languageCode` field; Comprehend toxicity only supports English).

**Response**

```json
{
  "requestId": "uuid",
  "callId": "uuid",
  "endpointType": "toxicity",
  "createdAt": "2025-01-01T10:00:00.000Z",
  "durationMs": 185,
  "messages": [
    {
      "index": 0,
      "role": "user",
      "contentLength": 18,
      "toxicity": {
        "toxicity": 0.03,
        "labels": [
          { "name": "PROFANITY",          "score": 0.01 },
          { "name": "HATE_SPEECH",        "score": 0.00 },
          { "name": "INSULT",             "score": 0.02 },
          { "name": "GRAPHIC",            "score": 0.00 },
          { "name": "HARASSMENT_OR_ABUSE","score": 0.01 },
          { "name": "SEXUAL",             "score": 0.00 },
          { "name": "VIOLENCE_OR_THREAT", "score": 0.00 }
        ]
      }
    }
  ],
  "summary": {
    "maxToxicity": 0.03,
    "avgToxicity": 0.02,
    "countAbove50": 0,
    "countAbove80": 0
  }
}
```

### API key management (requires Cognito JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/auth/api-keys` | List all API keys for the signed-in user |
| `POST` | `/api/v1/auth/api-keys` | Create a new API key (plaintext returned once only) |
| `POST` | `/api/v1/auth/api-keys/:keyId/revoke` | Revoke a key immediately |

#### Create API key response

```json
{
  "key": "otk_live_<base64url>",
  "keyId": "uuid",
  "createdAt": "2025-01-01T10:00:00.000Z",
  "isActive": true
}
```

> **Important:** the plaintext `key` value is returned exactly once and is never stored. Copy it immediately.

### History endpoints (requires Cognito JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/internal/history?limit=50` | List the user's past analysis calls (newest first) |
| `GET` | `/api/v1/internal/history/:requestId` | Full detail of a single call including all results |

### Analysis call history via API key

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analysis/calls?limit=50` | List calls for the key owner |
| `GET` | `/api/v1/analysis/calls/:callId` | Full detail of a single call |

## DynamoDB Table Schemas

### ApiKeysTable

Single-table design with one item type.  The physical table name is auto-generated by CDK under an Amplify-prefixed name (e.g. `amplify-chatloganalysismonorepo-julienreichel-sandbox-...-ApiKeysTable...`) and published to `amplify_outputs.json` under `custom.dynamoTableName`.

| Attribute | Type | Description |
|---|---|---|
| `pk` | String | `"USER#<userId>"` |
| `sk` | String | `"KEY#<keyId>"` |
| `keyId` | String | UUID |
| `keyHash` | String | SHA-256 hex digest of the plaintext key |
| `label` | String | Optional human-readable label |
| `createdAt` | String | ISO-8601 timestamp |
| `revokedAt` | String | ISO-8601 timestamp, present only when revoked |
| `lastUsedAt` | String | ISO-8601 timestamp of last successful authentication |

**GSI – `KeyHashIndex`**: `keyHash` (partition key) – used for O(1) key validation without table scans.

### AnalysisRequestsTable

The physical table name is auto-generated by CDK under an Amplify-prefixed name (e.g. `amplify-chatloganalysismonorepo-julienreichel-sandbox-...-AnalysisRequestsTable...`) and published to `amplify_outputs.json` under `custom.dynamoAnalysisTableName`.

| Attribute | Type | Description |
|---|---|---|
| `pk` | String | `"USER#<userId>"` |
| `sk` | String | `"CALL#<ISO-timestamp>#<callId>"` (enables newest-first sort) |
| `callId` | String | UUID |
| `userId` | String | Cognito `sub` |
| `createdAt` | String | ISO-8601 timestamp |
| `type` | String | `"sentiment"` or `"toxicity"` |
| `messages` | List | Array of `{ role, content, timestamp? }` objects |
| `results` | Map | Full Comprehend results |
| `conversationId` | String | Optional caller-supplied conversation identifier |
| `metadata` | Map | Optional `{ model?, channel?, tags? }` |

**GSI – `CallIdIndex`**: `callId` (partition key) – used for O(1) single-call lookup.

## Scripts

Run from the **repo root**:

| Command | Description |
|---|---|
| `npm run dev` | Start Nuxt frontend dev server |
| `npm run build` | Build Nuxt frontend |
| `npm run aws:policy` | Print IAM policy JSON with resolved table ARNs |
| `npm run aws:ci-check` | In CI, print required IAM policy when static AWS keys are missing |
| `npm run aws:create-local-user` | Create/update local-dev IAM user, attach inline policy, write keys to `app/.env` |
| `npm run api:test -- --api-key <key>` | Send sample analysis request to `/api/v1/analysis/sentiment` |
| `npm run test` | Run all tests (app + amplify) |
| `npm run typecheck` | Typecheck all packages |
| `npm run lint` | Lint all packages |

Or run from within each package directory individually.

## Deploy

### 1. Provision infrastructure

```bash
cd amplify
npm install
npx ampx pipeline-deploy --branch main --app-id <YOUR_APP_ID>
```

This creates:
- Cognito User Pool + App Client
- Two DynamoDB tables (names are auto-generated per environment) with their GSIs:
  - `ApiKeysTable` (with `KeyHashIndex` GSI)
  - `AnalysisRequestsTable` (with `CallIdIndex` GSI)
- Lambda health-check function
- `amplify_outputs.json` containing all resource names (including table names)

### 2. Configure environment variables

Set the following for the Nuxt app runtime:
- Amplify Hosting compute/service role (recommended for deployed app), or
- `app/.env` with AWS access keys (local dev or non-role runtime).

```
(no additional variables required)
```

> **AWS region, DynamoDB table names, and Cognito settings are all set automatically** from `amplify_outputs.json` written by `npx ampx pipeline-deploy`. No manual entry is required for any of these.

### 3. IAM permissions for the Nuxt server

The Nuxt server process needs DynamoDB + Comprehend permissions. You can now generate the exact policy from the current environment (including real table names from `amplify_outputs.json`):

```bash
npm run aws:policy
```

In Amplify CI, the build runs `npm run aws:ci-check`; if `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are not set, it prints the required policy in the deployment logs.

For local dev key-based flow:

```bash
npm run aws:create-local-user
```

This creates/updates an IAM user, attaches an inline policy scoped to:
- `custom.dynamoTableName`
- `custom.dynamoAnalysisTableName`
- their secondary indexes (`/index/*`)
- `comprehend:DetectSentiment`
- `comprehend:DetectToxicContent`

### 4. Deploy the Nuxt app

```bash
cd app
npm run build
# Deploy the .output/ directory to Amplify Hosting or any Node.js host
```

See [Amplify Gen 2 docs](https://docs.amplify.aws/gen2/) for full deployment details.

## Quick API Smoke Test

Use the included helper script to send sample data with your API key.

### Local Nuxt dev server

```bash
npm run api:test -- --api-key <YOUR_API_KEY>
```

### Deployed environment

```bash
npm run api:test -- --api-key <YOUR_API_KEY> --base-url https://<your-domain>
```

### Toxicity endpoint

```bash
npm run api:test -- --api-key <YOUR_API_KEY> --type toxicity
```

### Custom payload

```bash
npm run api:test -- --api-key <YOUR_API_KEY> --payload ./path/to/payload.json
```

Payload shape:

```json
{
  "conversationId": "sample-001",
  "model": "gpt-4",
  "channel": "script-test",
  "tags": ["sample"],
  "messages": [
    { "role": "user", "content": "Message 1" },
    { "role": "assistant", "content": "Message 2" }
  ]
}
```
