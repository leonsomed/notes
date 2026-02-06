import { forwardRef, type InputHTMLAttributes } from "react";

type AllowedInputType = "text" | "password" | "number";
type InputVariant = "default" | "bare";

interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  type?: AllowedInputType;
  variant?: InputVariant;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ type = "text", variant = "default", className, ...props }, ref) => {
    const baseClassName =
      variant === "bare"
        ? "bg-transparent outline-none"
        : "rounded-lg border border-slate-800 bg-transparent outline-none transition focus:border-indigo-400";
    const combinedClassName = className
      ? `${baseClassName} ${className}`
      : baseClassName;

    return (
      <input
        ref={ref}
        type={type}
        className={combinedClassName}
        {...props}
      />
    );
  },
);

TextInput.displayName = "TextInput";
