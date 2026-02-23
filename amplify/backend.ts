import { defineBackend } from '@aws-amplify/backend'
import { apiFunction } from './functions/api/resource.js'
import { auth } from './auth/resource.js'
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb'
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'
import { RemovalPolicy } from 'aws-cdk-lib'
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'

export const backend = defineBackend({
  auth,
  apiFunction,
})

// ─── DynamoDB table names (configurable via environment variables) ─────────────

const apiKeysTableName = process.env.DYNAMO_TABLE_NAME ?? 'chatlog-api-keys'
const analysisTableName = process.env.DYNAMO_ANALYSIS_TABLE_NAME ?? 'chatlog-analysis-requests'

// ─── DynamoDB tables ──────────────────────────────────────────────────────────

const tablesStack = backend.createStack('TablesStack')

/**
 * API Keys table (single-table design)
 *
 * pk  = "USER#<userId>"
 * sk  = "KEY#<keyId>"
 *
 * GSI "KeyHashIndex"
 *   pk  = keyHash   (enables O(1) lookup during X-API-Key validation)
 */
const apiKeysTable = new Table(tablesStack, 'ApiKeysTable', {
  tableName: apiKeysTableName,
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.RETAIN,
})

apiKeysTable.addGlobalSecondaryIndex({
  indexName: 'KeyHashIndex',
  partitionKey: { name: 'keyHash', type: AttributeType.STRING },
  projectionType: ProjectionType.ALL,
})

/**
 * Analysis Requests table
 *
 * pk  = "USER#<userId>"
 * sk  = "CALL#<ISO-timestamp>#<callId>"
 *
 * GSI "CallIdIndex"
 *   pk  = callId   (enables O(1) lookup by callId without scanning)
 */
const analysisTable = new Table(tablesStack, 'AnalysisRequestsTable', {
  tableName: analysisTableName,
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.RETAIN,
})

analysisTable.addGlobalSecondaryIndex({
  indexName: 'CallIdIndex',
  partitionKey: { name: 'callId', type: AttributeType.STRING },
  projectionType: ProjectionType.ALL,
})

// ─── IAM: grant apiFunction Lambda read/write access to both tables ───────────

const lambdaRole = backend.apiFunction.resources.lambda.role!
apiKeysTable.grantReadWriteData(lambdaRole)
analysisTable.grantReadWriteData(lambdaRole)

// ─── Pass table names as Lambda environment variables ─────────────────────────

const lambdaFunction = backend.apiFunction.resources.lambda as LambdaFunction
lambdaFunction.addEnvironment('DYNAMO_TABLE_NAME', apiKeysTableName)
lambdaFunction.addEnvironment('DYNAMO_ANALYSIS_TABLE_NAME', analysisTableName)

// ─── IAM: grant apiFunction Lambda access to Amazon Comprehend ───────────────

lambdaRole.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'comprehend:DetectSentiment',
      'comprehend:DetectToxicContent',
    ],
    resources: ['*'],
  }),
)
