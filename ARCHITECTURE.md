# Architecture & Developer Guide — Job Application Buddy

> A comprehensive reference for the structure, design decisions, data models, and day-to-day development workflows of the **Job Application Buddy** project.

---

## Table of Contents

1. [Project Purpose](#1-project-purpose)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Directory Structure](#4-directory-structure)
5. [Domain Models](#5-domain-models)
6. [Service Layer](#6-service-layer)
   - 6.1 [Profile Service](#61-profile-service)
   - 6.2 [Job Discovery Service](#62-job-discovery-service)
   - 6.3 [Matching & Ranking Engine](#63-matching--ranking-engine)
   - 6.4 [Application Orchestrator](#64-application-orchestrator)
   - 6.5 [Form Filler & Browser Automation](#65-form-filler--browser-automation)
7. [HTTP Adapter (REST API)](#7-http-adapter-rest-api)
   - 7.1 [Server Setup](#71-server-setup)
   - 7.2 [API Endpoints](#72-api-endpoints)
   - 7.3 [Error Handling & Validation](#73-error-handling--validation)
8. [Persistence Layer](#8-persistence-layer)
9. [Storage Adapter](#9-storage-adapter)
10. [Frontend (Single-Page Application)](#10-frontend-single-page-application)
11. [Configuration & Environment Variables](#11-configuration--environment-variables)
12. [End-to-End Application Workflow](#12-end-to-end-application-workflow)
13. [Job Matching Algorithm](#13-job-matching-algorithm)
14. [Testing Strategy](#14-testing-strategy)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Local Development Guide](#16-local-development-guide)
17. [Future Roadmap](#17-future-roadmap)

---

## 1. Project Purpose

**Job Application Buddy** is an agent-driven system that automates the repetitive parts of a software-engineering job search while keeping the human firmly in control of every submission. It:

| Capability | Description |
|---|---|
| **Discovers** jobs | Aggregates postings from LinkedIn, Indeed, and arbitrary RSS feeds |
| **Ranks** jobs | Scores each posting against the user's skills and preferences |
| **Generates plans** | Drafts a tailored cover letter, question answers, and a checklist of special requirements |
| **Automates submission** | Uses Playwright-driven browser automation to fill and submit application forms |
| **Tracks history** | Logs every submitted application and lets the user update its status |

A human approval step is required before any form is submitted, so the user always reviews the generated plan before the browser automation starts.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                  │
│              public/index.html  (Vanilla SPA)        │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / REST
┌───────────────────────▼─────────────────────────────┐
│               Express HTTP Server                    │
│  src/adapters/http/server.ts                         │
│  ├── /api/profile     (profileRoutes.ts)             │
│  ├── /api/jobs        (jobRoutes.ts)                 │
│  ├── /api/applications(applicationRoutes.ts)         │
│  └── /health                                         │
└──────┬──────────────────────────────────────────────┘
       │ calls
┌──────▼──────────────────────────────────────────────┐
│                   Service Layer                      │
│  profileService  jobDiscoveryService  matchingService│
│  applicationOrchestrator  formFiller                 │
└──────┬──────────────────────────────────────────────┘
       │ reads/writes
┌──────▼──────────────────────────────────────────────┐
│              Adapters / Infrastructure               │
│  persistence/  (in-memory Maps, optional Prisma)     │
│  storage/      (local filesystem uploads)            │
└─────────────────────────────────────────────────────┘
```

The application follows a **Ports & Adapters** (hexagonal) pattern:

- **Domain** (`src/domain/`) contains pure TypeScript interfaces with no dependencies.
- **Services** (`src/services/`) contain business logic that depends only on domain types and abstract ports.
- **Adapters** (`src/adapters/`) contain all infrastructure code (HTTP, databases, file system, browser).

This separation makes it easy to swap the in-memory persistence for a real database, or replace the vanilla HTML frontend, without touching any business logic.

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript 5.x | Strict mode enabled |
| Runtime | Node.js 24.x | LTS |
| Web framework | Express 4.x | Lightweight REST API |
| Browser automation | Playwright 1.x | Chromium headless by default |
| Testing | Jest + ts-jest | Unit tests only |
| Linting | ESLint + @typescript-eslint | Enforces TS-specific rules |
| Build | `tsc` | Outputs to `dist/` |
| Database (optional) | PostgreSQL via Prisma | In-memory Maps used by default |
| CI/CD | GitHub Actions | Deploys to Azure Web App |
| Containerisation | Docker (planned) | Not yet in repo |

---

## 4. Directory Structure

```
job_application_buddy/
├── .env.example                   # Template for required environment variables
├── .github/
│   └── workflows/
│       ├── main_automaticapplications.yml   # Auto-application workflow
│       └── main_jobapplicationbuddy.yml     # Azure Web App deployment
├── .gitignore
├── README.md                      # Quick-start guide
├── ARCHITECTURE.md                # This document
├── package.json
├── package-lock.json
├── tsconfig.json
├── public/
│   └── index.html                 # Single-page frontend (vanilla HTML/CSS/JS)
└── src/
    ├── app.ts                     # Entry point — imports server.ts
    ├── config/
    │   └── index.ts               # Reads .env and exports typed config object
    ├── domain/                    # Pure TypeScript interfaces (no imports from src/)
    │   ├── userProfile.ts         # UserProfile, UserPreferences
    │   ├── job.ts                 # JobMetadata, MatchedJob
    │   └── application.ts        # ApplicationRecord, ApplicationStatus
    ├── services/
    │   ├── profileService.ts      # CRUD wrapper around userRepo
    │   ├── matchingService.ts     # scoreJob(), rankJobs()
    │   ├── applicationOrchestrator.ts  # Plan building + form submission trigger
    │   ├── jobDiscoveryService/
    │   │   ├── index.ts           # Orchestrates all sources, de-duplicates
    │   │   └── sources/
    │   │       ├── linkedinSource.ts   # LinkedIn search stub
    │   │       ├── indeedSource.ts     # Indeed search stub
    │   │       └── genericRssSource.ts # Generic RSS/Atom parser
    │   └── formFiller/
    │       ├── index.ts           # High-level submitApplication()
    │       └── playwrightClient.ts# Low-level browser session management
    ├── adapters/
    │   ├── http/
    │   │   ├── server.ts          # Express app wiring + static file serving
    │   │   └── routes/
    │   │       ├── profileRoutes.ts
    │   │       ├── jobRoutes.ts
    │   │       └── applicationRoutes.ts
    │   ├── persistence/
    │   │   ├── userRepo.ts        # In-memory Map store for UserProfile
    │   │   ├── jobRepo.ts         # In-memory Map store for JobMetadata
    │   │   ├── applicationRepo.ts # In-memory Map store for ApplicationRecord
    │   │   └── prismaClient.ts    # PrismaClient singleton (optional DB path)
    │   └── storage/
    │       └── fileStorage.ts     # Local filesystem adapter for resume uploads
    └── __tests__/
        ├── matchingService.test.ts
        ├── userRepo.test.ts
        ├── jobDiscoveryService.test.ts
        └── applicationRepo.test.ts
```

---

## 5. Domain Models

All domain types live in `src/domain/` and are plain TypeScript interfaces. They carry no runtime logic and have zero external dependencies.

### `UserPreferences` (`domain/userProfile.ts`)

```typescript
interface UserPreferences {
  desiredTitles:   string[];    // e.g. ["Software Engineer", "Backend Engineer"]
  locations:       string[];    // e.g. ["Austin, TX", "Remote"]
  remoteOnly:      boolean;     // If true, non-remote jobs score 0 on the location axis
  minSalary?:      number;      // Annual, in the user's local currency
  maxSalary?:      number;
  mustHaveTech?:   string[];    // Skills that MUST appear in requiredSkills
  avoidCompanies?: string[];    // Companies to exclude from results
}
```

### `UserProfile` (`domain/userProfile.ts`)

```typescript
interface UserProfile {
  id:          string;           // Caller-supplied UUID or slug
  name:        string;
  email:       string;
  phone?:      string;
  resumeText:  string;           // Full plain-text resume
  preferences: UserPreferences;
}
```

### `JobMetadata` (`domain/job.ts`)

```typescript
interface JobMetadata {
  title:           string;
  company:         string;
  location:        string;       // e.g. "Remote" or "New York, NY"
  salaryRange?:    { min?: number; max?: number; currency?: string };
  benefits?:       string[];
  description:     string;
  requiredSkills:  string[];
  preferredSkills?: string[];
  applyUrl:        string;       // Used as a de-duplication key
  source:          string;       // "linkedin" | "indeed" | "rss"
}
```

### `MatchedJob` (`domain/job.ts`)

Extends `JobMetadata` with scoring output:

```typescript
interface MatchedJob extends JobMetadata {
  matchScore:           number;    // 0–100
  missingRequirements:  string[];  // requiredSkills not found in mustHaveTech
}
```

### `ApplicationRecord` (`domain/application.ts`)

```typescript
type ApplicationStatus =
  | 'pending' | 'submitted' | 'rejected'
  | 'interview' | 'offer' | 'withdrawn';

interface ApplicationRecord {
  id?:        string;            // UUID assigned on creation
  userId:     string;
  jobTitle:   string;
  company:    string;
  applyUrl:   string;
  appliedAt:  Date;
  status:     ApplicationStatus;
  notes?:     string;
}
```

---

## 6. Service Layer

### 6.1 Profile Service

**File:** `src/services/profileService.ts`

A thin facade over `userRepo` that exposes only the operations the HTTP layer needs.

| Method | Signature | Description |
|---|---|---|
| `upsertProfile` | `(profile: UserProfile) => Promise<UserProfile>` | Create or fully replace a profile |
| `getProfile` | `(userId: string) => Promise<UserProfile \| null>` | Fetch by ID; returns `null` if not found |

---

### 6.2 Job Discovery Service

**File:** `src/services/jobDiscoveryService/index.ts`

Orchestrates three job sources in parallel and returns a de-duplicated list:

```
discoverJobsForProfile(profile)
  ├── searchLinkedIn(profile)   → JobMetadata[]
  ├── searchIndeed(profile)     → JobMetadata[]
  └── (RSS feeds via genericRssSource)
```

De-duplication uses `applyUrl` as the unique key. If two sources return the same job URL, only the first occurrence is kept.

#### Sources

| Source | File | Status |
|---|---|---|
| LinkedIn | `sources/linkedinSource.ts` | Stub — returns mock data |
| Indeed | `sources/indeedSource.ts` | Stub — returns mock data |
| Generic RSS | `sources/genericRssSource.ts` | Parses real RSS/Atom feeds |

The LinkedIn and Indeed sources are stubs because both platforms prohibit scraping via their ToS. They exist as integration points for future implementations that use official APIs or authorised third-party services.

---

### 6.3 Matching & Ranking Engine

**File:** `src/services/matchingService.ts`

Two exported functions:

| Function | Description |
|---|---|
| `scoreJob(profile, job)` | Returns a `MatchedJob` with a 0–100 `matchScore` |
| `rankJobs(profile, jobs)` | Maps `scoreJob` over an array and sorts descending by score |

See [Section 13](#13-job-matching-algorithm) for the full scoring formula.

---

### 6.4 Application Orchestrator

**File:** `src/services/applicationOrchestrator.ts`

Implements the review-then-submit workflow in two stages:

**Stage 1 — Build a plan (`buildApplicationPlan`)**

Given a profile and a matched job, returns an `ApplicationPlan`:

```typescript
interface ApplicationPlan {
  job:                  MatchedJob;
  coverLetterDraft:     string;               // Template-generated; future: LLM
  answers:              Record<string, string>; // Pre-filled Q&A
  specialRequirements:  string[];              // e.g. "coding test required"
}
```

The plan is shown to the user in the frontend before anything is submitted.

**Stage 2 — Submit an approved plan (`submitApprovedApplication`)**

1. Calls `formFiller.submitApplication` to drive the browser.
2. On success, calls `applicationRepo.logSubmission` to persist the record with status `"submitted"`.

---

### 6.5 Form Filler & Browser Automation

**Files:** `src/services/formFiller/index.ts`, `src/services/formFiller/playwrightClient.ts`

#### `playwrightClient`

Manages the Playwright browser lifecycle. Exposes a single `run(callback)` method that:

1. Launches a Chromium instance (headless by default; set `HEADLESS=false` to watch).
2. Creates a new browser context and page.
3. Passes the `Page` object to the supplied callback.
4. Always closes the context and browser in a `finally` block to prevent resource leaks.

#### `formFiller`

Calls `playwrightClient.run` and navigates to `job.applyUrl`. The site-specific form-filling logic (selectors, multi-step flows, file uploads) is marked as `TODO` and is the primary area for future development.

---

## 7. HTTP Adapter (REST API)

### 7.1 Server Setup

**File:** `src/adapters/http/server.ts`

```typescript
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../../public'))); // serves index.html
app.use('/api/profile',      profileRoutes);
app.use('/api/jobs',         jobRoutes);
app.use('/api/applications', applicationRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
```

- Static files from `public/` are served at `/`, so navigating to the root URL loads the frontend.
- All business routes are namespaced under `/api/`.

---

### 7.2 API Endpoints

#### Health

| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{ "status": "ok" }` |

#### Profile (`/api/profile`)

| Method | Path | Body / Query | Description |
|---|---|---|---|
| `POST` | `/api/profile` | `UserProfile` JSON | Create or update a profile. Returns `201` with saved object. Requires `id`, `name`, and `email`. |
| `GET` | `/api/profile/:id` | — | Fetch a profile. Returns `404` if not found. |

**Example — create profile:**
```http
POST /api/profile
Content-Type: application/json

{
  "id": "alice",
  "name": "Alice Smith",
  "email": "alice@example.com",
  "resumeText": "Experienced backend engineer…",
  "preferences": {
    "desiredTitles": ["Software Engineer"],
    "locations": ["Remote"],
    "remoteOnly": true,
    "mustHaveTech": ["TypeScript", "Node.js"]
  }
}
```

#### Jobs (`/api/jobs`)

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/jobs` | `userId` (required) | Discover jobs for the profile and return them ranked by match score. |

**Example:**
```http
GET /api/jobs?userId=alice
```

Returns an array of `MatchedJob` objects sorted by `matchScore` descending.

#### Applications (`/api/applications`)

| Method | Path | Body / Query | Description |
|---|---|---|---|
| `POST` | `/api/applications/plan` | `{ userId, job: MatchedJob }` | Build a draft application plan. |
| `POST` | `/api/applications/submit` | `{ userId, plan: ApplicationPlan, files?: Record<string,string> }` | Submit an approved plan. |
| `GET` | `/api/applications` | `userId` (required) | List all application records for the user. |
| `PATCH` | `/api/applications/:id/status` | `{ status, notes? }` | Update an application's status. |

---

### 7.3 Error Handling & Validation

Validation is performed inline in each route handler before calling services. Common patterns:

- Missing required fields → `400 Bad Request` with `{ "error": "<reason>" }`
- Resource not found → `404 Not Found`
- Unexpected errors → `500 Internal Server Error` with the error message

---

## 8. Persistence Layer

**Directory:** `src/adapters/persistence/`

All repositories currently use in-memory `Map` objects. This means **data is lost when the server restarts**, which is intentional for zero-dependency local development. Each repository implements the same async interface so a database-backed version can replace it without changing any calling code.

### `userRepo`

| Method | Description |
|---|---|
| `upsert(profile)` | Insert or overwrite the profile keyed by `profile.id` |
| `findById(id)` | Return the profile or `null` |
| `list()` | Return all profiles |
| `delete(id)` | Remove a profile; returns `true` if it existed |

### `applicationRepo`

| Method | Description |
|---|---|
| `logSubmission(record)` | Assign a UUID, store, and return the record |
| `findById(id)` | Return the record or `null` |
| `listByUser(userId)` | Return all records for a given user |
| `updateStatus(id, status, notes?)` | Mutate `status` and optionally `notes`; returns updated record or `null` |

### `jobRepo`

Provides the same CRUD shape for `JobMetadata` objects (cache layer for discovered jobs).

### `prismaClient`

`src/adapters/persistence/prismaClient.ts` exports a `PrismaClient` singleton. It is imported only if you choose to wire up a PostgreSQL backend. To activate:

```bash
npm install @prisma/client
npx prisma init           # Creates prisma/schema.prisma
npx prisma migrate dev    # Creates tables
```

Then update the repositories to call the Prisma client instead of the in-memory Maps.

---

## 9. Storage Adapter

**File:** `src/adapters/storage/fileStorage.ts`

Saves binary files (resumes, cover letters) to a local directory (`./uploads` by default). Filenames are sanitised before writing.

| Method | Description |
|---|---|
| `save(filename, data)` | Sanitise name, create directory if needed, write buffer; returns full path |
| `read(filename)` | Sanitise name, read and return buffer |
| `delete(filename)` | Sanitise name, unlink the file |

In a production multi-instance deployment, replace this adapter with an S3-backed implementation.

---

## 10. Frontend (Single-Page Application)

**File:** `public/index.html`

A zero-dependency, single-file SPA served directly from the Express static middleware. It communicates with the backend exclusively via `fetch` calls to the REST API.

### Layout

The UI is divided into three tab panels:

#### Tab 1 — Profile

Allows the user to create and edit their `UserProfile`:

- **User ID, Name, Email** — identity fields
- **Desired Titles** — comma-separated list
- **Locations** — comma-separated list
- **Remote Only** — checkbox
- **Min / Max Salary** — numeric inputs
- **Must-Have Tech** — comma-separated list of required skills
- **Avoid Companies** — comma-separated list
- **Resume Text** — full-text area

Clicking **Save Profile** sends a `POST /api/profile` request. Clicking **Load Profile** sends a `GET /api/profile/:id` request and populates the form.

#### Tab 2 — Job Matches

Displays ranked job postings for the current user ID:

- **Search Jobs** button triggers `GET /api/jobs?userId=<id>`
- Each job card shows: title, company, location, salary (if available), required skills (badge list), missing skills, and a colour-coded match score badge
- Scores ≥ 70 are shown in green; 40–69 in orange; below 40 in red

#### Tab 3 — Applications

Displays the user's application history:

- **Refresh** button triggers `GET /api/applications?userId=<id>`
- Each row shows: company, job title, date applied, and a status badge
- Status badges are colour-coded: `submitted` → blue, `interview` → green, `offer` → gold, `rejected` → red, others → grey

### Colour Palette

| Token | Hex | Usage |
|---|---|---|
| Primary | `#2b6cb0` | Buttons, active tab underline |
| Dark | `#1a365d` | Header background |
| Success | `#276749` | High match score, interview status |
| Warning | `#744210` | Medium match score |
| Error | `#9b2c2c` | Low match score, rejected status |

---

## 11. Configuration & Environment Variables

**File:** `src/config/index.ts`

```typescript
export const config = {
  port:     process.env.PORT     || 4000,
  dbUrl:    process.env.DATABASE_URL || 'postgres://localhost/job_assistant',
  headless: process.env.HEADLESS !== 'false',
};
```

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `4000` | No | TCP port the Express server listens on |
| `DATABASE_URL` | `postgres://localhost/job_assistant` | Only with Prisma | PostgreSQL connection string |
| `HEADLESS` | `true` | No | Set to `false` to watch browser automation in a visible window |
| `OPENAI_API_KEY` | — | No | Reserved for future LLM integration |
| `REDIS_URL` | — | No | Reserved for future BullMQ job queue |

Copy `.env.example` to `.env` and fill in the values you need:

```bash
cp .env.example .env
```

---

## 12. End-to-End Application Workflow

```
┌────────────────────────────────────────────────────────────┐
│  1. User fills in Profile tab and clicks "Save Profile"    │
│     POST /api/profile                                       │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  2. User clicks "Search Jobs" on Job Matches tab            │
│     GET /api/jobs?userId=<id>                               │
│                                                             │
│     Server:                                                 │
│       a. Fetch profile from userRepo                        │
│       b. discoverJobsForProfile() — LinkedIn + Indeed stubs │
│          + RSS feeds; deduplicate by applyUrl               │
│       c. rankJobs() — score + sort each job                 │
│     Returns: MatchedJob[] sorted by matchScore DESC         │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  3. User reviews ranked jobs and clicks "Apply"             │
│     POST /api/applications/plan                             │
│     Body: { userId, job: MatchedJob }                       │
│                                                             │
│     Server:                                                 │
│       a. buildApplicationPlan() — generates cover letter    │
│          template + Q&A skeleton + special requirements     │
│     Returns: ApplicationPlan                                │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  4. Frontend displays plan for human review                 │
│     User edits cover letter if desired, then clicks         │
│     "Approve & Submit"                                      │
│     POST /api/applications/submit                           │
│     Body: { userId, plan, files? }                          │
│                                                             │
│     Server:                                                 │
│       a. formFiller.submitApplication()                     │
│          — Playwright navigates to applyUrl                 │
│          — fills form fields (site-specific, TODO)          │
│          — uploads files                                    │
│          — submits the form                                 │
│       b. applicationRepo.logSubmission() — status=submitted │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  5. User monitors Applications tab                          │
│     GET /api/applications?userId=<id>                       │
│     PATCH /api/applications/:id/status  (manual update)     │
└────────────────────────────────────────────────────────────┘
```

---

## 13. Job Matching Algorithm

**File:** `src/services/matchingService.ts`

The `scoreJob` function produces a single integer score from 0 to 100 using a weighted combination of two signals:

### Skill Score (70% weight)

```
skillScore = matchedRequiredSkills / totalRequiredSkills
```

- **`matchedRequiredSkills`** — the count of skills in `job.requiredSkills` that partially match any entry in `profile.preferences.mustHaveTech` (case-insensitive substring match).
- If `job.requiredSkills` is empty, `skillScore` defaults to `0.5`.

### Remote Score (30% weight)

| Condition | Value |
|---|---|
| `profile.preferences.remoteOnly = true` AND job location contains `"remote"` (case-insensitive) | `1.0` |
| `profile.preferences.remoteOnly = true` AND job is NOT remote | `0.0` |
| `profile.preferences.remoteOnly = false` | `0.5` (neutral) |

### Final Score

```
matchScore = round((skillScore × 0.7 + remoteScore × 0.3) × 100)
```

### Missing Requirements

`missingRequirements` is the subset of `job.requiredSkills` that were **not** matched, giving the user a clear view of skill gaps.

---

## 14. Testing Strategy

**Directory:** `src/__tests__/`
**Framework:** Jest with ts-jest

All tests are unit tests. No integration or end-to-end tests exist yet.

| File | What is tested |
|---|---|
| `matchingService.test.ts` | Skill scoring, remote scoring, edge cases (empty skills, 0 required skills), `rankJobs` ordering |
| `userRepo.test.ts` | `upsert`, `findById`, `list`, `delete` on the in-memory store |
| `jobDiscoveryService.test.ts` | Source aggregation, de-duplication by `applyUrl` |
| `applicationRepo.test.ts` | `logSubmission` (UUID generation), `listByUser` filtering, `updateStatus` mutation |

**Run all tests:**
```bash
npm test
```

**Run a single test file:**
```bash
npx jest src/__tests__/matchingService.test.ts
```

**Check coverage:**
```bash
npx jest --coverage
```

---

## 15. CI/CD Pipeline

**File:** `.github/workflows/main_jobapplicationbuddy.yml`

The pipeline runs on every push to the `main` branch.

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│  Checkout   │───►│  Setup       │───►│  Build &     │───►│  Deploy to       │
│  code       │    │  Node 24.x   │    │  Test        │    │  Azure Web App   │
└─────────────┘    └──────────────┘    │  npm install │    │  (jobapplication │
                                       │  npm run     │    │   buddy)         │
                                       │  build       │    └──────────────────┘
                                       │  npm test    │
                                       └──────────────┘
```

The deploy step uses the `AZUREAPPSERVICE_PUBLISHPROFILE` secret stored in GitHub to authenticate with Azure. The built artifact (`dist/`) is deployed to the Azure Web App.

---

## 16. Local Development Guide

### Prerequisites

- Node.js 18+ (24.x recommended)
- npm 9+
- (Optional) PostgreSQL if you want persistent storage

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env if needed (default port 4000 works out of the box)

# 3. Start development server with hot-reload via ts-node
npm run dev
```

The API is now available at `http://localhost:4000`.  
The frontend SPA is served at `http://localhost:4000/` (open in a browser).

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `ts-node src/app.ts` | Run in development mode (no build step) |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/app.js` | Run compiled production build |
| `test` | `jest` | Run all unit tests |
| `lint` | `eslint 'src/**/*.ts'` | Check for linting errors |

### Quick Smoke Test

```bash
# Health check
curl http://localhost:4000/health

# Create a profile
curl -X POST http://localhost:4000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dev-user",
    "name": "Dev User",
    "email": "dev@example.com",
    "resumeText": "Full-stack engineer with 5 years experience.",
    "preferences": {
      "desiredTitles": ["Software Engineer"],
      "locations": ["Remote"],
      "remoteOnly": true,
      "mustHaveTech": ["TypeScript", "Node.js", "React"]
    }
  }'

# Discover and rank jobs
curl "http://localhost:4000/api/jobs?userId=dev-user"
```

### Enabling a Database

```bash
npm install @prisma/client prisma --save-dev
npx prisma init

# Edit prisma/schema.prisma to add your models,
# then run:
npx prisma migrate dev --name init
```

Update `DATABASE_URL` in `.env` to point to your PostgreSQL instance.

---

## 17. Future Roadmap

| Priority | Feature | Description |
|---|---|---|
| High | **LLM cover letter generation** | Integrate OpenAI / Anthropic API to produce personalised cover letters instead of the current template |
| High | **ATS-specific form strategies** | Implement Playwright selectors and multi-step flows for Greenhouse, Lever, Workday, and other common ATS portals |
| Medium | **PostgreSQL persistence** | Replace in-memory Maps with Prisma models; add database migrations |
| Medium | **Background job queue** | Use BullMQ + Redis to run application flows asynchronously and retry on failure |
| Medium | **React / Next.js frontend** | Replace the vanilla SPA with a component-based UI that supports file uploads and real-time progress |
| Low | **Authentication** | Add OAuth (Google / GitHub) and JWT sessions to support multiple users |
| Low | **Salary & company filters** | Apply `minSalary`, `maxSalary`, and `avoidCompanies` preferences in the matching engine |
| Low | **Observability** | Add structured logging (Winston / Pino) and metrics (Prometheus) |
