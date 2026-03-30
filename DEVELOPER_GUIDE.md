# Developer Guide — Job Application Buddy

A detailed technical reference for developers working on the **Personal Job Application Assistant** codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Repository Structure](#3-repository-structure)
4. [Getting Started (Local Development)](#4-getting-started-local-development)
5. [Configuration](#5-configuration)
6. [Architecture Deep Dive](#6-architecture-deep-dive)
   - 6.1 [Domain Layer](#61-domain-layer)
   - 6.2 [Services Layer](#62-services-layer)
   - 6.3 [Adapters Layer](#63-adapters-layer)
   - 6.4 [Request Lifecycle](#64-request-lifecycle)
7. [API Reference](#7-api-reference)
8. [Data Flow Walkthrough](#8-data-flow-walkthrough)
9. [Testing](#9-testing)
10. [Linting & Building](#10-linting--building)
11. [Adding a New Job Source](#11-adding-a-new-job-source)
12. [Switching to a Real Database (Prisma)](#12-switching-to-a-real-database-prisma)
13. [File Storage](#13-file-storage)
14. [Playwright / Browser Automation](#14-playwright--browser-automation)
15. [Future Work & Roadmap](#15-future-work--roadmap)
16. [Contribution Guidelines](#16-contribution-guidelines)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Project Overview

**Job Application Buddy** is an agent-driven backend system that:

- Ingests a user's resume and job preferences.
- Discovers tech/software job listings from multiple external sources.
- Scores and ranks listings against the user's profile.
- Generates a tailored application plan (cover letter draft, question answers).
- Submits the approved application automatically through Playwright browser automation.
- Records every submission in an application log.

The system is designed around a **single-user model** — one human uses it for their own job search — with an explicit approval gate before any application is submitted.

---

## 2. Prerequisites

| Tool | Minimum Version | Notes |
|------|-----------------|-------|
| [Node.js](https://nodejs.org/) | 20 LTS | 18 LTS also works |
| [npm](https://www.npmjs.com/) | 9+ | Bundled with Node.js |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Installed as a dev dependency |
| [Git](https://git-scm.com/) | Any | |
| [PostgreSQL](https://www.postgresql.org/) | 15+ | Optional — in-memory mode requires no database |

Playwright downloads its own browser binaries; you do **not** need a separate Chrome install.

---

## 3. Repository Structure

```
job_application_buddy/
├── .env.example               # Environment variable template
├── .eslintrc.json             # ESLint configuration
├── .gitignore
├── DEVELOPER_GUIDE.md         # This file
├── README.md                  # High-level overview
├── package.json
├── tsconfig.json
└── src/
    ├── app.ts                 # Entry point — bootstraps the HTTP server
    ├── config/
    │   └── index.ts           # Reads and exports all env-driven config
    ├── domain/                # Pure TypeScript interfaces (no logic)
    │   ├── application.ts
    │   ├── job.ts
    │   └── userProfile.ts
    ├── services/              # Business logic — framework-agnostic
    │   ├── applicationOrchestrator.ts
    │   ├── matchingService.ts
    │   ├── profileService.ts
    │   ├── formFiller/
    │   │   ├── index.ts       # High-level submit API
    │   │   └── playwrightClient.ts
    │   └── jobDiscoveryService/
    │       ├── index.ts       # Aggregates & de-duplicates sources
    │       └── sources/
    │           ├── indeedSource.ts
    │           ├── linkedinSource.ts
    │           └── genericRssSource.ts
    ├── adapters/
    │   ├── http/
    │   │   ├── server.ts      # Express app setup + error handler
    │   │   └── routes/
    │   │       ├── applicationRoutes.ts
    │   │       ├── jobRoutes.ts
    │   │       └── profileRoutes.ts
    │   ├── persistence/
    │   │   ├── applicationRepo.ts   # In-memory store
    │   │   ├── jobRepo.ts           # In-memory store
    │   │   ├── prismaClient.ts      # Prisma singleton (commented out until needed)
    │   │   └── userRepo.ts          # In-memory store
    │   └── storage/
    │       └── fileStorage.ts       # Local disk file I/O
    └── __tests__/
        ├── applicationRepo.test.ts
        ├── jobDiscoveryService.test.ts
        ├── matchingService.test.ts
        └── userRepo.test.ts
```

---

## 4. Getting Started (Local Development)

### Step 1 — Clone and install

```bash
git clone https://github.com/monicarivera-work/job_application_buddy.git
cd job_application_buddy
npm install
```

### Step 2 — Create your local environment file

```bash
cp .env.example .env
```

Edit `.env` and adjust as needed. For a quick smoke test, the defaults work as-is (in-memory mode, port 4000).

### Step 3 — Start the development server

```bash
npm run dev
```

You should see:

```
Job assistant API running on port 4000
```

### Step 4 — Verify the server is healthy

```bash
curl http://localhost:4000/health
# → {"status":"ok"}
```

### Step 5 — Try the API

Create a profile:

```bash
curl -X POST http://localhost:4000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-1",
    "name": "Jane Dev",
    "email": "jane@example.com",
    "resumeText": "5 years TypeScript, Node.js, React, AWS",
    "preferences": {
      "desiredTitles": ["Senior Software Engineer"],
      "locations": ["San Francisco, CA"],
      "remoteOnly": false,
      "mustHaveTech": ["TypeScript", "Node.js"]
    }
  }'
```

Discover and rank jobs:

```bash
curl "http://localhost:4000/api/jobs?userId=user-1"
```

Build an application plan:

```bash
curl -X POST http://localhost:4000/api/applications/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "job": {
      "title": "Senior Software Engineer",
      "company": "Example Corp",
      "location": "Remote",
      "description": "Build great things",
      "requiredSkills": ["TypeScript", "Node.js"],
      "applyUrl": "https://example.com/jobs/1",
      "source": "linkedin",
      "matchScore": 90,
      "missingRequirements": []
    }
  }'
```

---

## 5. Configuration

All configuration is read from environment variables via `src/config/index.ts`. The `dotenv` package loads them from `.env` at startup.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Port the HTTP server listens on |
| `DATABASE_URL` | `postgres://localhost/job_assistant` | PostgreSQL connection string (unused in in-memory mode) |
| `HEADLESS` | `true` | Set to `false` to watch Playwright open a real browser window (useful for debugging automation scripts) |
| `OPENAI_API_KEY` | *(unset)* | API key for LLM-powered cover letter generation (not yet integrated) |
| `REDIS_URL` | *(unset)* | Redis connection for background job queues (not yet integrated) |
| `UPLOAD_DIR` | `<cwd>/uploads` | Directory where uploaded files are stored on disk |

> **Note:** Never commit a `.env` file. It is already listed in `.gitignore`.

---

## 6. Architecture Deep Dive

The codebase follows a lightweight **ports-and-adapters (hexagonal) architecture**:

```
┌─────────────────────────────────────────────────┐
│               HTTP Adapter (Express)            │
│   routes/profileRoutes  jobRoutes  appRoutes    │
└───────────────────┬─────────────────────────────┘
                    │ calls
┌───────────────────▼─────────────────────────────┐
│               Services (business logic)         │
│  profileService  matchingService  orchestrator  │
│  jobDiscoveryService  formFiller                │
└───────────────────┬─────────────────────────────┘
                    │ reads/writes
┌───────────────────▼─────────────────────────────┐
│               Persistence Adapters              │
│   userRepo   jobRepo   applicationRepo          │
│   fileStorage                                   │
└─────────────────────────────────────────────────┘
```

This layering ensures:
- Routes never talk directly to the database.
- Services never import Express types.
- Domain models are plain TypeScript interfaces.

### 6.1 Domain Layer

Located in `src/domain/`. These files contain **only TypeScript interfaces** — no class methods, no database calls, no framework imports.

| File | Key Types |
|------|-----------|
| `userProfile.ts` | `UserProfile`, `UserPreferences` |
| `job.ts` | `JobMetadata`, `MatchedJob` |
| `application.ts` | `ApplicationRecord`, `ApplicationStatus` |

Because these are pure interfaces, they can be safely imported anywhere in the codebase (services, adapters, tests) without introducing circular dependencies.

### 6.2 Services Layer

Located in `src/services/`. Each service contains one clear responsibility.

#### `profileService.ts`

A thin wrapper around `userRepo` that exposes `upsertProfile` and `getProfile`. Keeping this wrapper means the route layer never imports the repo directly, making it easy to add caching or authorization logic later.

#### `matchingService.ts`

**Scoring algorithm** (pure functions — no I/O, no side effects):

```
matchScore = (skillScore × 0.70) + (remoteScore × 0.30)
```

- **Skill score** (`0.0–1.0`): fraction of a job's `requiredSkills` that appear (case-insensitive substring match) in the user's `mustHaveTech` list. Defaults to `0.5` when the job has no required skills.
- **Remote score** (`0.0–1.0`): `1.0` when the user wants remote-only and the job location contains the word "remote"; `0.0` when the user wants remote-only but the location is not remote; `0.5` when the user has no remote preference.

The final `matchScore` is an integer from `0` to `100`.

`rankJobs` applies `scoreJob` to every job and returns them sorted highest-score-first.

#### `jobDiscoveryService/index.ts`

Fans out to all configured source adapters (`searchLinkedIn`, `searchIndeed`) concurrently using `Promise.all`, then de-duplicates the combined list by `applyUrl`.

To add a new source, see [Section 11](#11-adding-a-new-job-source).

#### `applicationOrchestrator.ts`

Manages the two-step application workflow:

1. **`buildApplicationPlan`** — constructs a draft plan (cover letter, answers, special requirements) without any side effects. The LLM integration hook is marked `TODO` here.
2. **`submitApprovedApplication`** — calls `formFiller.submitApplication` (Playwright), then records the submission via `applicationRepo.logSubmission`.

#### `formFiller/index.ts` + `playwrightClient.ts`

`formFiller` translates an `ApplicationPlan` into a series of browser actions. `playwrightClient` is a thin lifecycle wrapper that launches a Chromium instance, creates a context, runs the callback, and tears down cleanly.

To add automation for a specific ATS (Greenhouse, Lever, Workday, etc.), add a site-specific module under `src/services/formFiller/sites/` and dispatch to it from `formFiller/index.ts` based on the `applyUrl` domain.

### 6.3 Adapters Layer

#### Persistence (`src/adapters/persistence/`)

All three repositories (`userRepo`, `jobRepo`, `applicationRepo`) use a plain `Map` as the backing store. This means:

- Zero external dependencies for local development.
- Data is lost when the process restarts.
- Drop-in replacement for a real database — see [Section 12](#12-switching-to-a-real-database-prisma).

#### HTTP (`src/adapters/http/`)

`server.ts` sets up the Express application, mounts routes, registers the health-check endpoint, and adds a **global error-handling middleware** that converts unhandled `Error` objects into a structured `500` JSON response. This prevents uncaught async errors from silently crashing route handlers.

#### Storage (`src/adapters/storage/fileStorage.ts`)

Provides `save`, `read`, and `delete` operations on the local filesystem. Filenames are sanitized (alphanumeric + `._-`) to block path-traversal attacks. In production, replace the `fs.promises` calls with calls to S3, GCS, or Azure Blob Storage.

### 6.4 Request Lifecycle

Here is how a `POST /api/applications/plan` request flows through the system:

```
Client
  │
  ▼
Express router (applicationRoutes.ts)
  │  validates userId + job fields
  ▼
profileService.getProfile(userId)           → userRepo (in-memory Map)
  │
  ▼
applicationOrchestrator.buildApplicationPlan(profile, job)
  │  builds coverLetterDraft, answers, specialRequirements
  ▼
HTTP 200 JSON response → Client
```

A `POST /api/applications/submit` additionally triggers:

```
applicationOrchestrator.submitApprovedApplication(profile, plan, files)
  │
  ├─► formFiller.submitApplication(...)
  │     └─► playwrightClient.run(async page => { ... })
  │             launches Chromium, navigates to applyUrl
  │
  └─► applicationRepo.logSubmission(record)
            stores in in-memory Map
```

---

## 7. API Reference

### Authentication

There is currently no authentication layer. All endpoints are open. A JWT-based auth layer is planned in the [Basic UI and Infrastructure PR](https://github.com/monicarivera-work/job_application_buddy/pull/2).

### Profile

#### `POST /api/profile`

Create or update a user profile.

**Request body:**

```json
{
  "id": "string (required, non-empty)",
  "name": "string (required, non-empty)",
  "email": "string (required, non-empty)",
  "phone": "string (optional)",
  "resumeText": "string (required)",
  "preferences": {
    "desiredTitles": ["string"],
    "locations": ["string"],
    "remoteOnly": true,
    "minSalary": 100000,
    "maxSalary": 200000,
    "mustHaveTech": ["TypeScript", "Node.js"],
    "avoidCompanies": ["Megacorp"]
  }
}
```

**Responses:**

| Status | Body |
|--------|------|
| `201` | The saved `UserProfile` object |
| `400` | `{ "error": "id, name, and email are required and must be non-empty" }` |

---

#### `GET /api/profile/:id`

Retrieve a profile by its ID.

**Responses:**

| Status | Body |
|--------|------|
| `200` | The `UserProfile` object |
| `404` | `{ "error": "Profile not found" }` |

---

### Jobs

#### `GET /api/jobs?userId=<id>`

Discover and rank jobs for a user. Calls all job sources concurrently, de-duplicates results, and returns them sorted by `matchScore` (descending).

**Query parameters:**

| Name | Required | Description |
|------|----------|-------------|
| `userId` | ✅ | ID of an existing profile |

**Responses:**

| Status | Body |
|--------|------|
| `200` | Array of `MatchedJob` objects |
| `400` | `{ "error": "userId query parameter is required" }` |
| `404` | `{ "error": "Profile not found" }` |

---

### Applications

#### `POST /api/applications/plan`

Build a draft application plan without submitting anything.

**Request body:**

```json
{
  "userId": "string",
  "job": {
    "title": "string",
    "company": "string",
    "location": "string",
    "description": "string",
    "requiredSkills": ["string"],
    "applyUrl": "string",
    "source": "string",
    "matchScore": 85,
    "missingRequirements": []
  }
}
```

**Responses:**

| Status | Body |
|--------|------|
| `200` | `ApplicationPlan` — `{ job, coverLetterDraft, answers, specialRequirements }` |
| `400` | Validation error |
| `404` | `{ "error": "Profile not found" }` |

---

#### `POST /api/applications/submit`

Submit an approved plan using Playwright automation.

> ⚠️ This endpoint launches a real browser. Playwright browser binaries must be installed (see [Section 4](#4-getting-started-local-development)). The site-specific automation selectors are stubs — you must implement them before submissions will work end-to-end.

**Request body:**

```json
{
  "userId": "string",
  "plan": { /* ApplicationPlan from /plan */ },
  "files": {
    "resume": "/absolute/path/to/resume.pdf"
  }
}
```

**Responses:**

| Status | Body |
|--------|------|
| `200` | `{ "message": "Application submitted successfully" }` |
| `400` | Validation error |
| `404` | `{ "error": "Profile not found" }` |
| `500` | `{ "error": "Internal server error", "message": "..." }` |

---

#### `GET /api/applications?userId=<id>`

List all application records for a user.

**Responses:**

| Status | Body |
|--------|------|
| `200` | Array of `ApplicationRecord` objects |
| `400` | `{ "error": "userId query parameter is required" }` |

---

#### `PATCH /api/applications/:id/status`

Update the status of an existing application record.

**Request body:**

```json
{
  "status": "pending | submitted | rejected | interview | offer | withdrawn",
  "notes": "optional string"
}
```

**Responses:**

| Status | Body |
|--------|------|
| `200` | Updated `ApplicationRecord` |
| `400` | `{ "error": "status is required" }` |
| `404` | `{ "error": "Application not found" }` |

---

### Health

#### `GET /health`

Returns `200 { "status": "ok" }` when the server is running. Use this as a liveness probe.

---

## 8. Data Flow Walkthrough

This section walks through the complete happy path from zero to a submitted application.

```
① POST /api/profile
   └── profileService.upsertProfile()
       └── userRepo.upsert()   → stored in Map

② GET /api/jobs?userId=user-1
   └── discoverJobsForProfile()
       ├── searchLinkedIn()   → stub → 1 job
       └── searchIndeed()     → stub → 1 job
           de-duplicate by applyUrl  → 2 unique jobs
   └── rankJobs()
       └── scoreJob() × 2     → sort descending

③ POST /api/applications/plan
   └── applicationOrchestrator.buildApplicationPlan()
       └── returns coverLetterDraft + empty answers + empty specialRequirements
           (LLM integration TODO)

④ User reviews the plan in the UI, edits answers if needed, then clicks "Submit"

⑤ POST /api/applications/submit
   └── applicationOrchestrator.submitApprovedApplication()
       ├── formFiller.submitApplication()
       │   └── playwrightClient.run()
       │       └── page.goto(applyUrl)  + site-specific selectors (TODO)
       └── applicationRepo.logSubmission()
           └── stored in Map with UUID + status "submitted"

⑥ GET /api/applications?userId=user-1
   └── applicationRepo.listByUser()   → returns all records for user
```

---

## 9. Testing

Tests are located in `src/__tests__/` and run with [Jest](https://jestjs.io/) + [ts-jest](https://kulshekhar.github.io/ts-jest/).

### Running tests

```bash
# Run all tests once
npm test

# Watch mode — re-run on file save
npx jest --watch

# Run a specific test file
npx jest matchingService

# With coverage report
npx jest --coverage
```

### Test overview

| File | What it covers |
|------|----------------|
| `matchingService.test.ts` | Skill scoring, remote scoring, ranking order, edge cases (no required skills, etc.) |
| `userRepo.test.ts` | Upsert, findById, list, delete, overwrite behaviour |
| `applicationRepo.test.ts` | logSubmission (UUID assigned), findById, listByUser, updateStatus, null returns |
| `jobDiscoveryService.test.ts` | Returns jobs, no duplicate `applyUrl`s, required fields present |

### Writing new tests

Follow the existing pattern:

```typescript
// src/__tests__/myService.test.ts
import { myFunction } from '../services/myService';

describe('myFunction', () => {
  it('does the thing', () => {
    const result = myFunction(input);
    expect(result).toEqual(expected);
  });
});
```

- Keep each test file focused on a single module.
- Because the repositories use in-memory Maps, tests are fully isolated — no mocking or database setup required.
- For services that call external APIs (e.g., real LinkedIn), mock the network layer with `jest.mock`.

---

## 10. Linting & Building

### Lint

```bash
npm run lint
```

ESLint is configured in `.eslintrc.json` using the `@typescript-eslint` plugin. Key rules:
- `@typescript-eslint/no-unused-vars` — error (prefix with `_` to suppress for intentionally unused params)
- `@typescript-eslint/no-explicit-any` — warning

### Build (TypeScript → JavaScript)

```bash
npm run build
```

Compiled output goes to `dist/`. The `tsconfig.json` targets ES2020 CommonJS. The `dist/` folder is gitignored.

### Start the compiled build

```bash
npm start
# runs: node dist/app.js
```

Use `npm run dev` (`ts-node`) during development to skip the compile step.

---

## 11. Adding a New Job Source

1. **Create the source file:**

   ```
   src/services/jobDiscoveryService/sources/mySource.ts
   ```

   Export an async function that accepts a `UserProfile` and returns `JobMetadata[]`:

   ```typescript
   import { JobMetadata } from '../../../domain/job';
   import { UserProfile } from '../../../domain/userProfile';

   export async function searchMySource(profile: UserProfile): Promise<JobMetadata[]> {
     // fetch, parse, and normalize jobs here
     return [];
   }
   ```

2. **Register the source** in `src/services/jobDiscoveryService/index.ts`:

   ```typescript
   import { searchMySource } from './sources/mySource';

   const [linkedinJobs, indeedJobs, mySourceJobs] = await Promise.all([
     searchLinkedIn(profile),
     searchIndeed(profile),
     searchMySource(profile),
   ]);

   const all = [...linkedinJobs, ...indeedJobs, ...mySourceJobs];
   ```

3. **Add a test** in `src/__tests__/jobDiscoveryService.test.ts` to cover the new source.

---

## 12. Switching to a Real Database (Prisma)

The in-memory repos are intentional for local development — the server starts instantly with no external dependencies. When you're ready for persistence across restarts:

### Step 1 — Install Prisma

```bash
npm install @prisma/client
npm install --save-dev prisma
```

### Step 2 — Initialize Prisma

```bash
npx prisma init
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

### Step 3 — Define your schema

Edit `prisma/schema.prisma`. Example models matching the domain types:

```prisma
model UserProfile {
  id          String   @id
  name        String
  email       String   @unique
  phone       String?
  resumeText  String
  preferences Json
  createdAt   DateTime @default(now())
}

model ApplicationRecord {
  id         String   @id @default(uuid())
  userId     String
  jobTitle   String
  company    String
  applyUrl   String
  appliedAt  DateTime
  status     String
  notes      String?
}
```

### Step 4 — Run migrations

```bash
npx prisma migrate dev --name init
```

### Step 5 — Enable the Prisma client

Open `src/adapters/persistence/prismaClient.ts` and uncomment the `PrismaClient` import and singleton.

### Step 6 — Update the repositories

Replace `Map` operations with `prisma.<model>` calls. For example, in `userRepo.ts`:

```typescript
import { prisma } from './prismaClient';

export const userRepo = {
  async upsert(profile: UserProfile): Promise<UserProfile> {
    return prisma.userProfile.upsert({
      where: { id: profile.id },
      update: { ...profile },
      create: { ...profile },
    });
  },
  // ...
};
```

---

## 13. File Storage

`src/adapters/storage/fileStorage.ts` provides three operations:

| Method | Signature | Description |
|--------|-----------|-------------|
| `save` | `(filename, data: Buffer) → Promise<string>` | Writes `data` to `UPLOAD_DIR/<sanitizedFilename>`. Returns the absolute path. |
| `read` | `(filename) → Promise<Buffer>` | Reads and returns the file contents. |
| `delete` | `(filename) → Promise<void>` | Deletes the file from disk. |

### Security note

All filenames pass through `sanitizeFilename()` which strips any character that is not `[a-zA-Z0-9._-]`. This blocks path-traversal attacks such as `../../etc/passwd`. The `UPLOAD_DIR` itself should be outside the web root and should not be served statically.

### Production storage

Replace `fs.promises` calls with an SDK call to:
- **AWS S3**: use `@aws-sdk/client-s3`
- **Google Cloud Storage**: use `@google-cloud/storage`
- **Azure Blob Storage**: use `@azure/storage-blob`

The `save`/`read`/`delete` interface remains the same — only the adapter body changes.

---

## 14. Playwright / Browser Automation

`playwrightClient.ts` wraps Playwright's `chromium.launch`. It:
- Reads `HEADLESS` from config (default `true`).
- Creates a fresh browser context per invocation.
- Tears down context and browser in a `finally` block.

### Install browsers

```bash
npx playwright install chromium
```

You only need Chromium for this application.

### Debugging automation scripts

Set `HEADLESS=false` in `.env` to watch the browser open and interact with the page in real time. This is useful when writing site-specific selectors.

### Adding ATS automation

Each job portal (Greenhouse, Lever, Workday, etc.) requires its own selector logic. Suggested pattern:

1. Create `src/services/formFiller/sites/greenhouse.ts`
2. Export an async function `submitGreenhouse(page, params)` 
3. Detect the ATS from `applyUrl` domain in `formFiller/index.ts` and dispatch accordingly:

```typescript
const url = new URL(params.job.applyUrl);
if (url.hostname.includes('greenhouse.io')) {
  await submitGreenhouse(page, params);
} else if (url.hostname.includes('lever.co')) {
  await submitLever(page, params);
} else {
  // generic fallback
}
```

---

## 15. Future Work & Roadmap

These items are explicitly planned but not yet implemented.

### In progress (other branches/PRs)

| Feature | Branch | Status |
|---------|--------|--------|
| Basic UI (HTML/CSS/JS) + JWT auth + Docker + Terraform/AWS | `copilot/create-basic-ui-and-infrastructure` | In progress |

### Planned

- **LLM integration** (cover letter generation, Q&A answering)
  - Hook: `applicationOrchestrator.buildApplicationPlan` has a `TODO` comment.
  - Suggested: OpenAI chat completions API, key via `OPENAI_API_KEY`.
- **Background queue** (BullMQ + Redis)
  - Moves Playwright submissions off the HTTP request thread.
  - Config hook: `REDIS_URL` in `.env.example`.
- **Site-specific ATS automation** for Greenhouse, Lever, Workday, iCIMS.
- **React/Next.js frontend** with job review, approval flow, file upload, and application history.
- **Persistent storage** via Prisma + PostgreSQL (see [Section 12](#12-switching-to-a-real-database-prisma)).
- **Real job sources** — replace LinkedIn/Indeed stubs with API integrations or scraping strategies.
- **Resume parsing** — extract structured skills and experience from uploaded PDF/DOCX files.

---

## 16. Contribution Guidelines

### Branching

Use the naming convention:

```
<type>/<short-description>
```

Examples: `feat/add-lever-automation`, `fix/sanitize-filename`, `docs/update-api-reference`

### Commits

Write clear, imperative-mood commit messages:

```
Add Greenhouse ATS automation strategy
Fix path-traversal vulnerability in fileStorage
Update API reference for /api/applications/submit
```

### Code style

- Follow the existing patterns: functional modules, `export const serviceName = { ... }` objects.
- Run `npm run lint` and `npm run build` before opening a PR — both must pass with zero errors.
- Add or update tests for every behaviour change.
- Domain files (`src/domain/`) must remain pure interfaces.

### Pull Request checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes (all existing + new tests)
- [ ] No new secrets committed
- [ ] PR description explains what changed and why

---

## 17. Troubleshooting

### `jest: not found` when running `npm test`

Run `npm install` first. Jest is a dev dependency.

### `Port 4000 is already in use`

Another process is using port 4000. Either stop it or change `PORT` in your `.env` file.

### Playwright: `Failed to launch Chromium browser`

Run:

```bash
npx playwright install chromium
```

If you're inside Docker, ensure the image includes the necessary OS dependencies:

```dockerfile
RUN npx playwright install --with-deps chromium
```

### TypeScript build errors after adding a new file

Ensure your file is under `src/` (the `rootDir` in `tsconfig.json`). Check that you haven't accidentally used a Node.js built-in without the corresponding `@types/node` type import.

### ESLint: `Parsing error: "parserOptions.project" has been set`

If you add `parserOptions.project` to `.eslintrc.json` and see this error, make sure your new `.ts` file is included in `tsconfig.json`'s `include` glob.

### In-memory data is gone after restart

That is by design. See [Section 12](#12-switching-to-a-real-database-prisma) to add persistent storage.
