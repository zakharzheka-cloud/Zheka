import type { Conversation } from '../types';

// App starts with a single empty conversation — no fake history, same
// as opening a fresh chat in Claude/ChatGPT for the first time.
export const mockConversations: Conversation[] = [
  {
    id: 'c1',
    title: 'Нова розмова',
    messages: [],
  },
];
