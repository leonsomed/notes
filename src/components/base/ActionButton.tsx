interface ActionButtonProps {
  label: string;
  description: string;
  onClick: () => void;
}

export function ActionButton({
  label,
  description,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-900/40"
    >
      <span className="font-medium text-slate-100">{label}</span>
      <span className="text-xs text-slate-400">{description}</span>
    </button>
  );
}
