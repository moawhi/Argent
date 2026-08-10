"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { SERIES_PALETTE } from "@/lib/colors/palette";
import { formatValue } from "@/lib/objects/format";
import { formatDate, getByPath } from "@/lib/utils";
import {
  isPieSeriesType,
  type ChartConfig,
  type ChartSeriesConfig,
} from "@/lib/objects/types";

const AXIS_LINE = "#e3e6ee";
const AXIS_TEXT = "#8a90a2";

export function ChartObject({
  config,
  rows,
}: {
  config: ChartConfig;
  rows: Record<string, unknown>[];
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const active = config.series.filter((series) => series.path);
    const pieSeries = active.find((series) => isPieSeriesType(series.type));

    const prepared = config.sortByX
      ? [...rows].sort((a, b) =>
          compareX(getByPath(a, config.xField), getByPath(b, config.xField)),
        )
      : rows;

    if (pieSeries) {
      return buildPieOption(config, prepared, pieSeries, active);
    }

    return buildCartesianOption(config, prepared, active);
  }, [config, rows]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-xs text-ink-faint">
          No data came back for these filters.
        </p>
      </div>
    );
  }

  if (config.series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-xs text-ink-faint">
          Pick at least one value to plot in this chart&apos;s settings.
        </p>
      </div>
    );
  }

  return <EChart option={option} className="h-full w-full" />;
}

function buildPieOption(
  config: ChartConfig,
  prepared: Record<string, unknown>[],
  pieSeries: ChartSeriesConfig,
  active: ChartSeriesConfig[],
): EChartsCoreOption {
  const data = prepared
    .map((row) => {
      const name = axisLabel(getByPath(row, config.xField)) || "—";
      const value = toNumber(getByPath(row, pieSeries.path));
      return value === null ? null : { name, value };
    })
    .filter((entry): entry is { name: string; value: number } => entry !== null);

  const seriesColours = active
    .map((series) => series.color)
    .filter((color): color is string => Boolean(color));
  const colours = [
    ...seriesColours,
    ...SERIES_PALETTE.filter((hex) => !seriesColours.includes(hex)),
  ];

  return {
    animationDuration: 300,
    tooltip: {
      trigger: "item",
      backgroundColor: "#ffffff",
      borderColor: AXIS_LINE,
      textStyle: { color: "#2b3040", fontSize: 11 },
      formatter: (params: unknown) => {
        const point = params as {
          name: string;
          value: number;
          percent: number;
          marker: string;
        };
        const text = formatValue(point.value, pieSeries.format ?? "number");
        return `${point.marker} ${point.name}: <b>${text}</b> (${point.percent}%)`;
      },
    },
    legend: config.legend
      ? {
          show: true,
          type: "scroll",
          bottom: 0,
          icon: "circle",
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: AXIS_TEXT, fontSize: 11 },
        }
      : { show: false },
    color: colours,
    series: [
      {
        name: pieSeries.label,
        type: "pie",
        radius:
          pieSeries.type === "doughnut" ? (["42%", "68%"] as const) : "68%",
        center: ["50%", config.legend ? "46%" : "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: pieSeries.type === "doughnut" ? 4 : 2,
          borderColor: "#ffffff",
          borderWidth: 2,
        },
        label: {
          color: AXIS_TEXT,
          fontSize: 10,
          formatter: "{b}",
        },
        labelLine: { length: 10, length2: 8 },
        data,
      },
    ],
  };
}

