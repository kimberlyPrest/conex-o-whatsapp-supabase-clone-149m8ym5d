const ALGORITHM = 'AES-GCM'

function getSecretKey() {
  const secret =
    Deno.env.get('SUPABASE_ENCRYPTION_SECRET') ||
    'default-secret-do-not-use-in-prod'
  if (secret.length < 32) {
    return secret.padEnd(32, '0')
  }
  return secret.substring(0, 32)
}

async function getKeyMaterial(secret: string) {
  const encoder = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encrypt(text: string): Promise<string> {
  const secret = getSecretKey()
  const key = await getKeyMaterial(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(text),
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encryptedText: string): Promise<string> {
  const secret = getSecretKey()
  const key = await getKeyMaterial(secret)

  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}
