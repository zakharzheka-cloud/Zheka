# Kodo — AI-репетитор з програмування

Веб-прототип: чат-інтерфейс на React + TypeScript, бекенд на Node/Express,
що звертається до Claude API з інструментом веб-пошуку.

## Структура

- `src/` — фронтенд (Vite + React)
- `server/` — бекенд (Express, викликає Anthropic Messages API)
- `render.yaml` (у корені репозиторію) — блюпринт для деплою обох сервісів на Render одним кліком

## Деплой на Render (безкоштовно, без ноутбука)

1. Зайди на [render.com](https://render.com) з телефону, увійди через GitHub.
2. New → Blueprint → обери цей репозиторій і гілку `kodo-app`. Render сам прочитає `render.yaml` і запропонує створити два сервіси: `kodo-backend` і `kodo-frontend`.
3. Перед деплоєм Render попросить заповнити змінну `ANTHROPIC_API_KEY` для `kodo-backend` — встав свій ключ з [console.anthropic.com](https://console.anthropic.com).
4. Дочекайся, поки `kodo-backend` задеплоїться, скопіюй його URL (виду `https://kodo-backend-xxxx.onrender.com`).
5. Відкрий налаштування `kodo-frontend` → Environment → встав скопійований URL у змінну `VITE_API_URL` → Save, Redeploy.
6. Відкрий URL `kodo-frontend` у браузері телефону — застосунок готовий.

Безкоштовний план Render "засинає" після 15 хв без запитів — перший запит після паузи може зайняти ~30 секунд.

## Локальна розробка

```bash
# бекенд
cd server && npm install && cp .env.example .env  # встав свій ключ у .env
npm run dev

# фронтенд (окремий термінал)
cd .. && npm install && npm run dev
```
