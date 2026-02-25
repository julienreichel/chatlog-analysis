#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const DEFAULT_USER_NAME = 'chatlog-analysis-local-dev'
const DEFAULT_POLICY_NAME = 'ChatlogAnalysisLocalDevAccess'
const DEFAULT_ENV_FILE = 'app/.env'
const DEFAULT_ROLE_POLICY_NAME = 'ChatlogAnalysisAmplifyRuntimeAccess'

function parseArgs(argv) {
  const options = {
    ciCheck: false,
    printPolicy: false,
    verifyRole: false,
    createUser: false,
    userName: DEFAULT_USER_NAME,
    policyName: DEFAULT_POLICY_NAME,
    rolePolicyName: DEFAULT_ROLE_POLICY_NAME,
    roleArn: process.env.IAM_ROLE_ARN || '',
    roleName: process.env.IAM_ROLE_NAME || '',
    envFile: DEFAULT_ENV_FILE,
    writeEnv: false,
    profile: process.env.AWS_PROFILE || '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--ci-check')
      options.ciCheck = true
    else if (arg === '--print-policy')
      options.printPolicy = true
    else if (arg === '--verify-role')
      options.verifyRole = true
    else if (arg === '--create-user')
      options.createUser = true
    else if (arg === '--write-env')
      options.writeEnv = true
    else if (arg === '--user-name')
      options.userName = argv[++i] || DEFAULT_USER_NAME
    else if (arg === '--policy-name')
      options.policyName = argv[++i] || DEFAULT_POLICY_NAME
    else if (arg === '--role-policy-name')
      options.rolePolicyName = argv[++i] || DEFAULT_ROLE_POLICY_NAME
    else if (arg === '--role-arn')
      options.roleArn = argv[++i] || ''
    else if (arg === '--role-name')
      options.roleName = argv[++i] || ''
    else if (arg === '--env-file')
      options.envFile = argv[++i] || DEFAULT_ENV_FILE
    else if (arg === '--profile')
      options.profile = argv[++i] || ''
    else if (arg === '--help')
      options.help = true
  }

  return options
}

function usage() {
  console.log(`
Usage:
  node scripts/aws-iam-helper.mjs --ci-check
  node scripts/aws-iam-helper.mjs --print-policy
  node scripts/aws-iam-helper.mjs --verify-role --role-arn <arn>
  node scripts/aws-iam-helper.mjs --verify-role --role-name <name>
  node scripts/aws-iam-helper.mjs --create-user [--user-name <name>] [--policy-name <name>] [--write-env]

Options:
  --ci-check         Print policy guidance when AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are missing.
  --print-policy     Always print the policy JSON.
  --verify-role      Simulate required permissions for an IAM role and print PASS/FAIL checks.
  --role-arn         Role ARN for --verify-role.
  --role-name        Role name for --verify-role (resolved to ARN via aws iam get-role).
  --role-policy-name Inline policy name shown in generated fix commands.
  --create-user      Create/update a local IAM user and attach an inline policy for this app.
  --write-env        Write the generated access key/secret into app/.env (or --env-file).
  --env-file         Path to env file for --write-env. Default: app/.env
  --profile          AWS profile to use for AWS CLI calls.
`)
}

function loadAmplifyOutputs() {
  const outputsPath = resolve(process.cwd(), 'amplify_outputs.json')
  if (!existsSync(outputsPath))
    return null

  try {
    return JSON.parse(readFileSync(outputsPath, 'utf-8'))
  }
  catch {
    return null
  }
}

function runAwsJson(args, profile) {
  const fullArgs = [...args]
  if (profile)
    fullArgs.push('--profile', profile)
  fullArgs.push('--output', 'json')
  const stdout = execFileSync('aws', fullArgs, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(stdout)
}

function tryGetAccountId(profile) {
  try {
    const identity = runAwsJson(['sts', 'get-caller-identity'], profile)
    return identity?.Account || ''
  }
  catch {
    return ''
  }
}

function resolveContext(profile, attemptAccountLookup) {
  const amplifyOutputs = loadAmplifyOutputs()
  const region = process.env.AWS_REGION
    || process.env.AWS_DEFAULT_REGION
    || amplifyOutputs?.auth?.aws_region
    || '<REGION>'

  const tableName = process.env.DYNAMO_TABLE_NAME
    || amplifyOutputs?.custom?.dynamoTableName
    || ''
  const analysisTableName = process.env.DYNAMO_ANALYSIS_TABLE_NAME
    || amplifyOutputs?.custom?.dynamoAnalysisTableName
    || ''

  const accountId = process.env.AWS_ACCOUNT_ID
    || (attemptAccountLookup ? tryGetAccountId(profile) : '')
    || '<ACCOUNT_ID>'

  return { region, tableName, analysisTableName, accountId }
}

function makePolicy({ region, accountId, tableName, analysisTableName }) {
  const resolvedTableName = tableName || 'amplify-chatloganalysismonorepo-*-ApiKeysTable*'
  const resolvedAnalysisName = analysisTableName || 'amplify-chatloganalysismonorepo-*-AnalysisRequestsTable*'

  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        Resource: [
          `arn:aws:dynamodb:${region}:${accountId}:table/${resolvedTableName}`,
          `arn:aws:dynamodb:${region}:${accountId}:table/${resolvedTableName}/index/*`,
          `arn:aws:dynamodb:${region}:${accountId}:table/${resolvedAnalysisName}`,
          `arn:aws:dynamodb:${region}:${accountId}:table/${resolvedAnalysisName}/index/*`,
        ],
      },
      {
        Effect: 'Allow',
        Action: [
          'comprehend:DetectSentiment',
          'comprehend:DetectToxicContent',
        ],
        Resource: '*',
      },
    ],
  }
}

