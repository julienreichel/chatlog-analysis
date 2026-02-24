#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_BASE_URL = 'http://localhost:3000'
const DEFAULT_TYPE = 'sentiment'

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.API_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.API_KEY || '',
    type: DEFAULT_TYPE,
    payloadPath: '',
    pretty: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--base-url') options.baseUrl = argv[++i] || DEFAULT_BASE_URL
    else if (arg === '--api-key') options.apiKey = argv[++i] || ''
    else if (arg === '--type') options.type = argv[++i] || DEFAULT_TYPE
    else if (arg === '--payload') options.payloadPath = argv[++i] || ''
    else if (arg === '--no-pretty') options.pretty = false
    else if (arg === '--help') options.help = true
  }

  return options
}

function usage() {
  console.log(`
Usage:
  node scripts/send-sample-analysis.mjs --api-key <key> [--type sentiment|toxicity] [--base-url <url>] [--payload <file>]

Options:
  --api-key    Required API key (or set API_KEY env var)
  --type       Endpoint type: sentiment|toxicity (default: sentiment)
  --base-url   API base URL (default: http://localhost:3000 or API_BASE_URL env var)
  --payload    Optional JSON file path for custom request body
  --no-pretty  Print compact JSON response
`)
}

function defaultPayload() {
  return {
    conversationId: `sample-${Date.now()}`,
    model: 'gpt-4',
    channel: 'script-test',
    tags: ['sample', 'smoke-test'],
    messages: [
      {
        role: 'user',
        content: 'I love this platform. The response time is excellent.',
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: 'Thank you. I can help you analyze tone and toxicity.',
      },
      {
        role: 'user',
        content: 'Yesterday a teammate wrote a rude comment and that upset me.',
      },
    ],
  }
}

function loadPayload(payloadPath) {
  if (!payloadPath)
    return defaultPayload()

  const absPath = resolve(process.cwd(), payloadPath)
  try {
    return JSON.parse(readFileSync(absPath, 'utf-8'))
  }
  catch (error) {
    console.error(`[send-sample-analysis] Failed to load payload file: ${absPath}`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

function normalizeType(type) {
  return type === 'toxicity' ? 'toxicity' : 'sentiment'
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  if (!options.apiKey) {
    console.error('[send-sample-analysis] Missing API key. Pass --api-key <key> or set API_KEY.')
    process.exit(1)
  }

  const type = normalizeType(options.type)
  const payload = loadPayload(options.payloadPath)
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const endpoint = `${baseUrl}/api/v1/analysis/${type}`

  console.log(`[send-sample-analysis] POST ${endpoint}`)
  console.log(`[send-sample-analysis] messages=${Array.isArray(payload.messages) ? payload.messages.length : 0}`)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let data = null
  try {
    data = JSON.parse(text)
  }
  catch {
    data = { raw: text }
  }

  if (!response.ok) {
    console.error(`[send-sample-analysis] Request failed (${response.status})`)
    console.error(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
    process.exit(1)
  }

  console.log(`[send-sample-analysis] Request succeeded (${response.status})`)
  console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
}

main().catch((error) => {
  console.error('[send-sample-analysis] Unexpected error')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
