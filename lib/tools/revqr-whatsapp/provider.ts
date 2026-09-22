type WhatsAppSendResult = { messages?: Array<{ id?: string }>; error?: { message?: string } };

function config() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v26.0';
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  return { token, version };
}

async function send(phoneNumberId: string, payload: Record<string, unknown>) {
  const { token, version } = config();
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    cache: 'no-store',
  });
  const result = await response.json() as WhatsAppSendResult;
  if (!response.ok || !result.messages?.[0]?.id) throw new Error(result.error?.message || `WhatsApp send failed (${response.status})`);
  return result.messages[0].id;
}

export function sendRevQrText(phoneNumberId: string, to: string, body: string) {
  return send(phoneNumberId, { recipient_type: 'individual', to, type: 'text', text: { preview_url: true, body } });
}

export function sendRevQrTemplate(phoneNumberId: string, to: string, name: string, language: string) {
  return send(phoneNumberId, { to, type: 'template', template: { name, language: { code: language } } });
}

export async function downloadRevQrMedia(mediaId: string) {
  const { token, version } = config();
  const metadataResponse = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; error?: { message?: string } };
  if (!metadataResponse.ok || !metadata.url) throw new Error(metadata.error?.message || 'Unable to resolve WhatsApp media');
  const mediaResponse = await fetch(metadata.url, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!mediaResponse.ok) throw new Error(`Unable to download WhatsApp media (${mediaResponse.status})`);
  return { bytes: await mediaResponse.arrayBuffer(), contentType: metadata.mime_type || mediaResponse.headers.get('content-type') || 'application/octet-stream' };
}
