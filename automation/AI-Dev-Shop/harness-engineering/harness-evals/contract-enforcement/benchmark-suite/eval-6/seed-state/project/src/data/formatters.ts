export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
