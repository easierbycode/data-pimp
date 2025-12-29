// Utility functions for the Data-Pimp application
// Deno Deploy compatible

/**
 * Creates a URL path for navigating to a specific page in the application.
 * Supports query parameters when passed as "PageName?param=value" format.
 *
 * @param pageName - The name of the page, optionally with query params
 * @returns The URL path for the page
 */
export function createPageUrl(pageName: string): string {
  // Check if pageName includes query parameters
  if (pageName.includes("?")) {
    const [page, queryString] = pageName.split("?");
    return `/${page.toLowerCase()}?${queryString}`;
  }

  return `/${pageName.toLowerCase()}`;
}

/**
 * Formats a date string for display
 * @param dateStr - ISO date string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  dateStr: string | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", options);
}

/**
 * Formats a price for display
 * @param price - The price number
 * @returns Formatted price string
 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null) return "—";
  return `$${Number(price).toFixed(2)}`;
}

/**
 * Generates a unique ID
 * @returns A unique string ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Debounce function for search inputs
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Classnames utility for conditional class strings
 * @param classes - Class names to combine
 * @returns Combined class string
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Checks if an item has the lowest price online
 * @param item - The item with current_price and best_price
 * @returns True if current price is lower than best price
 */
export function hasLowestPrice(item: { current_price?: number | null; best_price?: number | null }): boolean {
  if (item?.current_price === null || item?.current_price === undefined) return false;
  if (item?.best_price === null || item?.best_price === undefined) return false;
  return item.current_price < item.best_price;
}

export default {
  createPageUrl,
  formatDate,
  formatPrice,
  generateId,
  debounce,
  cn,
  hasLowestPrice,
};
