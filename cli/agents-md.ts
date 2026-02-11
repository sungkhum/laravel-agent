/**
 * CLI handler for `npx github:sungkhum/laravel-agent agents-md`.
 * See ../lib/agents-md.ts for the core logic.
 */

import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import pc from 'picocolors'
import {
  getLaravelVersion,
  pullDocs,
  collectDocFiles,
  buildDocTree,
  generateClaudeMdIndex,
  injectIntoClaudeMd,
  ensureGitignoreEntry,
  mergeExtraDocs,
} from '../lib/agents-md'

export interface AgentsMdOptions {
  version?: string
  output?: string
}

const DOCS_DIR_NAME = '.laravel-docs'
const EXTRA_DOCS_DIR_NAME = '.laravel-docs-extra'
const EXTRA_DOCS_TARGET_DIR = ''

class BadInput extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadInput'
  }
}

function onCancel(): void {
  console.log(pc.yellow('\nCancelled.'))
  process.exit(0)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export async function runAgentsMd(options: AgentsMdOptions): Promise<void> {
  const cwd = process.cwd()

  // Mode logic:
  // 1. No flags → interactive mode (prompts for version + target file)
  // 2. --version provided → --output is REQUIRED (error if missing)
  // 3. --output alone → auto-detect version, error if not found

  let laravelVersion: string
  let targetFile: string

  if (options.version) {
    if (!options.output) {
      throw new BadInput(
        'When using --version, --output is also required.\n' +
          'Example: npx github:sungkhum/laravel-agent agents-md --version 10.x --output AGENTS.md'
      )
    }
    laravelVersion = options.version
    targetFile = options.output
  } else if (options.output) {
    const detected = getLaravelVersion(cwd)
    if (!detected.version) {
      throw new BadInput(
        'Could not detect Laravel version. Use --version to specify.\n' +
          `Example: npx github:sungkhum/laravel-agent agents-md --version 10.x --output ${options.output}`
      )
    }
    laravelVersion = detected.version
    targetFile = options.output
  } else {
    const promptedOptions = await promptForOptions(cwd)
    laravelVersion = promptedOptions.laravelVersion
    targetFile = promptedOptions.targetFile
  }

  const agentsMdPath = path.join(cwd, targetFile)
  const docsPath = path.join(cwd, DOCS_DIR_NAME)
  const docsLinkPath = `./${DOCS_DIR_NAME}`

  let sizeBefore = 0
  let isNewFile = true
  let existingContent = ''

  if (fs.existsSync(agentsMdPath)) {
    existingContent = fs.readFileSync(agentsMdPath, 'utf-8')
    sizeBefore = Buffer.byteLength(existingContent, 'utf-8')
    isNewFile = false
  }

  console.log(
    `\nDownloading Laravel ${pc.cyan(laravelVersion)} documentation to ${pc.cyan(DOCS_DIR_NAME)}...`
  )

  const pullResult = await pullDocs({
    cwd,
    version: laravelVersion,
    docsDir: docsPath,
  })

  if (!pullResult.success) {
    throw new BadInput(`Failed to pull docs: ${pullResult.error}`)
  }

  const mergedExtras = mergeExtraDocs({
    cwd,
    docsPath,
    extraDocsDir: EXTRA_DOCS_DIR_NAME,
    targetSubdir: EXTRA_DOCS_TARGET_DIR,
  })

  const docFiles = collectDocFiles(docsPath)
  const sections = buildDocTree(docFiles)

  const indexContent = generateClaudeMdIndex({
    docsPath: docsLinkPath,
    sections,
    outputFile: targetFile,
  })

  const newContent = injectIntoClaudeMd(existingContent, indexContent)
  fs.writeFileSync(agentsMdPath, newContent, 'utf-8')

  const sizeAfter = Buffer.byteLength(newContent, 'utf-8')

  const gitignoreResult = ensureGitignoreEntry(cwd)

  const action = isNewFile ? 'Created' : 'Updated'
  const sizeInfo = isNewFile
    ? formatSize(sizeAfter)
    : `${formatSize(sizeBefore)} → ${formatSize(sizeAfter)}`

  console.log(`${pc.green('✓')} ${action} ${pc.bold(targetFile)} (${sizeInfo})`)
  if (mergedExtras.merged) {
    console.log(
      `${pc.green('✓')} Included extra docs from ${pc.bold(EXTRA_DOCS_DIR_NAME)}`
    )
  }
  if (gitignoreResult.updated) {
    console.log(
      `${pc.green('✓')} Added ${pc.bold(DOCS_DIR_NAME)} to .gitignore`
    )
  }
  console.log('')
}

async function promptForOptions(
  cwd: string
): Promise<{ laravelVersion: string; targetFile: string }> {
  const versionResult = getLaravelVersion(cwd)
  const detectedVersion = versionResult.version

  console.log(
    pc.cyan('\ngithub:sungkhum/laravel-agent agents-md - Laravel Documentation for AI Agents\n')
  )

  if (detectedVersion) {
    console.log(pc.gray(`  Detected Laravel version: ${detectedVersion}\n`))
  }

  const response = await prompts(
    [
      {
        type: 'text',
        name: 'laravelVersion',
        message: 'Laravel docs version (e.g., 10.x)',
        initial: detectedVersion || '',
        validate: (value: string) =>
          value.trim() ? true : 'Please enter a Laravel docs version',
      },
      {
        type: 'select',
        name: 'targetFile',
        message: 'Target markdown file',
        choices: [
          { title: 'AGENTS.md', value: 'AGENTS.md' },
          { title: 'CLAUDE.md', value: 'CLAUDE.md' },
          { title: 'Custom...', value: '__custom__' },
        ],
        initial: 0,
      },
    ],
    { onCancel }
  )

  if (
    response.laravelVersion === undefined ||
    response.targetFile === undefined
  ) {
    console.log(pc.yellow('\nCancelled.'))
    process.exit(0)
  }

  let targetFile = response.targetFile

  if (targetFile === '__custom__') {
    const customResponse = await prompts(
      {
        type: 'text',
        name: 'customFile',
        message: 'Enter custom file path',
        initial: 'AGENTS.md',
        validate: (value: string) =>
          value.trim() ? true : 'Please enter a file path',
      },
      { onCancel }
    )

    if (customResponse.customFile === undefined) {
      console.log(pc.yellow('\nCancelled.'))
      process.exit(0)
    }

    targetFile = customResponse.customFile
  }

  return {
    laravelVersion: response.laravelVersion,
    targetFile,
  }
}
