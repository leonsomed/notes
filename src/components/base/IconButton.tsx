import type { ButtonHTMLAttributes } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  ariaLabel: string;
};

export function IconButton({
  ariaLabel,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = ["rounded-full transition", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} aria-label={ariaLabel} {...rest}>
      ×
    </button>
  );
}
