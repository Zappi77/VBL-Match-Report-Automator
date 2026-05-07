import { useEffect, useState } from "react";

export function useLocalStorageBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      setValue(saved === "true");
    }
  }, [key]);

  useEffect(() => {
    localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue] as const;
}
