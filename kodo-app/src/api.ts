import type { Citation, Message, Tier } from './types';

export interface ChatResult {
  text: string;
  citations: Citation[];
}

// У деві проксі vite.config.ts спрямовує /api на localhost:8787.
// У продакшн-білді фронтенд і бекенд — окремі сервіси, тож потрібна повна адреса бекенду.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function sendChat(messages: Message[], tier: Tier): Promise<ChatResult> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
      tier,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Помилка сервера');
  }
  return data as ChatResult;
}
