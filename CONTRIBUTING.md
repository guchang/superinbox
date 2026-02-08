# Contributing to SuperInbox

Thanks for contributing to SuperInbox.

This guide explains how to set up your environment, follow the project workflow, and submit high-quality changes.

## Development Environment

- Node.js >= 18
- npm
- macOS / Linux / Windows

Check your versions:

```bash
node -v
npm -v
```

## Repository Structure

```text
SuperInbox/
├── backend/   # Backend service (TypeScript + Express + SQLite)
├── web/       # Frontend app (Next.js)
├── cli/       # Command-line client
├── docs/      # Project documentation
├── start.sh   # One-command startup script (macOS/Linux)
└── start.js   # One-command startup script (cross-platform)
```

## Running the Project Locally

### Preferred: one-command startup

```bash
./start.sh
```

or:

```bash
node start.js
```

### Run each module manually

```bash
# backend
cd backend && npm install && npm run dev

# web
cd web && npm install && npm run dev

# cli
cd cli && npm install && npm run dev
```

## Common Development Commands

### backend

```bash
cd backend
npm run dev
npm run lint
npm test
npm run build
```

### web

```bash
cd web
npm run dev
npm run lint
npm run build
```

### cli

```bash
cd cli
npm run dev
npm test
npm run build
```

## Branch and Commit Rules

- Use feature branches for development work.
- Keep commits focused and atomic.
- **Commit messages must be in English**.

Examples:

```text
feat(cli): add interactive delete flow
fix(web): handle empty routing result state
docs: update startup and contribution guides
refactor(backend): simplify auth middleware
```

## Code and Documentation Expectations

- Follow existing project style and structure.
- Update documentation when behavior or APIs change.
- Include minimal runnable examples for new commands, scripts, or configuration keys.

## Pull Request Checklist

Before opening a PR, verify the following:

- [ ] Related modules run successfully
- [ ] Required lint/tests pass
- [ ] Docs are updated where needed
- [ ] No unrelated file changes are included
- [ ] Commit messages are clear and in English

Recommended PR description structure:

1. Purpose of the change
2. Main changes
3. Validation steps (commands, screenshots, logs)
4. Risk and rollback plan (if applicable)

## Security and Configuration Notes

- Never commit secrets, tokens, passwords, or production credentials.
- Use local `.env` files or local config for development.
- Before commit, check for accidental logs, temp files, or build artifacts.

---

If you are unsure where a change belongs, open an Issue first and discuss the approach.
