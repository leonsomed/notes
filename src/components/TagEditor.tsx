import { useEffect, useMemo, useState } from "react";
import { TextInput } from "./TextInput";
import { TagPill } from "./TagPill";
import { normalizeTag, tagKey } from "../utils/tags";

interface TagEditorProps {
  tags: string[];
  suggestions: string[];
  onCommitTag: (value: string) => void | Promise<void>;
  onRemoveTag: (tag: string) => void | Promise<void>;
}

export function TagEditor({
  tags,
  suggestions,
  onCommitTag,
  onRemoveTag,
}: TagEditorProps) {
  const [draftTag, setDraftTag] = useState("");
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);

  const visibleTagSuggestions = useMemo(() => {
    if (draftTag === "/") return suggestions;
    const query = normalizeTag(draftTag);
    if (!query) return suggestions;
    const queryKey = tagKey(query);
    return suggestions.filter((tag) => tagKey(tag).startsWith(queryKey));
  }, [draftTag, suggestions]);

  useEffect(() => {
    if (!isTagInputFocused || visibleTagSuggestions.length === 0) {
      setActiveTagIndex(-1);
      return;
    }
    setActiveTagIndex((current) =>
      current >= visibleTagSuggestions.length ? -1 : current,
    );
  }, [isTagInputFocused, visibleTagSuggestions]);

  const commitTag = (value: string) => {
    const normalized = normalizeTag(value);
    if (!normalized) return;
    void onCommitTag(normalized);
    setDraftTag("");
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {tags.length > 0 ? (
        tags.map((tag) => (
          <TagPill
            key={tag}
            tag={tag}
            variant="editor"
            onRemove={onRemoveTag}
          />
        ))
      ) : (
        <span className="text-xs text-slate-500">No tags yet.</span>
      )}
      <div className="relative min-w-40">
        <TextInput
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          onFocus={() => setIsTagInputFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              if (visibleTagSuggestions.length === 0) return;
              event.preventDefault();
              setActiveTagIndex((current) =>
                current < 0
                  ? 0
                  : Math.min(current + 1, visibleTagSuggestions.length - 1),
              );
              return;
            }
            if (event.key === "ArrowUp") {
              if (visibleTagSuggestions.length === 0) return;
              event.preventDefault();
              setActiveTagIndex((current) =>
                current < 0
                  ? visibleTagSuggestions.length - 1
                  : Math.max(current - 1, 0),
              );
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftTag("");
              setIsTagInputFocused(false);
              setActiveTagIndex(-1);
              event.currentTarget.blur();
              return;
            }
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              if (activeTagIndex >= 0) {
                commitTag(visibleTagSuggestions[activeTagIndex]);
              } else {
                commitTag(draftTag);
              }
            }
          }}
          onBlur={() => {
            setIsTagInputFocused(false);
            setActiveTagIndex(-1);
            if (draftTag.trim()) commitTag(draftTag);
          }}
          placeholder="/ to show all tags"
          className="w-full px-2 py-1 text-xs text-slate-200"
        />
        {isTagInputFocused &&
        (draftTag.trim() || draftTag === "/") &&
        visibleTagSuggestions.length > 0 ? (
          <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 shadow-lg">
            {visibleTagSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitTag(tag);
                }}
                className={`w-full px-2 py-1 text-left transition hover:bg-slate-900/60 ${
                  activeTagIndex >= 0 &&
                  visibleTagSuggestions[activeTagIndex] === tag
                    ? "bg-slate-900/60"
                    : ""
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
