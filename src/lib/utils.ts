/** Clase condicional: cn('base', cond && 'active', 'always') */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
