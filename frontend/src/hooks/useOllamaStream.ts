import { useState, useCallback } from 'react';

// Define strict interfaces mirroring our validated API backend expectations
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamOptions {
  systemPrompt?: string;
}

export const useOllamaStream = (backendUrl: string = 'http://127.0.0.1:8000/api/chat/stream') => {
  const [streamData, setStreamData] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Return a promise resolving to the fully accumulated assistant string or null on failure
  const executeStream = useCallback(async (messages: Message[], options?: StreamOptions): Promise<string | null> => {
    setIsStreaming(true);
    setStreamError(null);
    setStreamData('');
    
    // In-memory tracker to collect all text tokens synchronously outside of the React render loop cycle
    let fullyAccumulatedText = '';

    try {
      // Establish native low-memory stream link with our FastAPI middleware layer
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          system_prompt: options?.systemPrompt || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Gateway returned anomalous server response status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream context is completely missing from incoming connection frames.');
      }

      // Read binary chunks off the wire using native browser stream APIs to eliminate window freezing
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let lineBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Decode binary array elements back into a clean string chunk
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');

        // Retain un-terminated line fractions for the next buffer loop iteration pass
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine.startsWith('data: ')) continue;

          try {
            // Trim off the 'data: ' prefix to parse raw JSON payloads
            const rawJsonString = cleanedLine.replace(/^data:\s*/, '');
            const parsedChunk = JSON.parse(rawJsonString);

            if (parsedChunk.error) {
              setStreamError(parsedChunk.error);
              continue;
            }

            if (parsedChunk.token) {
              // Concurrently append to our local variable string context AND the reactive UI state frame
              fullyAccumulatedText += parsedChunk.token;
              setStreamData((prev) => prev + parsedChunk.token);
            }

            if (parsedChunk.done === true) {
              break;
            }
          } catch (e) {
            console.warn('Skipping unparsable line chunk frame alignment.', e);
          }
        }
      }
      
      // Return the completed string buffer upon full exhaustion of the stream socket
      return fullyAccumulatedText;

    } catch (err: unknown) {
      // Safely verify if the caught error matches a standard JavaScript Error instance object
      if (err instanceof Error) {
        setStreamError(err.message);
      } else if (typeof err === 'string') {
        setStreamError(err);
      } else {
        setStreamError('A catastrophic transport failure occurred during token parsing.');
      }
      return null;
    } finally {
      setIsStreaming(false);
    }
  }, [backendUrl]);

  return {
    streamData,
    isStreaming,
    streamError,
    executeStream,
    clearStream: () => setStreamData('')
  };
};