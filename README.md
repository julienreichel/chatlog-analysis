# chatlog-analysis

Monorepo for the LLM chat analysis platform. Contains a **Nuxt 4 + Nuxt UI** frontend (`app/`) and an **Amplify Gen 2** REST backend (`amplify/`).

## Repository Structure

```
chatlog-analysis/
├── app/          # Nuxt 4 + Nuxt UI frontend
└── amplify/      # Amplify Gen 2 Lambda backend
```

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- AWS CLI configured (for Amplify sandbox)

### Frontend (`app/`)

```bash
cd app
cp .env.example .env   # fill in values
npm install
npm run dev            # starts Nuxt dev server at http://localhost:3000
```

### Backend (`amplify/`)

```bash
npm install -g @aws-amplify/backend-cli
cd amplify
npm install
npx ampx sandbox       # starts local Amplify Gen 2 sandbox
```

The `/v1/health` endpoint will be available at the URL printed by `ampx sandbox`.

## Scripts

Run from the **repo root**:

| Command           | Description                                      |
|-------------------|--------------------------------------------------|
| `npm run dev`     | Start Nuxt frontend dev server                   |
| `npm run build`   | Build Nuxt frontend                              |
| `npm run test`    | Run all tests (app + amplify)                    |
| `npm run typecheck` | Typecheck all packages                         |
| `npm run lint`    | Lint all packages                                |

Or run from within each package directory individually.

## REST API

| Method | Path         | Response                           |
|--------|--------------|------------------------------------|
| GET    | `/v1/health` | `{ "ok": true, "version": "..." }` |

## Deploy

The Amplify Gen 2 backend deploys automatically via the Amplify CI/CD pipeline on push to `main`. The Nuxt frontend can be deployed to Amplify Hosting:

```bash
# Deploy backend + frontend via Amplify console
# or via CLI:
npx ampx pipeline-deploy --branch main --app-id <YOUR_APP_ID>
```

See [Amplify Gen 2 docs](https://docs.amplify.aws/gen2/) for full deployment details.
