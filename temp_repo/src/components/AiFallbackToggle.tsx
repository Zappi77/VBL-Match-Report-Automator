interface AiFallbackToggleProps {
  allowAiFallback: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function AiFallbackToggle({ allowAiFallback, onChange, disabled = false }: AiFallbackToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-600 ml-2">
      <input
        type="checkbox"
        checked={allowAiFallback}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      KI-Fallback erlauben
    </label>
  );
}
