"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

/**
 * Thin wrapper around ECharts core with only the pieces we use registered,
 * which keeps the client bundle far smaller than importing all of echarts.
 * Resizes with its container, which matters inside a resizable dashboard tile.
 */
export function EChart({
  option,
  className,
}: {
  option: EChartsCoreOption;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!container.current) return;

    chart.current = echarts.init(container.current, undefined, {
      renderer: "canvas",
    });

    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // `true` replaces the option outright, so removing a series actually
    // removes it instead of merging with the previous one.
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={container} className={className} />;
}
