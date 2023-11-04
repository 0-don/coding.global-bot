import { ChartConfiguration, ChartDataset } from "chart.js";
import adapter from "date-fns/locale/en-US/index.js";
import { TRANSLATOR } from "./constants.js";

export function placementSuffix(i: number) {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st.";
  }
  if (j == 2 && k != 12) {
    return i + "nd.";
  }
  if (j == 3 && k != 13) {
    return i + "rd.";
  }
  return i + "th.";
}

export const getDaysArray = (s: Date, e: Date) => {
  for (var a = [], d = new Date(s); d <= new Date(e); d.setDate(d.getDate() + 1)) {
    a.push(new Date(d));
  }
  return a;
};

export const codeString = (text: string | number) => "`" + text + "`";

export const translate = async (text: string) => {
  const length = text.split(" ").length;
  if (length < 4) {
    return "Please add more words";
  }
  const translated = await TRANSLATOR.translateText(text, null, "en-GB");
  return translated.text;
};

export const chartConfig = (data: ChartDataset[]) => {
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
          // max: data.length + Math.round((data.length / 100) * 25),
        },
        xAxes: {
          ticks: { color: "#fff" },
          grid: { display: false, drawBorder: false },
          type: "timeseries",
          adapters: {
            date: {
              locale: adapter,
            },
          },
          time: { unit: data.length > 360 ? "month" : "day" },
        },
      },
    },
  } as ChartConfiguration<"line", ChartDataset[]>;
};
