import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results'])
const MCP_NAMES = new Set(['mcp.json', '.mcp.json'])

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function rel(root, file) {
  return path.relative(root, file).replaceAll('\\', '/')
}

function add(findings, severity, code, file, message) {
  findings.push({ severity, code, file, message })
}

function scanText(source, file, findings) {
  const lower = source.toLowerCase()

  const override = /\b(ignore|disregard|bypass|override)\b[^\n]{0,100}\b(previous|system|developer|security|policy|permission|authorization|guardrail)\b/i
  if (override.test(source)) {
    add(findings, 'high', 'PROMPT_OVERRIDE', file, 'Instruction-like text attempts to override policy, authorization, or higher-priority instructions.')
  }

  const shellPayloads = [
    /curl\s+[^\n|]+\|\s*(?:ba)?sh\b/i,
    /wget\s+[^\n|]+\|\s*(?:ba)?sh\b/i,
    /invoke-expression\b/i,
    /\biex\s*\(/i,
    /rm\s+-rf\s+\/(?:\s|$)/i,
  ]
  if (shellPayloads.some((pattern) => pattern.test(source))) {
    add(findings, 'critical', 'EXEC_PAYLOAD', file, 'Potential remote-code or destructive shell payload found in agent component text.')
  }

  const secretAssignment = /\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret)\b\s*[:=]\s*["']?(?!\$\{|<|your_|example|changeme|redacted)[A-Za-z0-9+/_=-]{16,}/i
  if (secretAssignment.test(source)) {
    add(findings, 'critical', 'HARDCODED_SECRET', file, 'Possible hard-coded credential in an agent component.')
  }

  if (lower.includes('disable') && /\b(rls|authorization|permissions?|audit|guardrails?)\b/i.test(source)) {
    add(findings, 'high', 'SECURITY_DISABLE', file, 'Agent component appears to request disabling a canonical security boundary.')
  }
}

function scanMcpConfig(source, file, findings) {
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    add(findings, 'high', 'MCP_PARSE', file, 'MCP configuration is not strict JSON and cannot be deterministically inspected.')
    return
  }

  const servers = parsed.mcpServers ?? parsed.servers
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    add(findings, 'high', 'MCP_SHAPE', file, 'MCP configuration has no inspectable server registry.')
    return
  }

  for (const [name, config] of Object.entries(servers)) {
    if (!config || typeof config !== 'object') {
      add(findings, 'high', 'MCP_SERVER_SHAPE', file, `MCP server ${name} has an invalid configuration.`)
      continue
    }

    const command = String(config.command ?? '')
    const args = Array.isArray(config.args) ? config.args.map(String) : []
    const joined = `${command} ${args.join(' ')}`.trim()

    if (/\b(?:bash|sh)\s+-c\b|\bpowershell(?:\.exe)?\b.*\s-(?:command|encodedcommand)\b|\bcmd(?:\.exe)?\s+\/c\b/i.test(joined)) {
      add(findings, 'critical', 'MCP_SHELL', file, `MCP server ${name} launches through an unrestricted shell.`)
    }

    if (/\b(?:npx|uvx)\b.*(?:@latest\b|\s+-y\s+[^\s@]+(?:\s|$))/i.test(joined)) {
      add(findings, 'high', 'MCP_UNPINNED', file, `MCP server ${name} executes an unpinned package.`)
    }

    const env = config.env
    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (/token|secret|password|api[_-]?key/i.test(key) && typeof value === 'string' && value && !/^\$\{|^\$[A-Z_]+$|^<.*>$/.test(value)) {
          add(findings, 'critical', 'MCP_INLINE_SECRET', file, `MCP server ${name} contains an inline secret-like value in ${key}.`)
        }
      }
    }
  }
}

export function scanAgentSupplyChain(rootDir = process.cwd()) {
  const findings = []
  const skillRoot = path.join(rootDir, 'rand-skills')
  const skillFiles = walk(skillRoot).filter((file) => path.basename(file) === 'SKILL.md')
  const repoFiles = walk(rootDir).filter((file) => {
    const base = path.basename(file).toLowerCase()
    return MCP_NAMES.has(base) || base.endsWith('.mcp.json')
  })

  for (const full of skillFiles) {
    const file = rel(rootDir, full)
    const source = fs.readFileSync(full, 'utf8')
    scanText(source, file, findings)
  }

  for (const full of repoFiles) {
    const file = rel(rootDir, full)
    const source = fs.readFileSync(full, 'utf8')
    scanText(source, file, findings)
    scanMcpConfig(source, file, findings)
  }

  const blocking = findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
  return {
    ok: blocking.length === 0,
    scanned: { skills: skillFiles.length, mcpConfigs: repoFiles.length },
    findings,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = scanAgentSupplyChain()
  for (const finding of result.findings) {
    console.error(`[${finding.severity.toUpperCase()}] ${finding.code} ${finding.file}: ${finding.message}`)
  }
  console.log(`RandAI agent supply-chain scan: ${result.scanned.skills} skills, ${result.scanned.mcpConfigs} MCP configs, ${result.findings.length} findings`)
  if (!result.ok) process.exit(1)
}
