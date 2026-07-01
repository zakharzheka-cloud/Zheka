export type Role = 'user' | 'assistant';

export interface Citation {
  url: string;
  title: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
  citations?: Citation[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

export type Tier = 'trial' | 'standard' | 'pro';

export interface TierInfo {
  id: Tier;
  name: string;
  price: string;
  model: string;
  description: string;
}

export const TIERS: TierInfo[] = [
  {
    id: 'trial',
    name: 'Пробний тиждень',
    price: 'безкоштовно 7 днів',
    model: 'Standard-модель',
    description: 'Повний доступ на тиждень, потім перехід у Середню підписку.',
  },
  {
    id: 'standard',
    name: 'Середня',
    price: '$5 / міс',
    model: 'Швидка модель',
    description: 'Навчання мов програмування, пояснення тем, генерація коду.',
  },
  {
    id: 'pro',
    name: 'Найпотужніша',
    price: '$10 / міс',
    model: 'Найсильніша модель',
    description: 'Складна генерація коду та ігор, вищі ліміти, пріоритет.',
  },
];
