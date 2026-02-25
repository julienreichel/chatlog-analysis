# Copilot Instructions

## Project Overview

This is a monorepo for a LLM chat analysis platform. It exposes REST endpoints that run Amazon Comprehend sentiment and toxicity analysis on LLM conversation messages, persists results to DynamoDB, and provides a Nuxt 4 dashboard for browsing history and managing API keys.

## Repository Structure

```
chatlog-analysis/
├── app/           # Nuxt 4 + Nuxt UI frontend and server-side API routes
├── amplify/       # Amplify Gen 2 infrastructure (Cognito, DynamoDB, Lambda)
└── scripts/       # Helper scripts for IAM, local dev, and smoke testing
```

## Tech Stack

- **Frontend / Server**: [Nuxt 4](https://nuxt.com/) with [Nuxt UI](https://ui.nuxt.com/) (Vue 3 + TypeScript)
- **Infrastructure**: AWS Amplify Gen 2 (Cognito, DynamoDB, Lambda)
- **AWS SDKs**: `@aws-sdk/client-comprehend`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
- **Auth**: Amazon Cognito (JWT via `jose`) for dashboard routes; SHA-256 hashed API keys for analysis endpoints
- **Testing**: [Vitest](https://vitest.dev/) (`tests/**/*.test.ts` in both `app/` and `amplify/`)
- **Linting**: ESLint via `@nuxt/eslint`
- **Node.js**: 20+, npm 10+

## Development Workflow

All commands are run from the **repo root** unless stated otherwise.

```bash
npm ci                        # install all workspace dependencies
npx nuxt prepare --cwd app    # generate Nuxt type stubs (required before typecheck/lint)
npm run dev                   # start Nuxt dev server at http://localhost:3000
npm run lint                  # lint app/ and amplify/
npm run typecheck             # typecheck app/ and amplify/
npm test                      # run all tests (app/ + amplify/)
npm run build                 # build Nuxt app
```

Individual workspace commands can also be run from within `app/` or `amplify/` directly.

## Key Conventions

- **API routes** live in `app/server/api/v1/`. Analysis endpoints use `X-API-Key` auth; dashboard/internal endpoints use `Authorization: Bearer <CognitoIdToken>`.
- **DynamoDB table names** are read at runtime from `amplify_outputs.json` (`custom.dynamoTableName` and `custom.dynamoAnalysisTableName`). Do not hardcode table names.
- **AWS region and Cognito settings** are also sourced from `amplify_outputs.json` automatically.
- **API keys** are stored as SHA-256 hex digests; plaintext is returned to the user exactly once and never stored.
- Utility helpers live in `app/server/utils/` (DynamoDB client, Cognito JWT verification, Comprehend wrappers, key hashing).
- Client-side composables are in `app/composables/` (`useAuth`, `useApiKeys`, `useHistory`).
- Tests use Vitest and are located in `tests/` within each workspace package.
