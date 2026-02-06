import { IconButton } from "./IconButton";

interface TagPillProps {
  tag: string;
  variant?: "editor" | "list";
  onRemove?: (tag: string) => void | Promise<void>;
  className?: string;
}

const variantClasses: Record<NonNullable<TagPillProps["variant"]>, string> = {
  editor: "bg-slate-900/40 px-2 py-1 text-slate-300",
  list: "bg-slate-900/50 px-2 py-0.5",
};

export function TagPill({
  tag,
  variant = "list",
  onRemove,
  className,
}: TagPillProps) {
  const classes = [
    "inline-flex items-center gap-1 rounded-full border border-slate-800 text-xs",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <span>{tag}</span>
      {onRemove ? (
        <IconButton
          onClick={() => {
            void onRemove(tag);
          }}
          className="px-1 text-slate-500 hover:text-rose-300"
          ariaLabel={`Remove ${tag} tag`}
        />
      ) : null}
    </span>
  );
}
