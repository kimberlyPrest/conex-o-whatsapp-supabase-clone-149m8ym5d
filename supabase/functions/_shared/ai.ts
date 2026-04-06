export function normalizeMessages(messages: any[]) {
  return messages.map((m) => ({
    role: m.role || (m.direction === 'in' ? 'user' : 'assistant'),
    content: m.content || m.message_text || '',
    mediaBase64: m.mediaBase64,
    mediaType: m.mediaType,
    mediaMimeType: m.mediaMimeType,
  }))
}

export async function transcribeAudio(
  apiKey: string,
  b64: string,
  mime: string,
) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

  const fd = new FormData()
  let ext = 'ogg'
  if (mime.includes('mp4')) ext = 'mp4'
  else if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3'
  else if (mime.includes('wav')) ext = 'wav'
  else if (mime.includes('webm')) ext = 'webm'

  fd.append(
    'file',
    new Blob([bytes], { type: mime.split(';')[0] }),
    `audio.${ext}`,
  )
  fd.append('model', 'whisper-1')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  })

  if (!res.ok) throw new Error(`OpenAI Whisper error: ${await res.text()}`)
  return (await res.json()).text
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  sys: string,
  msgs: any[],
) {
  const norm = normalizeMessages(msgs).map((m) => {
    if (m.mediaBase64 && m.mediaType === 'image') {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content || ' ' },
          {
            type: 'image_url',
            image_url: {
              url: `data:${m.mediaMimeType};base64,${m.mediaBase64}`,
            },
          },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: sys ? [{ role: 'system', content: sys }, ...norm] : norm,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`)
  return (await res.json()).choices[0].message.content
}

export async function callGemini(
  apiKey: string,
  model: string,
  sys: string,
  msgs: any[],
) {
  const norm = normalizeMessages(msgs).map((m) => {
    const parts: any[] = []
    if (m.content) parts.push({ text: m.content })
    else if (!m.mediaBase64) parts.push({ text: ' ' })

    if (m.mediaBase64) {
      parts.push({
        inlineData: { mimeType: m.mediaMimeType, data: m.mediaBase64 },
      })
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })

  const body: any = { contents: norm }
  if (sys) body.systemInstruction = { parts: [{ text: sys }] }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) throw new Error(`Gemini API error: ${await res.text()}`)
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function callClaude(
  apiKey: string,
  model: string,
  sys: string,
  msgs: any[],
) {
  const norm = normalizeMessages(msgs).map((m) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    if (m.mediaBase64 && m.mediaType === 'image') {
      return {
        role,
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: m.mediaMimeType,
              data: m.mediaBase64,
            },
          },
          { type: 'text', text: m.content || ' ' },
        ],
      }
    }
    return { role, content: m.content || ' ' }
  })

  const alternating: any[] = []
  for (const m of norm) {
    if (alternating.length === 0) {
      if (m.role === 'user') alternating.push(m)
    } else {
      const last = alternating[alternating.length - 1]
      if (last.role === m.role) {
        if (typeof last.content === 'string' && typeof m.content === 'string') {
          last.content += '\n' + m.content
        } else if (Array.isArray(last.content) && Array.isArray(m.content)) {
          last.content.push(...m.content)
        } else if (
          Array.isArray(last.content) &&
          typeof m.content === 'string'
        ) {
          last.content.push({ type: 'text', text: m.content })
        } else if (
          typeof last.content === 'string' &&
          Array.isArray(m.content)
        ) {
          last.content = [{ type: 'text', text: last.content }, ...m.content]
        }
      } else {
        alternating.push(m)
      }
    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: sys || undefined,
      messages:
        alternating.length > 0
          ? alternating
          : [{ role: 'user', content: 'Hello' }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API error: ${await res.text()}`)
  const data = await res.json()
  return data.content[0].text
}

export async function generateChatResponse(
  messages: { role: string; content: string }[],
  apiKey: string,
  provider: 'openai' | 'gemini' | 'claude' = 'openai',
  systemPrompt?: string,
) {
  if (provider === 'openai')
    return callOpenAI(apiKey, 'gpt-4o-mini', systemPrompt || '', messages)
  if (provider === 'gemini')
    return callGemini(apiKey, 'gemini-1.5-flash', systemPrompt || '', messages)
  if (provider === 'claude')
    return callClaude(
      apiKey,
      'claude-3-haiku-20240307',
      systemPrompt || '',
      messages,
    )
  throw new Error(`Provider ${provider} not supported for chat generation`)
}

export async function generateEmbedding(
  text: string,
  apiKey: string,
  provider: string = 'openai',
) {
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      },
    )
    if (!response.ok)
      throw new Error(`Gemini Embedding API error: ${await response.text()}`)
    return (await response.json()).embedding.values
  }

  if (provider === 'claude') {
    throw new Error(
      'Claude does not provide a native embedding API. Please use OpenAI or Gemini for Knowledge Base features.',
    )
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  if (!response.ok)
    throw new Error(`OpenAI Embedding API error: ${await response.text()}`)
  return (await response.json()).data[0].embedding
}

export async function analyzeToneAndSentiment(
  text: string,
  apiKey: string,
  provider: 'openai' | 'gemini' | 'claude' = 'openai',
) {
  const prompt = `Analyze the sentiment and tone of the following text. Return a JSON object with 'sentiment' (positive, negative, or neutral) and 'tone' (a short description). Text: "${text}"`
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok)
      throw new Error(`OpenAI API error: ${await response.text()}`)
    return JSON.parse((await response.json()).choices[0].message.content)
  }
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      },
    )
    if (!response.ok)
      throw new Error(`Gemini API error: ${await response.text()}`)
    const textResp =
      (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    try {
      return JSON.parse(textResp.replace(/```json\n?|\n?```/g, ''))
    } catch {
      return { sentiment: 'neutral', tone: 'neutral' }
    }
  }
  if (provider === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [
          { role: 'user', content: prompt + '\nReturn ONLY the JSON.' },
        ],
      }),
    })
    if (!response.ok)
      throw new Error(`Claude API error: ${await response.text()}`)
    const textResp = (await response.json()).content[0].text || '{}'
    try {
      return JSON.parse(textResp.replace(/```json\n?|\n?```/g, ''))
    } catch {
      return { sentiment: 'neutral', tone: 'neutral' }
    }
  }
  throw new Error(`Provider ${provider} not supported`)
}
