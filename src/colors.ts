export const POWERLINE_RIGHT = "\uE0B0";
export const POWERLINE_RIGHT_ASCII = ">";

export function fg(color: number): string {
  return `\x1b[38;5;${color}m`;
}

export function bg(color: number): string {
  return `\x1b[48;5;${color}m`;
}

export function reset(): string {
  return "\x1b[0m";
}

export function segment(text: string, fgColor: number, bgColor: number): string {
  return `${fg(fgColor)}${bg(bgColor)} ${text} `;
}

// Named color constants (ANSI 256)
export const COLORS = {
  blue: 33,
  green: 34,
  yellow: 220,
  red: 196,
  cyan: 44,
  magenta: 129,
  gray: 245,
  darkGray: 240,
  orange: 208,
  teal: 30,
  white: 255,
  black: 0,
} as const;
