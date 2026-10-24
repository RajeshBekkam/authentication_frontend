/** Rough, display-only device label from a User-Agent string. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';

  const browser =
    match(ua, /Edg(?:e|A|iOS)?\/[\d.]+/, 'Edge') ??
    match(ua, /OPR\/[\d.]+/, 'Opera') ??
    match(ua, /Firefox\/[\d.]+|FxiOS/, 'Firefox') ??
    match(ua, /Chrome\/[\d.]+|CriOS/, 'Chrome') ??
    match(ua, /Version\/[\d.]+.*Safari/, 'Safari') ??
    match(ua, /curl\//i, 'curl') ??
    match(ua, /PostmanRuntime/, 'Postman') ??
    null;

  const os =
    match(ua, /iPhone|iPad|iPod/, 'iOS') ??
    match(ua, /Android/, 'Android') ??
    match(ua, /Windows/, 'Windows') ??
    match(ua, /Mac OS X|Macintosh/, 'macOS') ??
    match(ua, /CrOS/, 'ChromeOS') ??
    match(ua, /Linux/, 'Linux') ??
    null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown device';
}

function match(ua: string, pattern: RegExp, label: string): string | null {
  return pattern.test(ua) ? label : null;
}
