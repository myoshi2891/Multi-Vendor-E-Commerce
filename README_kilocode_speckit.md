# KiloCode + Spec Kit Setup

## Directory Map
- `.kilocode/` rules and workflows (guardrails and process docs).
- `.specify/` shared memory and templates for specs.
- `specs/` feature specs (create `NNN-short-name/` per feature).

## Operating Rules
- Create a new folder under `specs/` for every new feature.
- Start from templates in `.specify/templates/`.
- Keep rules minimal and update only when necessary.
- Use a 3-digit prefix and kebab-case name (example: `002-search-autocomplete`).
- Do not reuse numbers; keep folder names stable for traceability.

## Safety
This setup adds documentation and templates only. It does not modify existing
application code or runtime behavior.
