import { createCanvas } from "canvas";
import { Chart, ChartConfiguration } from "chart.js";
import { enUS } from "date-fns/locale";
import { ChartDataPoint } from "@/types";

export const GLOBAL_CANVAS = createCanvas(1200, 400);
export const CHARTJS_NODE_CANVAS = GLOBAL_CANVAS.getContext("2d");

let _GLOBAL_CHART: Chart<"line", ChartDataPoint[]> | null = null;
let _CHART_INITIALIZED = false;

export const ChartManager = {
  getChart: () => _GLOBAL_CHART,
  isInitialized: () => _CHART_INITIALIZED,

  initializeOrUpdate: (
    config: ChartConfiguration<"line", ChartDataPoint[]>,
  ): Chart<"line", ChartDataPoint[]> => {
    if (_GLOBAL_CHART && _CHART_INITIALIZED) {
      _GLOBAL_CHART.data = config.data;
      if (config.options) {
        _GLOBAL_CHART.options = config.options;
      }
      _GLOBAL_CHART.update("none");
      return _GLOBAL_CHART;
    }

    if (_GLOBAL_CHART) {
      _GLOBAL_CHART.destroy();
    }
    _GLOBAL_CHART = new Chart(CHARTJS_NODE_CANVAS as any, config);
    _CHART_INITIALIZED = true;
    return _GLOBAL_CHART;
  },

  setChart: (chart: Chart<"line", ChartDataPoint[]> | null) => {
    if (_GLOBAL_CHART) {
      _GLOBAL_CHART.destroy();
    }
    _GLOBAL_CHART = chart;
    _CHART_INITIALIZED = chart !== null;
  },

  destroyChart: () => {
    if (_GLOBAL_CHART) {
      _GLOBAL_CHART.destroy();
      _GLOBAL_CHART = null;
      _CHART_INITIALIZED = false;
    }
  },
};

export const chartConfig = (data: ChartDataPoint[]) => {
  return {
    type: "line",
    data: {
      datasets: [
        {
          data,
          fill: true,
          backgroundColor: "#495170",
          borderColor: "#6f86d4",
        },
      ],
    },
    plugins: [
      {
        id: "customCanvasBackgroundColor",
        beforeDraw: (chart, _args, options) => {
          const { ctx } = chart;
          ctx.save();
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = options.color || "#34363c";
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
    options: {
      showLine: true,
      elements: {
        point: {
          radius: 0,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        customCanvasBackgroundColor: {
          color: "#34363c",
        },
      },

      scales: {
        yAxes: {
          ticks: { color: "#fff" },
          grid: { color: "#e6e6e6", z: 100, drawBorder: false },
        },
        xAxes: {
          ticks: { color: "#fff" },
          grid: { display: false, drawBorder: false },
          type: "timeseries",
          adapters: {
            date: {
              locale: enUS,
            },
          },
          time: { unit: data.length > 360 ? "month" : "day" },
        },
      },
    },
  } as ChartConfiguration<"line", ChartDataPoint[]>;
};
