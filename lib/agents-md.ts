/**
 * agents-md: Generate Laravel documentation index for AI coding agents.
 *
 * Downloads docs from GitHub via git clone, builds a compact index
 * of all doc files, and injects it into CLAUDE.md or AGENTS.md.
 */

import { execa } from 'execa'
import fs from 'fs'
import path from 'path'
import os from 'os'

interface LaravelVersionResult {
  version: string | null
  error?: string
}

export function getLaravelVersion(cwd: string): LaravelVersionResult {
  const composerJsonPath = path.join(cwd, 'composer.json')

  if (!fs.existsSync(composerJsonPath)) {
    return {
      version: null,
      error: 'No composer.json found in the current directory',
    }
  }

  try {
    const composerJson = JSON.parse(fs.readFileSync(composerJsonPath, 'utf-8'))
    const requireDeps = composerJson.require || {}
    const requireDevDeps = composerJson['require-dev'] || {}

    const laravelConstraint =
      requireDeps['laravel/framework'] ||
      requireDevDeps['laravel/framework'] ||
      requireDeps['laravel/laravel'] ||
      requireDevDeps['laravel/laravel']

    if (laravelConstraint) {
      const normalized = normalizeLaravelBranch(String(laravelConstraint))
      if (normalized) return { version: normalized }
      return {
        version: null,
        error: `Unrecognized Laravel version constraint: ${laravelConstraint}`,
      }
    }

    return {
      version: null,
      error: 'Laravel is not installed in this project.',
    }
  } catch (err) {
    return {
      version: null,
      error: `Failed to parse composer.json: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function normalizeLaravelBranch(value: string): string | null {
  const cleaned = value.trim().toLowerCase()

  if (cleaned === 'dev-master' || cleaned === 'master') return 'master'
  if (cleaned === 'dev-main' || cleaned === 'main') return 'main'

  const trimmed = cleaned.replace(/^[\^~>=< ]+/, '').replace(/^v/, '')

  if (trimmed.endsWith('.x')) {
    const major = trimmed.split('.', 1)[0]
    return major && /^\d+$/.test(major) ? `${major}.x` : null
  }

  if (trimmed.endsWith('.*')) {
    const major = trimmed.split('.', 1)[0]
    return major && /^\d+$/.test(major) ? `${major}.x` : null
  }

  const match = trimmed.match(/(\d+)/)
  if (!match) return null
  return `${match[1]}.x`
}

interface PullOptions {
  cwd: string
  version?: string
  docsDir?: string
}

interface PullResult {
  success: boolean
  docsPath?: string
  laravelVersion?: string
  error?: string
}

interface MergeExtraDocsResult {
  merged: boolean
  sourcePath?: string
  targetPath?: string
}

const DEFAULT_EXTRA_DOCS_DIR = '.laravel-docs-extra'

export async function pullDocs(options: PullOptions): Promise<PullResult> {
  const { cwd, version: versionOverride, docsDir } = options

  let laravelVersion: string

  if (versionOverride) {
    const normalized = normalizeLaravelBranch(versionOverride)
    if (!normalized) {
      return {
        success: false,
        error: `Unrecognized Laravel version: ${versionOverride}`,
      }
    }
    laravelVersion = normalized
  } else {
    const versionResult = getLaravelVersion(cwd)
    if (!versionResult.version) {
      return {
        success: false,
        error: versionResult.error || 'Could not detect Laravel version',
      }
    }
    laravelVersion = versionResult.version
  }

  const docsPath =
    docsDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'laravel-agents-md-'))
  const useTempDir = !docsDir

  try {
    if (useTempDir && fs.existsSync(docsPath)) {
      fs.rmSync(docsPath, { recursive: true })
    }

    await cloneDocsRepo(laravelVersion, docsPath)

    return {
      success: true,
      docsPath,
      laravelVersion,
    }
  } catch (error) {
    if (useTempDir && fs.existsSync(docsPath)) {
      fs.rmSync(docsPath, { recursive: true })
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function cloneDocsRepo(branch: string, destDir: string): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laravel-agents-md-'))

  try {
    try {
      await execa(
        'git',
        [
          'clone',
          '--depth',
          '1',
          '--single-branch',
          '--branch',
          branch,
          'https://github.com/laravel/docs.git',
          '.',
        ],
        { cwd: tempDir }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('not found') || message.includes('did not match')) {
        throw new Error(
          `Could not find documentation for Laravel ${branch}. This version may not exist on GitHub yet.`
        )
      }
      throw error
    }

    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true })
    }
    fs.mkdirSync(destDir, { recursive: true })

    fs.cpSync(tempDir, destDir, { recursive: true })

    const gitDir = path.join(destDir, '.git')
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true })
    }
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  }
}

export function mergeExtraDocs(options: {
  cwd: string
  docsPath: string
  extraDocsDir?: string
  targetSubdir?: string
}): MergeExtraDocsResult {
  const extraDirName = options.extraDocsDir ?? DEFAULT_EXTRA_DOCS_DIR
  const extraDocsPath = path.isAbsolute(extraDirName)
    ? extraDirName
    : path.join(options.cwd, extraDirName)

  if (!fs.existsSync(extraDocsPath)) {
    return { merged: false }
  }

  const targetSubdir = options.targetSubdir?.trim()
  if (!targetSubdir || targetSubdir === '.' || targetSubdir === './') {
    const entries = fs.readdirSync(extraDocsPath)
    for (const entry of entries) {
      const source = path.join(extraDocsPath, entry)
      const destination = path.join(options.docsPath, entry)
      fs.cpSync(source, destination, { recursive: true })
    }
    return { merged: true, sourcePath: extraDocsPath, targetPath: options.docsPath }
  }

  const targetPath = path.join(options.docsPath, targetSubdir)

  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }

  fs.cpSync(extraDocsPath, targetPath, { recursive: true })

  return { merged: true, sourcePath: extraDocsPath, targetPath }
}

export function collectDocFiles(dir: string): { relativePath: string }[] {
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter(
      (f) =>
        (f.endsWith('.md') || f.endsWith('.mdx')) &&
        !/[/\\]index\.mdx$/.test(f) &&
        !/[/\\]index\.md$/.test(f) &&
        !f.startsWith('index.')
    )
    .sort()
    .map((f) => ({ relativePath: f.replace(/\\/g, '/') }))
}

interface DocSection {
  name: string
  files: { relativePath: string }[]
  subsections: DocSection[]
}

export function buildDocTree(files: { relativePath: string }[]): DocSection[] {
  const sections: Map<string, DocSection> = new Map()

  for (const file of files) {
    const parts = file.relativePath.split(/[/\\]/)
    if (parts.length === 1) {
      const rootKey = '.'
      if (!sections.has(rootKey)) {
        sections.set(rootKey, {
          name: rootKey,
          files: [],
          subsections: [],
        })
      }
      sections.get(rootKey)!.files.push({ relativePath: file.relativePath })
      continue
    }

    const topLevelDir = parts[0]

    if (!sections.has(topLevelDir)) {
      sections.set(topLevelDir, {
        name: topLevelDir,
        files: [],
        subsections: [],
      })
    }

    const section = sections.get(topLevelDir)!

    if (parts.length === 2) {
      section.files.push({ relativePath: file.relativePath })
    } else {
      const subsectionDir = parts[1]
      let subsection = section.subsections.find((s) => s.name === subsectionDir)

      if (!subsection) {
        subsection = { name: subsectionDir, files: [], subsections: [] }
        section.subsections.push(subsection)
      }

      if (parts.length === 3) {
        subsection.files.push({ relativePath: file.relativePath })
      } else {
        const subSubDir = parts[2]
        let subSubsection = subsection.subsections.find(
          (s) => s.name === subSubDir
        )

        if (!subSubsection) {
          subSubsection = { name: subSubDir, files: [], subsections: [] }
          subsection.subsections.push(subSubsection)
        }

        subSubsection.files.push({ relativePath: file.relativePath })
      }
    }
  }

  const sortedSections = Array.from(sections.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  for (const section of sortedSections) {
    section.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    section.subsections.sort((a, b) => a.name.localeCompare(b.name))
    for (const subsection of section.subsections) {
      subsection.files.sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath)
      )
      subsection.subsections.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return sortedSections
}

interface ClaudeMdIndexData {
  docsPath: string
  sections: DocSection[]
  outputFile?: string
}

export function generateClaudeMdIndex(data: ClaudeMdIndexData): string {
  const { docsPath, sections, outputFile } = data

  const parts: string[] = []

  parts.push('[Laravel Docs Index]')
  parts.push(`root: ${docsPath}`)
  parts.push(
    'STOP. What you remember about Laravel is WRONG for this project. Always search docs and read before any task.'
  )
  const targetFile = outputFile || 'AGENTS.md'
  parts.push(
    `If docs missing, run this command first: npx github:sungkhum/laravel-agent agents-md --output ${targetFile}`
  )

  const allFiles = collectAllFilesFromSections(sections)
  const grouped = groupByDirectory(allFiles)

  for (const [dir, files] of grouped) {
    parts.push(`${dir}:{${files.join(',')}}`)
  }

  return parts.join('|')
}

function collectAllFilesFromSections(sections: DocSection[]): string[] {
  const files: string[] = []

  for (const section of sections) {
    for (const file of section.files) {
      files.push(file.relativePath)
    }
    files.push(...collectAllFilesFromSections(section.subsections))
  }

  return files
}

function groupByDirectory(files: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()

  for (const filePath of files) {
    const lastSlash = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\')
    )
    const dir = lastSlash === -1 ? '.' : filePath.slice(0, lastSlash)
    const fileName = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1)

    const existing = grouped.get(dir)
    if (existing) {
      existing.push(fileName)
    } else {
      grouped.set(dir, [fileName])
    }
  }

  return grouped
}

const START_MARKER = '<!-- LARAVEL-AGENTS-MD-START -->'
const END_MARKER = '<!-- LARAVEL-AGENTS-MD-END -->'

function hasExistingIndex(content: string): boolean {
  return content.includes(START_MARKER)
}

function wrapWithMarkers(content: string): string {
  return `${START_MARKER}
${content}
${END_MARKER}`
}

export function injectIntoClaudeMd(
  claudeMdContent: string,
  indexContent: string
): string {
  const wrappedContent = wrapWithMarkers(indexContent)

  if (hasExistingIndex(claudeMdContent)) {
    const startIdx = claudeMdContent.indexOf(START_MARKER)
    const endIdx = claudeMdContent.indexOf(END_MARKER) + END_MARKER.length

    return (
      claudeMdContent.slice(0, startIdx) +
      wrappedContent +
      claudeMdContent.slice(endIdx)
    )
  }

  const separator = claudeMdContent.endsWith('\n') ? '\n' : '\n\n'
  return claudeMdContent + separator + wrappedContent + '\n'
}

interface GitignoreStatus {
  path: string
  updated: boolean
  alreadyPresent: boolean
}

const GITIGNORE_ENTRY = '.laravel-docs/'

export function ensureGitignoreEntry(cwd: string): GitignoreStatus {
  const gitignorePath = path.join(cwd, '.gitignore')
  const entryRegex = /^\s*\.laravel-docs(?:\/.*)?$/

  let content = ''
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8')
  }

  const hasEntry = content.split(/\r?\n/).some((line) => entryRegex.test(line))

  if (hasEntry) {
    return { path: gitignorePath, updated: false, alreadyPresent: true }
  }

  const needsNewline = content.length > 0 && !content.endsWith('\n')
  const header = content.includes('# laravel-agents-md')
    ? ''
    : '# laravel-agents-md\n'
  const newContent =
    content + (needsNewline ? '\n' : '') + header + `${GITIGNORE_ENTRY}\n`

  fs.writeFileSync(gitignorePath, newContent, 'utf-8')

  return { path: gitignorePath, updated: true, alreadyPresent: false }
}
