import { classNames } from '~/utils/classNames';

export interface FileAttachment {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'code';
}

interface FileAttachmentPreviewProps {
  attachments: FileAttachment[];
  onRemove: (id: string) => void;
}

export function FileAttachmentPreview({ attachments, onRemove }: FileAttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border-t border-bolt-elements-borderColor">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="relative group flex items-center gap-2 px-3 py-2 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor"
        >
          {attachment.type === 'image' && attachment.preview ? (
            <img
              src={attachment.preview}
              alt={attachment.file.name}
              className="w-12 h-12 object-cover rounded"
            />
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded bg-bolt-elements-background-depth-4">
              {attachment.type === 'code' ? (
                <div className="i-ph:code text-2xl text-bolt-elements-textSecondary" />
              ) : (
                <div className="i-ph:file-text text-2xl text-bolt-elements-textSecondary" />
              )}
            </div>
          )}
          
          <div className="flex flex-col min-w-0 max-w-[150px]">
            <span className="text-sm text-bolt-elements-textPrimary truncate">
              {attachment.file.name}
            </span>
            <span className="text-xs text-bolt-elements-textTertiary">
              {formatFileSize(attachment.file.size)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:border-red-500"
            title="Remove file"
          >
            <div className="i-ph:x text-xs text-bolt-elements-textPrimary" />
          </button>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
