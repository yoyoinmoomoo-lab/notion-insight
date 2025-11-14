declare module "react-heatmap-grid" {
  import { CSSProperties } from "react";

  export interface HeatmapGridProps {
    data: number[][];
    xLabels?: string[];
    yLabels?: string[];
    xLabelWidth?: number;
    yLabelWidth?: number;
    cellStyle?: (
      background: string,
      value: number,
      min: number,
      max: number,
      data: number,
      x: number,
      y: number
    ) => CSSProperties;
    cellRender?: (value: number) => string | number;
    square?: boolean;
  }

  export const HeatmapGrid: React.FC<HeatmapGridProps>;
}

