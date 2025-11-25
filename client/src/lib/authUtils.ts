export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `${num.toFixed(3)}%`;
}

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US").format(num);
}

export function getLoanTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    conventional: "Conventional",
    fha: "FHA",
    va: "VA",
  };
  return labels[type] || type;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    analyzing: "Analyzing",
    pre_approved: "Pre-Approved",
    verified: "Verified",
    underwriting: "Underwriting",
    approved: "Approved",
    denied: "Denied",
    closed: "Closed",
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    analyzing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    pre_approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    verified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    underwriting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    denied: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}
