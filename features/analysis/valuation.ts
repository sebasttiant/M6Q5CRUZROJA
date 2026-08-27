export function calculateValuation(impacts: ReadonlyArray<number | null | undefined>): number {
  const completed = impacts.filter((impact): impact is number => impact !== null && impact !== undefined);
  if (completed.length === 0) return 0;
  return completed.reduce((total, impact) => total * impact, 1);
}
