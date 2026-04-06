import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { generateEmbedding } from '../_shared/ai.ts'
import { decrypt } from '../_shared/crypto.ts'
import { Buffer } from 'node:buffer'
import pdf from 'npm:pdf-parse@1.1.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function chunkText(text: string, maxChunkSize = 1000): string[] {
  // Clean text: remove structural noise like multiple consecutive newlines or massive whitespace gaps
  const cleaned = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const chunks: string[] = []

  let currentPos = 0
  while (currentPos < cleaned.length) {
    let chunkEnd = currentPos + maxChunkSize

    if (chunkEnd < cleaned.length) {
      // Try to break at a sentence boundary
      const sentenceBreak = cleaned.lastIndexOf('. ', chunkEnd)
      if (sentenceBreak > currentPos && sentenceBreak > chunkEnd - 300) {
        chunkEnd = sentenceBreak + 2
      } else {
        // Fallback to word boundary
        const wordBreak = cleaned.lastIndexOf(' ', chunkEnd)
        if (wordBreak > currentPos) {
          chunkEnd = wordBreak + 1
        }
      }
    }

    const chunk = cleaned.slice(currentPos, chunkEnd).trim()
    if (chunk) chunks.push(chunk)
    currentPos = chunkEnd
  }

  return chunks
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  let supabase
  let agentId

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    agentId = body.agentId

    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) throw new Error('Agent not found')

    if (!agent.knowledge_base_url) {
      throw new Error('No knowledge base URL found')
    }

    const { data: providerKey } = await supabase
      .from('ai_provider_keys')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .eq('provider', agent.provider)
      .single()

    if (!providerKey) throw new Error('Provider API key not found')

    const apiKey = await decrypt(providerKey.api_key_encrypted)

    await supabase
      .from('ai_agents')
      .update({ knowledge_base_status: 'processing' })
      .eq('id', agentId)

    const fileRes = await fetch(agent.knowledge_base_url)
    if (!fileRes.ok) throw new Error('Failed to fetch knowledge base document')

    const contentType = fileRes.headers.get('content-type') || ''
    const isPdf =
      contentType.includes('application/pdf') ||
      agent.knowledge_base_url.toLowerCase().endsWith('.pdf')

    let text = ''

    if (isPdf) {
      console.log('Detected PDF file, extracting text...')
      try {
        const arrayBuffer = await fileRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const data = await pdf(buffer)
        text = data.text
      } catch (err) {
        console.error('Error parsing PDF:', err)
        throw new Error('Failed to extract text from PDF document.')
      }
    } else {
      console.log('Detected text/plain or other format, reading directly...')
      text = await fileRes.text()
    }

    if (!text || !text.trim()) {
      throw new Error('No readable text found in document.')
    }

    const chunks = chunkText(text)
    console.log(
      `Extracted ${text.length} chars, split into ${chunks.length} chunks.`,
    )

    await supabase
      .from('agent_knowledge_embeddings')
      .delete()
      .eq('agent_id', agentId)

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk, apiKey, agent.provider)

      await supabase.from('agent_knowledge_embeddings').insert({
        agent_id: agentId,
        content: chunk,
        embedding: embedding,
        metadata: {
          source: agent.knowledge_base_url,
          type: isPdf ? 'pdf' : 'text',
        },
      })
    }

    await supabase
      .from('ai_agents')
      .update({ knowledge_base_status: 'ready' })
      .eq('id', agentId)

    return new Response(
      JSON.stringify({ success: true, chunksCount: chunks.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('Process Knowledge Base Error:', error)
    if (supabase && agentId) {
      await supabase
        .from('ai_agents')
        .update({ knowledge_base_status: 'error' })
        .eq('id', agentId)
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
