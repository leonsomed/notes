interface TabButtonsOption<TabId extends string> {
  id: TabId;
  label: string;
}

interface TabButtonsProps<TabId extends string> {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  tabs: TabButtonsOption<TabId>[];
  ariaLabel?: string;
  className?: string;
}

export function TabButtons<TabId extends string>({
  activeTab,
  onChange,
  tabs,
  ariaLabel = "Tabs",
  className,
}: TabButtonsProps<TabId>) {
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-800 bg-slate-950/70 p-1 ${
        className ?? ""
      }`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            activeTab === tab.id
              ? "bg-slate-900 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
