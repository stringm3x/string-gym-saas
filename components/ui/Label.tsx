import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-xs font-medium text-text-secondary",
          className
        )}
        {...props}
      >
        {children}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = "Label";
