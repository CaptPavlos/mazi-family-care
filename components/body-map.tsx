"use client";
import type { Condition, Lang, Region } from "@/lib/model";
import { dictionary, regionLabels } from "@/lib/i18n";
const points: Record<Region, [number, number]> = {
  "right-eye": [116, 54],
  "left-eye": [144, 54],
  heart: [146, 149],
  "right-lung": [108, 139],
  "left-lung": [153, 139],
  abdomen: [130, 237],
  "left-hip": [157, 264],
  "right-hip": [104, 264],
  body: [130, 196],
};
export default function BodyMap({
  conditions,
  selected,
  onSelect,
  lang,
  back,
}: {
  conditions: Condition[];
  selected: string;
  onSelect: (id: string) => void;
  lang: Lang;
  back: boolean;
}) {
  const t = dictionary[lang];
  return (
    <div className="body-diagram">
      <div className="body-side left-side">{back ? t.left : t.right}</div>
      <div className="body-side right-side">{back ? t.right : t.left}</div>
      <svg viewBox="0 0 260 460" role="img" aria-label={t.bodyMap}>
        <defs>
          <linearGradient id="body-fill" x1="0" x2="1">
            <stop stopColor="#dce8e5" />
            <stop offset=".5" stopColor="#f4f8f6" />
            <stop offset="1" stopColor="#dce8e5" />
          </linearGradient>
        </defs>
        <g
          fill="url(#body-fill)"
          stroke="#b7cdc6"
          strokeWidth="1.4"
          strokeLinejoin="round"
        >
          <path d="M130 17c-19 0-27 13-26 32 0 14 7 29 16 33l-1 17-31 12c-10 5-16 15-19 29L53 207l-10 51-9 28c-2 8 2 12 6 6l8-12-3 23c0 6 5 6 7 0l8-25 7-29 17-50 10-36 4 62-8 38 10 79 8 81-3 22c-1 7 26 7 26 0l-2-26 1-68 0-61 0 61 1 68-2 26c0 7 27 7 26 0l-3-22 8-81 10-79-8-38 4-62 10 36 17 50 7 29 8 25c2 6 7 6 7 0l-3-23 8 12c4 6 8 2 6-6l-9-28-10-51-16-67c-3-14-9-24-19-29l-31-12-1-17c9-4 16-19 16-33 1-19-7-32-26-32Z" />
        </g>
        <g fill="none" stroke="#bdd0c9" strokeWidth="1" opacity=".7">
          <path d="M120 99q10 5 20 0M97 116q33 17 66 0M130 120v100M102 223q28 14 56 0M101 260l29 21 29-21M112 336h10M138 336h10" />
          {!back && (
            <>
              <path d="M112 57h8M140 57h8M125 72q5 3 10 0" />
              <path d="M118 133c-16-3-20 20-20 34s18 12 22 3v-25M142 133c16-3 20 20 20 34s-18 12-22 3v-25" />
            </>
          )}
        </g>
        {conditions.map((c, i) => {
          const p = points[c.region];
          const same = conditions.filter(
            (v, j) => j < i && v.region === c.region,
          ).length;
          const x = (back ? 260 - p[0] : p[0]) + same * 20;
          return (
            <g
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`${t[regionLabels[c.region]]}: ${c.title[lang]}`}
              aria-pressed={selected === c.id}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(c.id);
                }
              }}
              className={`body-marker ${c.status} ${selected === c.id ? "selected" : ""}`}
            >
              <title>{c.title[lang]}</title>
              <circle cx={x} cy={p[1]} r="19" className="marker-halo" />
              <circle cx={x} cy={p[1]} r="11" />
              <text x={x} y={p[1] + 4} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <span className="body-caption">{t.patientSides}</span>
    </div>
  );
}
