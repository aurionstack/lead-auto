// ============================================================
// lib/telegram.ts
// ============================================================

export async function sendTelegramNotification(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId || token === 'your_telegram_bot_token') {
    console.warn('[Telegram] Missing Telegram environment variables. Message not sent.');
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telegram] API Error (${response.status}):`, errorText);
      return false;
    }

    console.log('[Telegram] Notification sent successfully!');
    return true;
  } catch (err) {
    console.error('[Telegram] Failed to send message:', err);
    return false;
  }
}