function buildCartesianOption(
  config: ChartConfig,
  prepared: Record<string, unknown>[],
  active: ChartSeriesConfig[],
): EChartsCoreOption {
  const categories = prepared.map((row) =>
    axisLabel(getByPath(row, config.xField)),
  );

  const usesRightAxis = active.some((series) => series.axis === "right");
  const allBars = active.every((series) => series.type === "bar");
  const hasScatter = active.some((series) => series.type === "scatter");

  return {
    animationDuration: 300,
    grid: {
      top: config.legend ? 32 : 16,
      left: 8,
      right: usesRightAxis ? 8 : 12,
      bottom: config.showZoom ? 48 : 24,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: hasScatter ? "cross" : "line",
        lineStyle: { color: AXIS_LINE },
      },
      backgroundColor: "#ffffff",
      borderColor: AXIS_LINE,
      textStyle: { color: "#2b3040", fontSize: 11 },
      formatter: (params: unknown) => {
        const points = Array.isArray(params) ? params : [params];
        if (points.length === 0) return "";

        const header = (points[0] as { axisValueLabel?: string })
          .axisValueLabel;
        const lines = points.map((point) => {
          const typed = point as {
            seriesName: string;
            value: number | [string, number | null];
            marker: string;
          };
          const series = active.find(
            (entry) => entry.label === typed.seriesName,
          );
          const raw = Array.isArray(typed.value)
            ? typed.value[1]
            : typed.value;
          const text = formatValue(raw, series?.format ?? "number");
          return `${typed.marker} ${typed.seriesName}: <b>${text}</b>`;
        });

        return `<div style="font-weight:600;margin-bottom:4px">${header ?? ""}</div>${lines.join("<br/>")}`;
      },
    },
    legend: config.legend
      ? {
          show: true,
          top: 0,
          right: 0,
          icon: "roundRect",
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: AXIS_TEXT, fontSize: 11 },
        }
      : { show: false },
    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: allBars || hasScatter,
      axisLine: { lineStyle: { color: AXIS_LINE } },
      axisTick: { show: false },
      axisLabel: { color: AXIS_TEXT, fontSize: 10, hideOverlap: true },
    },
    yAxis: buildYAxes(usesRightAxis),
    dataZoom: config.showZoom
      ? [
          { type: "inside", throttle: 50 },
          {
            type: "slider",
            height: 22,
            bottom: 8,
            borderColor: AXIS_LINE,
            fillerColor: "rgba(59,111,224,0.08)",
            handleStyle: { color: "#ffffff", borderColor: "#b9c0d4" },
            moveHandleSize: 4,
            textStyle: { color: AXIS_TEXT, fontSize: 9 },
          },
        ]
      : undefined,
    series: active.map((series) => {
      const values = prepared.map((row) =>
        toNumber(getByPath(row, series.path)),
      );

      if (series.type === "scatter") {
        return {
          name: series.label,
          type: "scatter" as const,
          yAxisIndex: series.axis === "right" && usesRightAxis ? 1 : 0,
          symbolSize: 9,
          itemStyle: { color: series.color },
          data: values.map((value, index) => [categories[index], value]),
        };
      }

      return {
        name: series.label,
        type: series.type === "bar" ? ("bar" as const) : ("line" as const),
        yAxisIndex: series.axis === "right" && usesRightAxis ? 1 : 0,
        smooth: config.smooth,
        showSymbol: false,
        symbolSize: 5,
        stack: config.stacked ? "total" : undefined,
        barMaxWidth: 28,
        lineStyle: { width: 1.75 },
        itemStyle: { color: series.color },
        areaStyle:
          series.type === "area"
            ? {
                opacity: 0.16,
                color: series.color,
              }
            : undefined,
        data: values,
      };
    }),
  };
}

function buildYAxes(withRight: boolean) {
  const base = {
    type: "value" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: AXIS_LINE, type: "dashed" as const } },
    axisLabel: {
      color: AXIS_TEXT,
      fontSize: 10,
      formatter: (value: number) => compactNumber(value),
    },
  };

  return withRight
    ? [base, { ...base, splitLine: { show: false } }]
    : [base];
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs > 0 && abs < 1) return value.toFixed(2);
  return String(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function axisLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return formatDate(text.slice(0, 10));
  }
  return text;
}

function compareX(a: unknown, b: unknown): number {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }
  return left.localeCompare(right);
}
