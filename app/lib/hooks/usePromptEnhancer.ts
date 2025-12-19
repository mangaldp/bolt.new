import { useState } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (input: string, setInput: (value: string) => void) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const originalInput = input;

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`Enhancement failed with status: ${response.status}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Response body reader is not available');
      }

      const decoder = new TextDecoder();
      let _input = '';

      setInput('');

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        
        // Filter out any [object Object] artifacts that might slip through
        const cleanChunk = chunk.replace(/\[object Object\]/g, '');
        
        _input += cleanChunk;

        logger.trace('Set input', _input);

        setInput(_input);
      }

      // Final cleanup: ensure no object artifacts in final output
      const finalInput = _input.replace(/\[object Object\]/g, '').trim();
      
      if (finalInput) {
        setInput(finalInput);
      } else {
        // If enhancement resulted in empty string, restore original
        logger.warn('Enhancement resulted in empty output, restoring original');
        setInput(originalInput);
      }

      setPromptEnhanced(true);
    } catch (error) {
      logger.error('Enhancement error:', error);
      setInput(originalInput);
      setPromptEnhanced(false);
    } finally {
      setEnhancingPrompt(false);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
