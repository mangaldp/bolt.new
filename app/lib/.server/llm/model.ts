import { createAnthropic } from '@ai-sdk/anthropic';

export function getAnthropicModel(apiKey: string) {
  const anthropic = createAnthropic({
    apiKey,
  });

  // return anthropic('claude-3-5-sonnet-20240620');
  return anthropic('claude-sonnet-4-5');
}
