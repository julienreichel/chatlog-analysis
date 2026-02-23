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
│   │       └── key-utils.ts     # API key generation & HMAC hashing
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
  ├─ DynamoDB: chatlog-api-keys          (API key records)
  └─ DynamoDB: chatlog-analysis-requests (analysis call records)
```

### Authentication flows

| Route group | Protection | Token |
|---|---|---|
| `POST /api/v1/analysis/*` | `X-API-Key` header | HMAC-SHA-256 verified API key |
| `GET /api/v1/analysis/calls*` | `X-API-Key` header | Same |
| `GET/POST /api/v1/auth/api-keys*` | `Authorization: Bearer <jwt>` | Cognito ID Token |
| `GET /api/v1/internal/history*` | `Authorization: Bearer <jwt>` | Cognito ID Token |

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- AWS CLI configured (credentials with DynamoDB + Comprehend access)
- An Amazon Cognito User Pool (provisioned via `npx ampx sandbox` or deployment – see [Deploy](#deploy))

### Frontend (`app/`)

```bash
cd app
cp .env.example .env   # fill in values – see Environment Variables section
npm install
npm run dev            # starts Nuxt dev server at http://localhost:3000
```

### Backend (`amplify/`)

```bash
npm install -g @aws-amplify/backend-cli
cd amplify
npm install
npx ampx sandbox       # provisions Cognito + DynamoDB in your AWS account
```

The sandbox prints the Cognito User Pool ID and client ID; copy them to `app/.env`.

## Environment Variables

Create `app/.env` based on `app/.env.example`:

| Variable | Description |
|---|---|
| `AWS_REGION` | AWS region for DynamoDB and Comprehend (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | IAM access key (needs DynamoDB + Comprehend permissions) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `DYNAMO_TABLE_NAME` | DynamoDB table for API keys (default `chatlog-api-keys`) |
| `DYNAMO_ANALYSIS_TABLE_NAME` | DynamoDB table for analysis calls (default `chatlog-analysis-requests`) |
| `API_KEY_HMAC_SECRET` | ≥32 random bytes used to HMAC-sign API keys – **never commit this** |
| `NUXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID (e.g. `us-east-1_XXXXXXXXX`) |
| `NUXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID |
| `NUXT_PUBLIC_COGNITO_REGION` | AWS region of the Cognito User Pool |

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

### `chatlog-api-keys`

Single-table design with one item type.

| Attribute | Type | Description |
|---|---|---|
| `pk` | String | `"USER#<userId>"` |
| `sk` | String | `"KEY#<keyId>"` |
| `keyId` | String | UUID |
| `keyHash` | String | HMAC-SHA-256 hex digest of the plaintext key |
| `label` | String | Optional human-readable label |
| `createdAt` | String | ISO-8601 timestamp |
| `revokedAt` | String | ISO-8601 timestamp, present only when revoked |
| `lastUsedAt` | String | ISO-8601 timestamp of last successful authentication |

**GSI – `KeyHashIndex`**: `keyHash` (partition key) – used for O(1) key validation without table scans.

### `chatlog-analysis-requests`

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
- `chatlog-api-keys` DynamoDB table with `KeyHashIndex` GSI
- `chatlog-analysis-requests` DynamoDB table with `CallIdIndex` GSI
- Lambda health-check function

### 2. Configure environment variables

After provisioning, set the following on the Amplify Hosting environment (or in `app/.env` for local dev):

```
AWS_REGION=us-east-1
DYNAMO_TABLE_NAME=chatlog-api-keys
DYNAMO_ANALYSIS_TABLE_NAME=chatlog-analysis-requests
API_KEY_HMAC_SECRET=<strong-random-secret>
NUXT_PUBLIC_COGNITO_USER_POOL_ID=<from-amplify-output>
NUXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=<from-amplify-output>
NUXT_PUBLIC_COGNITO_REGION=us-east-1
```

### 3. IAM permissions for the Nuxt server

The Nuxt server process needs an IAM role/user with the following permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
    "dynamodb:Query"
  ],
  "Resource": [
    "arn:aws:dynamodb:<region>:<account>:table/chatlog-api-keys",
    "arn:aws:dynamodb:<region>:<account>:table/chatlog-api-keys/index/*",
    "arn:aws:dynamodb:<region>:<account>:table/chatlog-analysis-requests",
    "arn:aws:dynamodb:<region>:<account>:table/chatlog-analysis-requests/index/*"
  ]
},
{
  "Effect": "Allow",
  "Action": [
    "comprehend:DetectSentiment",
    "comprehend:DetectToxicContent"
  ],
  "Resource": "*"
}
```

### 4. Deploy the Nuxt app

```bash
cd app
npm run build
# Deploy the .output/ directory to Amplify Hosting or any Node.js host
```

See [Amplify Gen 2 docs](https://docs.amplify.aws/gen2/) for full deployment details.