function roleNameFromArn(roleArn) {
  const parts = roleArn.split('/')
  return parts[parts.length - 1] || roleArn
}

function replaceEnvValue(text, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(text))
    return text.replace(pattern, line)
  return `${text.trimEnd()}\n${line}\n`
}

function writeLocalEnv(envPath, accessKeyId, secretAccessKey, region) {
  const absPath = resolve(process.cwd(), envPath)
  const current = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : ''
  let updated = current
  updated = replaceEnvValue(updated, 'AWS_ACCESS_KEY_ID', accessKeyId)
  updated = replaceEnvValue(updated, 'AWS_SECRET_ACCESS_KEY', secretAccessKey)
  if (!/^AWS_REGION=/m.test(updated))
    updated = replaceEnvValue(updated, 'AWS_REGION', region)
  writeFileSync(absPath, `${updated.trimEnd()}\n`, 'utf-8')
  console.log(`[aws-iam-helper] Wrote credentials to ${envPath}`)
}

function printFixSteps(policy, roleName, roleArn, rolePolicyName) {
  console.log('\n[aws-iam-helper] Fix steps (copy/paste):')
  console.log('1) Save the required policy JSON:')
  console.log("cat > /tmp/chatlog-analysis-policy.json <<'JSON'")
  console.log(JSON.stringify(policy, null, 2))
  console.log('JSON')
  console.log('\n2) Attach/update inline policy on the Amplify role:')
  console.log(`aws iam put-role-policy --role-name ${roleName} --policy-name ${rolePolicyName} --policy-document file:///tmp/chatlog-analysis-policy.json`)
  console.log('\n3) Verify again:')
  console.log(`node scripts/aws-iam-helper.mjs --verify-role --role-arn ${roleArn}`)
}

function createOrUpdateLocalUser(options, context, policy) {
  if (!context.tableName || !context.analysisTableName) {
    console.error('[aws-iam-helper] Table names are missing. Run `npx ampx sandbox` first, or set DYNAMO_TABLE_NAME and DYNAMO_ANALYSIS_TABLE_NAME.')
    process.exit(1)
  }
  if (context.accountId.startsWith('<')) {
    console.error('[aws-iam-helper] AWS account ID is missing. Set AWS_ACCOUNT_ID or configure AWS CLI credentials/profile.')
    process.exit(1)
  }
  if (context.region.startsWith('<')) {
    console.error('[aws-iam-helper] AWS region is missing. Set AWS_REGION or ensure amplify_outputs.json is present.')
    process.exit(1)
  }

  const profileArgs = options.profile ? ['--profile', options.profile] : []

  try {
    execFileSync('aws', ['iam', 'get-user', '--user-name', options.userName, ...profileArgs], { stdio: 'ignore' })
    console.log(`[aws-iam-helper] IAM user already exists: ${options.userName}`)
  }
  catch {
    execFileSync('aws', ['iam', 'create-user', '--user-name', options.userName, ...profileArgs], { stdio: 'inherit' })
    console.log(`[aws-iam-helper] Created IAM user: ${options.userName}`)
  }

  execFileSync(
    'aws',
    [
      'iam',
      'put-user-policy',
      '--user-name',
      options.userName,
      '--policy-name',
      options.policyName,
      '--policy-document',
      JSON.stringify(policy),
      ...profileArgs,
    ],
    { stdio: 'inherit' },
  )
  console.log(`[aws-iam-helper] Attached/updated inline policy: ${options.policyName}`)

  const key = runAwsJson(
    ['iam', 'create-access-key', '--user-name', options.userName],
    options.profile,
  )?.AccessKey

  if (!key?.AccessKeyId || !key?.SecretAccessKey) {
    console.error('[aws-iam-helper] Failed to create access key.')
    process.exit(1)
  }

  console.log('\n[aws-iam-helper] New access key created:')
  console.log(`AWS_ACCESS_KEY_ID=${key.AccessKeyId}`)
  console.log(`AWS_SECRET_ACCESS_KEY=${key.SecretAccessKey}`)

  if (options.writeEnv)
    writeLocalEnv(options.envFile, key.AccessKeyId, key.SecretAccessKey, context.region)
}

