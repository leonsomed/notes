import type { ReactNode } from "react";

type DialogSize = "sm" | "md";
type DialogZIndex = 40 | 50;

interface DialogProps {
  titleId: string;
  size?: DialogSize;
  zIndex?: DialogZIndex;
  children: ReactNode;
}

const sizeClassNames: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
};

const zIndexClassNames: Record<DialogZIndex, string> = {
  40: "z-40",
  50: "z-50",
};

export function Dialog({
  titleId,
  size = "sm",
  zIndex = 50,
  children,
}: DialogProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndexClassNames[zIndex]} flex items-center justify-center bg-slate-950/70 px-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`w-full ${sizeClassNames[size]} rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-xl`}
      >
        {children}
      </div>
    </div>
  );
}
