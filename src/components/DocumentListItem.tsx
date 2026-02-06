import type { NoteDocument } from "../services/notesDb";

interface DocumentListItemProps {
  document: NoteDocument;
  isSelected: boolean;
  onSelect: () => void;
}

export function DocumentListItem({
  document,
  isSelected,
  onSelect,
}: DocumentListItemProps) {
  const createdAtLabel = new Date(document.createdAt).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left text-sm transition ${
        isSelected
          ? "border-indigo-400 bg-indigo-500/10 text-white"
          : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:text-white"
      }`}
    >
      <span className="font-medium">{document.title}</span>
      <span className="text-xs text-slate-500">{createdAtLabel}</span>
      <span className="flex flex-wrap gap-1 text-xs text-slate-400">
        {document.tags.length > 0 ? (
          document.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-800 bg-slate-900/50 px-2 py-0.5"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="italic text-slate-500">No tags</span>
        )}
      </span>
    </button>
  );
}
