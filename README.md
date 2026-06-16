## Our Project

Our project is a unified AI-powered medical dashboard for both patients and providers. The idea comes from a common problem in healthcare, where important information is 
often spread across multiple systems, making it difficult for patients to understand medical instructions, billing details, and follow-up actions, 
while also creating extra coordination work for providers and care teams. 
The goal of the system is to bring important healthcare information and services into one place. At a high level, the system is intended to 
provide customized home dashboards, AI-assisted support, appointment scheduling, secure access to sensitive information, and one-click access to 
major services from the dashboard. The main users of the system are patients, doctors, and other care team members. 
The planned technology stack currently includes a React frontend, a FastAPI backend, along with database support, authentication, AI integration, testing/security tools, and CI/CD support.

## Iteration 3 Release Package

This release package is organized for submission as follows:

- `code/` contains the HealthNest application source code, Docker configuration, Supabase configuration, frontend, and backend.
- `docs/` contains the updated project documentation for the iteration.
- `demo/` identifies the presentation and demo videos, which are attached to the GitHub Release because the video files are too large to commit directly to the repository.
- `README.md` and `team.md` are provided at the release root.

To run the application from this release package, enter the code directory first:

```bash
cd code
docker compose up --build
```

## CI/CD / Commit Procedure

Our team will use a simplified GitFlow workflow to organize development, track Jira work items, manage code reviews, reduce merge conflicts, and support CI/CD deployment practices throughout the project lifecycle.

Each feature, bug fix, documentation update, or enhancement should be associated with a Jira ticket before development begins. Developers will work on isolated branches and merge changes into the `main` branch only through reviewed pull requests.

---

# Branch Structure

## Main Branch

### `main`

The `main` branch represents the stable integration branch for the project. This branch should always contain the most stable and up-to-date version of the application.

Direct commits to `main` are discouraged. All updates should be merged through pull requests after review and testing.

Responsibilities of the `main` branch:
- Store stable project code
- Serve as the integration branch for completed work
- Act as the source for release branches
- Maintain clean project history

---

## Feature Branches

### `feature/JIRA-XXXX-short-description`

Feature branches are used to develop new functionality or user-facing features.

Examples:

```bash
feature/JIRA-101-patient-dashboard
feature/JIRA-102-ai-chatbot
feature/JIRA-103-appointment-scheduler
```

## Bug Fix Branches

### bugfix/JIRA-XXXX-short-description

Bugfix branches are used to fix defects discovered during development, testing, or review.

Examples:

```bash
bugfix/JIRA-120-login-validation
bugfix/JIRA-121-dashboard-render-error
```

Bugfix branches should:

- Be created from the latest version of main
- Focus only on resolving the specific issue

## Release Branches

### release/release-X.XX

Release branches are created near the end of an iteration to prepare a stable version for deployment, demo, or submission.

Examples:

```bash
release/release-1.00
release/release-1.10
```

Release branches:

- Are created from main
- Contain only reviewed and approved code
- Are used for final testing and deployment preparation
