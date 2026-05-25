import { useState, useCallback } from 'react';

// Define strict interfaces mirroring our validated API backend expectations
export interface Citation {
  source: string;
  score: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
}

interface StreamOptions {
  systemPrompt?: string;
  rag_mode?: 'global' | 'strict' | 'off';
  target_file?: string | null;
  temperature?: number;
  model?: string;
}

// Define explicit model structure for internal telemetry updates
export interface TelemetryMetrics {
  rag_matched: boolean;
  rag_blocks_found: number;
  web_triggered: boolean;
  web_fragments_ingested: number;
  total_payload_chars: number;
  history_pruned: boolean;
  pruned_count: number;
}

export const useOllamaStream = (backendUrl: string = 'http://127.0.0.1:8000/api/chat/stream') => {
  const [streamData, setStreamData] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  
  // Captures structural database metrics and live text updates emitted down the wire
  const [telemetryData, setTelemetryData] = useState<TelemetryMetrics | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<string | null>(null);

  // Return a promise resolving to the fully accumulated assistant string or null on failure
  const executeStream = useCallback(async (
    messages: Message[], 
    options?: StreamOptions,
    onCitations?: (citations: Citation[]) => void
  ): Promise<string | null> => {
    setIsStreaming(true);
    setStreamError(null);
    setStreamData('');
    setTelemetryData(null);
    setStatusUpdate("Initializing transaction channel...");
    
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
          model: options?.model || 'llama3.1',
          messages: messages,
          temperature: options?.temperature ?? 0.4,
          rag_mode: options?.rag_mode || 'global',
          target_file: options?.target_file || null,
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

            // Extract custom data frames based on contract properties
            if (parsedChunk.status_update) {
              setStatusUpdate(parsedChunk.status_update);
              continue;
            }

            if (parsedChunk.citations) {
              if (onCitations) onCitations(parsedChunk.citations);
              continue;
            }

            if (parsedChunk.telemetry) {
              setTelemetryData(parsedChunk.telemetry);
              continue; // Intercepted cleanly, bypass token compiler paths
            }

            if (parsedChunk.token) {
              // Concurrently append to our local variable string context AND the reactive UI state frame
              fullyAccumulatedText += parsedChunk.token;
              setStreamData((prev) => prev + parsedChunk.token);
            }

            if (parsedChunk.done === true) {
              setStatusUpdate(null);
              break;
            }
          } catch  {
            // Ignore incomplete multi-byte framing issues or parsing failures silently
          }
        }
      }
      
      // Return the completed string buffer upon full exhaustion of the stream socket
      return fullyAccumulatedText;

    } catch (err: unknown) {
      console.error("Stream break error:", err);
      // Safely verify if the caught error matches a standard JavaScript Error instance object
      if (err instanceof Error) {
        setStreamError(err.message);
      } else if (typeof err === 'string') {
        setStreamError(err);
      } else {
        setStreamError('A catastrophic transport failure occurred during token parsing.');
      }
      setStatusUpdate(null);
      return null;
    } finally {
      setIsStreaming(false);
    }
  }, [backendUrl]);

  return {
    streamData,
    isStreaming,
    streamError,
    telemetryData,
    statusUpdate, // Exposed to UI viewports to render the animated agent thinking status blocks
    executeStream,
    clearStream: () => {
      setStreamData('');
      setTelemetryData(null);
      setStatusUpdate(null);
    }
  };
};