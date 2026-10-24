import { useId, type ReactNode } from 'react';
import { formatLocal, formatTime, formatUtc } from '../lib/format';

/** Hover/focus tooltip. The trigger is focusable so keyboard users can reach the text too. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tooltip" tabIndex={0} aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="tooltip-text">
        {text}
      </span>
    </span>
  );
}

/** Local time with the UTC value in a tooltip (PRD 6.4). */
export function DateTime({
  iso,
  timeOnly = false,
}: {
  iso: string | null | undefined;
  timeOnly?: boolean;
}) {
  if (!iso) return <span className="muted">—</span>;
  return (
    <Tooltip text={formatUtc(iso)}>
      <time dateTime={iso}>{timeOnly ? formatTime(iso) : formatLocal(iso)}</time>
    </Tooltip>
  );
}
