import { useState, useEffect } from 'react';

// 1. Define the data shape matching your FastAPI backend dictionary
interface TelemetryData {
  vram_usage: string;
  cache_hits: number;
  status: string;
}

export const useTelemetry = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 2. Point to your new FastAPI SSE stream endpoint
    // Note: If you're using a dev server proxy, '/api/telemetry' is perfect. 
    // Otherwise, use the full URL: 'http://127.0.0.1:8000/api/telemetry'
    const eventSource = new EventSource('/api/telemetry');

    // 3. Listen for incoming SSE frames
    eventSource.onmessage = (event) => {
      try {
        const metrics: TelemetryData = JSON.parse(event.data);
        setTelemetry(metrics);
        setError(null);
      } catch (err) {
        console.error("Failed to parse telemetry payload:", err);
      }
    };

    // 4. Handle connection issues gracefully
    eventSource.onerror = () => {
      setError("Telemetry stream disconnected. Attempting reconnect...");
    };

    // 5. Clean up the connection when the component unmounts
    return () => {
      eventSource.close();
    };
  }, []);

  return { telemetry, error };
};