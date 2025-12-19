import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface TextContent {
  type: 'text';
  text: string;
}

type MessageContent = string | Array<TextContent | ImageContent>;

interface Message {
  role: 'user' | 'assistant';
  content: MessageContent;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export function streamText(messages: Messages, env: Env, options?: StreamingOptions) {
  // Convert messages to the format expected by the AI SDK
  const formattedMessages = messages.map((msg) => {
    // If content is already a string, keep it as is
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: msg.content,
        toolInvocations: msg.toolInvocations,
      };
    }
    
    // If content is an array (multimodal), convert to AI SDK format
    return {
      role: msg.role,
      content: msg.content.map((item) => {
        if (item.type === 'text') {
          return {
            type: 'text' as const,
            text: item.text,
          };
        } else {
          return {
            type: 'image' as const,
            image: item.source.data,
            mimeType: item.source.media_type,
          };
        }
      }),
      toolInvocations: msg.toolInvocations,
    };
  });

  return _streamText({
    model: getAnthropicModel(getAPIKey(env)),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: formattedMessages as any,
    ...options,
  });
}
