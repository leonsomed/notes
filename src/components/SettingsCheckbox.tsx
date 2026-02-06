interface SettingsCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function SettingsCheckbox({
  checked,
  onChange,
  disabled = false,
  label = "Enable",
}: SettingsCheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-500"
      />
      {label}
    </label>
  );
}
