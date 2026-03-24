import OpenAI from 'openai'
import { gatewayBaseUrl } from './env'

let openaiClient: OpenAI | null = null

/**
 * Lazy gateway client so route modules can import this safely during build.
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: gatewayBaseUrl(),
      apiKey: process.env.OPENCLAW_GATEWAY_TOKEN || '',
    })
  }

  return openaiClient
}
