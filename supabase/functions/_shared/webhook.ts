export async function configureWebhook(
  instanceName: string,
  supabaseUrl: string,
  evolutionBaseUrl: string,
  evolutionApiKey: string,
  webhookApiKey?: string,
): Promise<boolean> {
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`

  const payload: any = {
    enabled: true,
    url: webhookUrl,
    webhook_by_events: true,
    webhook_base64: false,
    events: ['MESSAGES_UPSERT'],
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: evolutionApiKey,
  }

  const targetUrl = `${evolutionBaseUrl}/webhook/set/${instanceName}`

  try {
    console.log(`[Webhook Config] Attempting to set webhook -> ${targetUrl}`)
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log(
      `[Webhook Config] Status: ${response.status} - Response: ${responseText}`,
    )

    if (response.ok) {
      return true
    }

    // Fallback: Some versions of Evolution API expect the configuration object to be wrapped in a 'webhook' property
    console.log(
      `[Webhook Config] Attempting fallback with wrapped payload -> ${targetUrl}`,
    )
    const fallbackResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ webhook: payload }),
    })

    const fallbackText = await fallbackResponse.text()
    console.log(
      `[Webhook Config] Fallback Status: ${fallbackResponse.status} - Response: ${fallbackText}`,
    )

    if (fallbackResponse.ok) {
      return true
    }
  } catch (error) {
    console.error(`[Webhook Config] Exception:`, error)
  }

  return false
}
