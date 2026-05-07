interface ErrorAlertProps {
  error: string;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;

  const message = (() => {
    try {
      const parsed = JSON.parse(error);
      return parsed.error || error;
    } catch {
      return error;
    }
  })();

  return (
    <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 mb-8 font-medium">
      {message}
    </div>
  );
}
