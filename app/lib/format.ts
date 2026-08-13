export function formatMeters(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