function resolveRoleArn(options) {
  if (options.roleArn)
    return options.roleArn

  if (!options.roleName)
    return ''

  try {
    const role = runAwsJson(['iam', 'get-role', '--role-name', options.roleName], options.profile)
    return role?.Role?.Arn || ''
  }
  catch {
    return ''
  }
}

function requiredChecks(policy) {
  const checks = []

  const dynamoStatement = policy.Statement.find(s => Array.isArray(s.Action) && s.Action.includes('dynamodb:GetItem'))
  const comprehendStatement = policy.Statement.find(s => Array.isArray(s.Action) && s.Action.includes('comprehend:DetectSentiment'))

  if (dynamoStatement) {
    for (const resource of dynamoStatement.Resource) {
      for (const action of dynamoStatement.Action)
        checks.push({ action, resource })
    }
  }

  if (comprehendStatement) {
    for (const action of comprehendStatement.Action)
      checks.push({ action, resource: '*' })
  }

  return checks
}

function simulateCheck(roleArn, action, resource, profile) {
  try {
    const out = runAwsJson(
      [
        'iam',
        'simulate-principal-policy',
        '--policy-source-arn',
        roleArn,
        '--action-names',
        action,
        '--resource-arns',
        resource,
      ],
      profile,
    )

    const decision = out?.EvaluationResults?.[0]?.EvalDecision || 'implicitDeny'
    return { ok: decision === 'allowed', decision }
  }
  catch (error) {
    return {
      ok: false,
      decision: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function verifyRolePermissions(options, policy) {
  const roleArn = resolveRoleArn(options)
  if (!roleArn) {
    console.error('[aws-iam-helper] Missing role identity. Provide --role-arn <arn> or --role-name <name>.')
    process.exit(1)
  }

  const checks = requiredChecks(policy)
  console.log(`[aws-iam-helper] Verifying ${checks.length} required permissions for role:`)
  console.log(roleArn)

  let failed = 0
  let errors = 0

  for (const check of checks) {
    const result = simulateCheck(roleArn, check.action, check.resource, options.profile)
    const shortResource = check.resource.length > 100 ? `${check.resource.slice(0, 97)}...` : check.resource

    if (result.ok) {
      console.log(`[PASS] ${check.action} on ${shortResource}`)
      continue
    }

    failed += 1
    if (result.decision === 'error') {
      errors += 1
      console.log(`[ERROR] ${check.action} on ${shortResource}`)
      if (result.error)
        console.log(`        ${result.error}`)
    }
    else {
      console.log(`[FAIL] ${check.action} on ${shortResource} (${result.decision})`)
    }
  }

  if (errors > 0) {
    console.log('\n[aws-iam-helper] Verification could not complete due to IAM simulation errors.')
    console.log('This usually means the caller lacks iam:SimulatePrincipalPolicy permission.')
    printFixSteps(policy, roleNameFromArn(roleArn), roleArn, options.rolePolicyName)
    process.exit(2)
  }

  if (failed > 0) {
    console.log(`\n[aws-iam-helper] Verification failed: ${failed} check(s) missing.`)
    printFixSteps(policy, roleNameFromArn(roleArn), roleArn, options.rolePolicyName)
    process.exit(1)
  }

  console.log('\n[aws-iam-helper] Verification passed: role has all required permissions.')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const context = resolveContext(options.profile, options.createUser || options.verifyRole)
  const policy = makePolicy(context)

  const hasStaticKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)

  if (options.ciCheck && !hasStaticKeys) {
    console.log('[aws-iam-helper] AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not set.')
    console.log('[aws-iam-helper] In Amplify Hosting, prefer attaching this policy to the app compute/service role instead of creating a dedicated IAM user.')
    console.log('\n[aws-iam-helper] Required policy:')
    console.log(JSON.stringify(policy, null, 2))
    console.log('\n[aws-iam-helper] To verify a role automatically, run:')
    console.log('node scripts/aws-iam-helper.mjs --verify-role --role-arn <ROLE_ARN>')
    return
  }

  if (options.verifyRole)
    verifyRolePermissions(options, policy)

  if (options.printPolicy || (!options.createUser && !options.ciCheck && !options.verifyRole)) {
    console.log(JSON.stringify(policy, null, 2))
    if (context.accountId.startsWith('<')) {
      console.log('\n[aws-iam-helper] Tip: set AWS_ACCOUNT_ID (or configure AWS CLI credentials) to render exact DynamoDB ARNs.')
    }
  }

  if (options.createUser)
    createOrUpdateLocalUser(options, context, policy)
}

main()
