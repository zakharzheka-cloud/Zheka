import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('ANTHROPIC_API_KEY не задано — /api/chat відповідатиме демо-текстом до налаштування ключа в server/.env');
}

const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// Найпотужніший тариф отримує найсильнішу модель, середній — швидшу й дешевшу.
const MODEL_BY_TIER = {
  trial: 'claude-haiku-4-5-20251001',
  standard: 'claude-haiku-4-5-20251001',
  pro: 'claude-sonnet-5',
};

const SYSTEM_PROMPT = `Ти — Kodo, дружній AI-репетитор з програмування та інших тем.
Пояснюй просто, з прикладами коду, коли це доречно.
Якщо для відповіді потрібна свіжа або специфічна інформація з інтернету — користуйся інструментом web_search.
Заборонено: писати шкідливе ПЗ, реальні експлойти проти конкретних систем чи людей, фішинг, інструкції для злому чужих акаунтів чи пристроїв.
У такому разі ввічливо відмов і запропонуй легальну альтернативу (наприклад, пояснення основ кібербезпеки в навчальному форматі).`;

// Перша лінія захисту: очевидно шкідливі запити відсікаються до виклику
// моделі. Це не заміна модерації всередині моделі, а додатковий бар'єр.
const BLOCKED_PATTERNS = [
  /зламати\s+(чужий|акаунт|пароль|телефон|вайфай)/i,
  /malware|ransomware|keylogger|spyware/i,
  /ddos/i,
  /вкрасти\s+(пароль|дані|акаунт)/i,
  /обійти\s+(захист|ліцензію|активацію)/i,
];

// Used only while ANTHROPIC_API_KEY is not configured, so a demo never shows
// a raw error screen. Clearly labeled — not a substitute for the real API.
function fallbackReply(question) {
  const note =
    '_(Демо-режим: ключ ANTHROPIC_API_KEY ще не підключено на сервері — це заготовлена відповідь, а не жива відповідь AI.)_\n\n';
  if (/python|javascript|typescript|java\b|c\+\+|html|css|код|програм/i.test(question)) {
    return (
      note +
      'Із задоволенням допоможу з програмуванням! Додай ANTHROPIC_API_KEY на сервері, щоб отримувати справжні відповіді з поясненнями коду та прикладами.'
    );
  }
  if (/погод/i.test(question)) {
    return (
      note +
      'Поки що не можу перевірити погоду наживо — для цього потрібен підключений ключ і веб-пошук. Щойно ключ буде доданий, зможу шукати актуальну інформацію в інтернеті.'
    );
  }
  return (
    note +
    'Дякую за питання! Щойно на сервері буде налаштований ANTHROPIC_API_KEY, я зможу відповідати на будь-які запитання з реальним інтелектом і пошуком в інтернеті.'
  );
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/chat', async (req, res) => {
  const { messages, tier } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  if (BLOCKED_PATTERNS.some((re) => re.test(lastUserText))) {
    return res.json({
      text: 'Я не можу допомогти з цим запитом — він схожий на прохання про зламування чи шкідливий код. Якщо тобі цікава кібербезпека, можу пояснити основи захисту або етичний хакінг у навчальному форматі.',
      citations: [],
    });
  }

  if (!anthropic) {
    return res.json({
      text: fallbackReply(lastUserText),
      citations: [],
    });
  }

  try {
    const model = MODEL_BY_TIER[tier] || MODEL_BY_TIER.standard;
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const citations = response.content
      .filter((b) => b.type === 'text' && b.citations)
      .flatMap((b) => b.citations)
      .map((c) => ({ url: c.url, title: c.title }));

    res.json({ text, citations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка звернення до AI. Спробуй ще раз.' });
  }
});

app.listen(PORT, () => {
  console.log(`Kodo backend слухає на http://localhost:${PORT}`);
});
