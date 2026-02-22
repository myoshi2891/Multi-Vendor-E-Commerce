# Workflow: Submit PR

## Branch Naming
- feature/<short-topic>
- fix/<short-topic>
- chore/<short-topic>

## Steps
1) Create a branch: `git checkout -b feature/<short-topic>` (or `fix/`).
2) Implement the change in small, reviewable commits.
3) Run tests (pick the relevant subset):
   - `bun run lint`
   - `bun run test`
   - `bunx playwright test --project=chromium --workers=1` (E2E smoke)
4) Update specs or docs if behavior changes (`specs/` and `README*.md`).
5) Prepare the PR description (summary, risk, testing).

## Checklist
- [ ] Scope is small and clear
- [ ] Tests added or updated (or N/A with reason)
- [ ] Docs/specs updated
- [ ] No secrets committed
