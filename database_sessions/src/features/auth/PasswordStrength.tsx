import { MIN_PASSWORD_LENGTH, estimateStrength } from './validation';

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

export function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return (
      <span>
        Use at least {MIN_PASSWORD_LENGTH} characters. A passphrase of a few words works well.
      </span>
    );
  }
  const score = estimateStrength(password);
  return (
    <span className="strength">
      <meter min={0} max={4} low={2} high={3} optimum={4} value={score} aria-hidden="true" />
      <span>Strength: {LABELS[score]}</span>
    </span>
  );
}
