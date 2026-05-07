import { useCallback, useState } from "react";
import { appendUniqueStatus } from "./logUtils";

export function useMatchGenerationState() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleStatusUpdate = useCallback((status: string) => {
    setLogs((prev) => appendUniqueStatus(prev, status));
  }, []);

  const startGeneration = useCallback((initialLogs: string[]) => {
    setLoading(true);
    setLogs(initialLogs);
    setError("");
  }, []);

  const finishGeneration = useCallback(() => {
    setLoading(false);
  }, []);

  return {
    loading,
    setLoading,
    logs,
    setLogs,
    error,
    setError,
    handleStatusUpdate,
    startGeneration,
    finishGeneration,
  };
}
