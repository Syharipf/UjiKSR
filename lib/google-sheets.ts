import type { GoogleSheetsFeedbackPayload } from './feedback'

/**
 * Dispatches 9-question feedback payload to Google Sheets Webhook (Google Apps Script Web App).
 */
export async function sendToGoogleSheets(webhookUrl: string, payload: GoogleSheetsFeedbackPayload): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) {
    return { ok: false, error: 'Invalid webhook URL' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow', // Google Apps Script redirects with 302
    })
    clearTimeout(timeoutId)

    if (!res.ok && res.status !== 302) {
      return { ok: false, error: `Google Sheets responded with HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    clearTimeout(timeoutId)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
