import type { Conversation } from '../types';

export const mockConversations: Conversation[] = [
  {
    id: 'c1',
    title: 'Гра "Змійка" на Python',
    messages: [
      {
        id: 'm1',
        role: 'user',
        text: 'Навчи мене робити просту гру "Змійка" на Python з нуля.',
        createdAt: Date.now() - 1000 * 60 * 8,
      },
      {
        id: 'm2',
        role: 'assistant',
        text:
          'Почнемо з основ: цикл гри, сітка, і рух змійки по клітинках. ' +
          'Ось мінімальна робоча версія на `pygame` — онови поле, коли будеш готовий рухатись далі.\n\n' +
          '```python\nimport pygame, random\n\npygame.init()\nCELL = 20\nW, H = 480, 480\nscreen = pygame.display.set_mode((W, H))\nclock = pygame.time.Clock()\n\nsnake = [(200, 200)]\ndirection = (CELL, 0)\nfood = (100, 100)\n\nrunning = True\nwhile running:\n    for e in pygame.event.get():\n        if e.type == pygame.QUIT:\n            running = False\n        if e.type == pygame.KEYDOWN:\n            if e.key == pygame.K_LEFT:\n                direction = (-CELL, 0)\n            elif e.key == pygame.K_RIGHT:\n                direction = (CELL, 0)\n            elif e.key == pygame.K_UP:\n                direction = (0, -CELL)\n            elif e.key == pygame.K_DOWN:\n                direction = (0, CELL)\n\n    head = (snake[0][0] + direction[0], snake[0][1] + direction[1])\n    snake.insert(0, head)\n    if head == food:\n        food = (random.randrange(0, W, CELL), random.randrange(0, H, CELL))\n    else:\n        snake.pop()\n\n    screen.fill((15, 15, 20))\n    for s in snake:\n        pygame.draw.rect(screen, (90, 200, 140), (*s, CELL, CELL))\n    pygame.draw.rect(screen, (230, 90, 90), (*food, CELL, CELL))\n    pygame.display.flip()\n    clock.tick(10)\n\npygame.quit()\n```\n\nЗапусти цей код у пісочниці праворуч — побачиш результат одразу. Далі додамо рахунок і перевірку зіткнень.',
        createdAt: Date.now() - 1000 * 60 * 7,
      },
    ],
  },
  {
    id: 'c2',
    title: 'Пояснення рекурсії',
    messages: [
      {
        id: 'm3',
        role: 'user',
        text: 'Поясни рекурсію простими словами, на прикладі.',
        createdAt: Date.now() - 1000 * 60 * 60 * 5,
      },
      {
        id: 'm4',
        role: 'assistant',
        text:
          'Рекурсія — це коли функція викликає саму себе для розв\'язання меншої частини тієї ж задачі.\n\n' +
          '```javascript\nfunction factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n```\n\nУявляй це як матрьошку: кожен виклик відкриває меншу копію задачі, поки не дійде до найпростішого випадку (`n <= 1`), а потім результати "складаються" назад.',
        createdAt: Date.now() - 1000 * 60 * 60 * 5 + 1000 * 40,
      },
    ],
  },
  {
    id: 'c3',
    title: 'Нова розмова',
    messages: [],
  },
];
