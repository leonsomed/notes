interface TopBannerProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function TopBanner({ message, actionLabel, onAction }: TopBannerProps) {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-200/60 bg-amber-400 px-6 py-4 text-slate-900 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">
          {message}
        </p>
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:bg-slate-800"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
