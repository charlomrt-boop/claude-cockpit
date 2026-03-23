import type { Segment } from "./types";
import { fg, bg, reset, POWERLINE_RIGHT, POWERLINE_RIGHT_ASCII } from "./colors";

export function renderLine(segments: Segment[], powerline: boolean): string {
  if (segments.length === 0) return "";

  const arrow = powerline ? POWERLINE_RIGHT : POWERLINE_RIGHT_ASCII;
  let out = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const content = seg.icon ? `${seg.icon} ${seg.text}` : seg.text;

    out += `${fg(seg.fg)}${bg(seg.bg)} ${content} `;

    if (i < segments.length - 1) {
      const nextBg = segments[i + 1].bg;
      out += `${fg(seg.bg)}${bg(nextBg)}${arrow}`;
    } else {
      out += `${reset()}${fg(seg.bg)}${arrow}${reset()}`;
    }
  }

  return out;
}

export function renderHud(
  line1: Segment[],
  line2: Segment[],
  powerline: boolean,
  layout: "expanded" | "compact"
): string {
  const lines: string[] = [];

  if (layout === "compact") {
    const all = [...line1, ...line2];
    const rendered = renderLine(all, powerline);
    if (rendered) lines.push(rendered);
  } else {
    const r1 = renderLine(line1, powerline);
    if (r1) lines.push(r1);
    const r2 = renderLine(line2, powerline);
    if (r2) lines.push(r2);
  }

  return lines.join("\n");
}
