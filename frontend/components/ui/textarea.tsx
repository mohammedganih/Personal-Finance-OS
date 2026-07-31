import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
        'focus:outline-none focus:ring-1 focus:ring-accent-violet focus:border-accent-violet',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors duration-200 resize-none',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
