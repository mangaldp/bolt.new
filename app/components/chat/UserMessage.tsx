import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';

interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

type MessageContent = string | Array<TextContent | ImageContent>;

interface UserMessageProps {
  content: MessageContent;
}

export function UserMessage({ content }: UserMessageProps) {
  // Handle multimodal content (array with text and images)
  if (Array.isArray(content)) {
    return (
      <div className="overflow-hidden pt-[4px]">
        {content.map((item, index) => {
          if (item.type === 'text') {
            return <Markdown key={index} limitedMarkdown>{sanitizeUserMessage(item.text)}</Markdown>;
          } else if (item.type === 'image') {
            return (
              <div key={index} className="my-2">
                <img 
                  src={`data:${item.source.media_type};base64,${item.source.data}`}
                  alt="Uploaded image"
                  className="max-w-full rounded-lg border border-bolt-elements-borderColor"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }
  
  // Handle simple string content
  return (
    <div className="overflow-hidden pt-[4px]">
      <Markdown limitedMarkdown>{sanitizeUserMessage(content)}</Markdown>
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').trim();
}
