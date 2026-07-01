import { cn } from '../../utils/helpers';

export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  error,
  compact = false,
  className = '',
  ...props
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="block text-base font-semibold text-text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-text-muted text-sm font-medium">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'w-full bg-surface border border-border/60 rounded-lg text-text-primary font-semibold',
            'placeholder:text-text-muted/60 placeholder:font-normal',
            'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40',
            'transition-all duration-150',
            // NOTE: iOS Safari auto-zooms inputs with font-size < 16px.
            // Both modes use text-base (16px) to prevent this. Compact mode uses less padding instead.
            compact ? 'px-3 py-2 text-base' : 'px-3.5 py-2.5 text-base',
            prefix && (compact ? 'pl-7' : 'pl-8'),
            suffix && 'pr-12',
            error && 'border-danger focus:ring-danger/20 focus:border-danger'
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-text-muted text-sm">{suffix}</span>
        )}
      </div>
      {error && <p className="text-base text-danger mt-0.5">{error}</p>}
    </div>
  );
}
