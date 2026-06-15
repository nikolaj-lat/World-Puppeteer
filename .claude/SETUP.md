# Claude Setup Guide

## Requirements

- Node.js LTS
- npm
- Claude Code in VS Code or Cursor, if using the Claude frontend

Install dependencies from the repository root:

```bash
npm install
```

## Clone

Use this fork as the authoritative repository:

```bash
git clone https://github.com/NobodyIsUgly/World-Puppeteer.git
cd World-Puppeteer
npm install
```

## Claude Workflow

Open the repository in VS Code or Cursor and start Claude Code. Claude reads `.claude/CLAUDE.md`, root `AGENTS.md`, and the nearest applicable `AGENTS.override.md`.

Claude hooks are marker-aware:

- SessionStart runs `.claude/scripts/session-context.cjs` and is read-only.
- PostToolUse forwards edit payloads to the shared hook pipeline.
- Hooks validate only reliably classified changed paths.
- Final explicit validation is still required after arbitrary shell writes.

## Validation

Run these before reporting tooling work complete:

```bash
npm test
npm run test:reference-packs
npm run validate:metadata
```

For a world build:

```bash
node .claude/scripts/build-world.cjs --world <world-root>
node .claude/scripts/validate.js <world-root>/tabs --json
```

The build command validates the exact compiled candidate before backup or publication.

## Optional Image Generation

Image generation is separate from the core tooling. Configure any provider-specific API keys only when a task explicitly requires image generation.
