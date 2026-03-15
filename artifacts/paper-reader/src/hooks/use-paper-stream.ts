import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPaperSectionQueryKey } from '@workspace/api-client-react';
import { useApiKey } from './use-api-key';

export function usePaperSectionStream(paperId: number, sectionKey: string) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const { headers: apiKeyHeaders } = useApiKey();

  // Reset state when navigating to a different section so a previous error
  // doesn't block auto-generation on the next section.
  useEffect(() => {
    setContent('');
    setError(null);
    setIsStreaming(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [sectionKey]);

  const streamSection = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsStreaming(true);
    setContent('');
    setError(null);

    try {
      const response = await fetch(`/api/papers/${paperId}/sections/${sectionKey}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiKeyHeaders,
        },
        signal: abortController.signal
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to start generation stream');
      }

      if (!response.body) {
        throw new Error('No stream body available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                accumulatedContent += data.content;
                setContent(accumulatedContent);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) {
                throw e;
              }
            }
          }
        }
      }
      
      queryClient.invalidateQueries({
        queryKey: getGetPaperSectionQueryKey(paperId, sectionKey)
      });
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        setError(err.message || 'An error occurred during generation');
        console.error('Stream error:', err);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [paperId, sectionKey, queryClient, apiKeyHeaders]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  return { 
    streamSection, 
    stopStream,
    content, 
    isStreaming, 
    error 
  };
}
