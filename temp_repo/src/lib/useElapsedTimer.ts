import { useEffect, useState } from "react";

export function useElapsedTimer(isRunning: boolean) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  return { elapsedTime, setElapsedTime };
}
