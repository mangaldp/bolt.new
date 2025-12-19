import { useState, useRef, useEffect } from 'react';
import { classNames } from '~/utils/classNames';

interface AttachmentDropdownProps {
  onFileSelect: (files: File[]) => void;
  onEnhancePrompt: () => void;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  disabled?: boolean;
  inputLength?: number;
}

export function AttachmentDropdown({
  onFileSelect,
  onEnhancePrompt,
  enhancingPrompt = false,
  promptEnhanced = false,
  disabled = false,
  inputLength = 0,
}: AttachmentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFileSelect(files);
      setIsOpen(false);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEnhanceClick = () => {
    onEnhancePrompt();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={classNames(
          'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
          'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        title="Attach file or enhance prompt"
      >
        <div className="i-ph:plus text-lg text-bolt-elements-textPrimary" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-56 rounded-lg shadow-lg border border-bolt-elements-borderColor overflow-hidden z-50"
          style={{ backgroundColor: '#2a2a2a' }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
            style={{ color: '#e0e0e0', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3a3a3a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div className="i-ph:paperclip text-xl" style={{ color: '#a0a0a0' }} />
            <span className="font-medium">Attach file</span>
          </button>

          {inputLength > 0 && (
            <button
              type="button"
              onClick={handleEnhanceClick}
              disabled={enhancingPrompt}
              className={classNames(
                'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{ 
                color: promptEnhanced ? '#7c3aed' : '#e0e0e0'
              }}
              onMouseEnter={(e) => !enhancingPrompt && (e.currentTarget.style.backgroundColor = '#3a3a3a')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div className="i-bolt:stars text-xl" style={{ color: '#a0a0a0' }} />
              <span className="font-medium">
                {enhancingPrompt ? 'Enhancing...' : 'Enhance prompt'}
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.txt,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.html,.css,.json,.xml,.md"
            multiple
          />
        </div>
      )}
    </div>
  );
}
