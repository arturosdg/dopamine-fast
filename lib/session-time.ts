export function sessionMinuteChoices(
  maximumMinutes: number,
  initialMinutes: number,
): number[] {
  const maximum = Math.max(1, Math.min(60, Math.round(maximumMinutes)));
  const initial = Math.max(1, Math.min(maximum, Math.round(initialMinutes)));
  return [
    ...new Set([
      1,
      initial,
      maximum,
      ...Array.from({ length: 12 }, (_, index) => (index + 1) * 5),
    ]),
  ]
    .filter((minutes) => minutes <= maximum)
    .sort((left, right) => left - right);
}
