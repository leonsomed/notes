import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "outline" | "soft" | "solid";
type ButtonTone = "neutral" | "primary" | "danger";
type ButtonSize = "xs" | "xsWide" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-3 py-1 text-xs",
  xsWide: "px-4 py-1 text-xs",
  sm: "px-4 py-2 text-sm",
};

const variantClasses: Record<ButtonVariant, Record<ButtonTone, string>> = {
  outline: {
    neutral: "border border-slate-700 text-slate-200 hover:border-slate-400",
    primary: "border border-indigo-500 text-indigo-100 hover:border-indigo-400",
    danger: "border border-rose-500 text-rose-200 hover:border-rose-400",
  },
  soft: {
    neutral:
      "border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60",
    primary:
      "border border-indigo-500 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20",
    danger:
      "border border-rose-500 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  },
  solid: {
    neutral: "bg-slate-700 text-slate-100 hover:bg-slate-600",
    primary:
      "bg-indigo-500 text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/60",
    danger: "bg-rose-500 text-white hover:bg-rose-400",
  },
};

export function Button({
  variant = "outline",
  tone = "neutral",
  size = "xs",
  fullWidth = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "rounded-full transition",
    sizeClasses[size],
    variantClasses[variant][tone],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...rest} />;
}
