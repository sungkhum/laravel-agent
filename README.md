# @sungkhum/laravel-agent

Laravel documentation index generator for AI coding agents. Mirrors the workflow of `npx @next/codemod agents-md` but targets Laravel.

## Usage

```bash
npx github:sungkhum/laravel-agent agents-md --output AGENTS.md
```

You can also specify a Laravel docs version (branch) explicitly:

```bash
npx @sungkhum/laravel-agent agents-md --version 10.x --output AGENTS.md
```

This will:
- Detect or use the specified Laravel version
- Download the matching docs from `laravel/docs`
- Build a compact docs index
- Inject it into your target markdown file (e.g. `AGENTS.md`)
- Add `.laravel-docs/` to `.gitignore` if missing

## Requirements

- Node.js 18+ (recommended)
- Git installed (used to clone the docs repo)

## Local development

```bash
npm install
npm run build
node dist/cli/index.js agents-md --output AGENTS.md
```

## License

MIT
