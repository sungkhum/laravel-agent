# Laravel Docs

Place Laravel documentation (Markdown) under `./.laravel-docs` so the agent can read version-matched docs.

Recommended source:
- The CLI below will download the appropriate version of the official Laravel docs repo.

One-command setup (Laravel version is auto-detected from `composer.json` unless you pass `--version`):

```bash
npx @sungkhum/laravel-agent agents-md --output AGENTS.md
```

Local dev (run the CLI entrypoint after building):

```bash
node dist/cli/index.js agents-md --output AGENTS.md
```

Manual path (if you already populated docs and want to inject only):

```bash
python3 scripts/build_laravel_docs_index.py
```

Both commands update `AGENTS.md` with a compressed docs index.
