import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('⚠️ OpenAI API 키가 설정되지 않았습니다. (OPENAI_API_KEY)');
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;
export const defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

