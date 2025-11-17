import { ChartConfiguration, ChartDataset } from "chart.js";
import { enUS } from "date-fns/locale";
import { ConfigValidator } from "./config-validator";
import { TRANSLATOR } from "./constants";

export const JOB_POST_REGEX =
  /Project Title:[\s\S]*?(?=Project Description:|$)Project Description:[\s\S]*?(?=Required Skills:|$)Required Skills:[\s\S]*?(?=Budget Range:|$)Budget Range:[\s\S]*?(?=Timeline:|$)Timeline:[\s\S]*?(?=Contact Method:|$)Contact Method:[\s\S]*?(?=Additional Details:|$)Additional Details:[\s\S]*$/;

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
  for (
    var a = [], d = new Date(s);
    d <= new Date(e);
    d.setDate(d.getDate() + 1)
  ) {
    a.push(new Date(d));
  }
  return a;
};

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const codeString = (text: string | number) => "`" + text + "`";

export const translate = async (text: string) => {
  if (!ConfigValidator.isFeatureEnabled("DEEPL")) {
    ConfigValidator.logFeatureDisabled("Translation", "DEEPL");
    return;
  }

  const length = text.split(" ").length;
  if (length < 4) {
    return "Please add 5 or more words to translate.";
  }
  const translated = await TRANSLATOR?.translateText(text, null, "en-GB");
  return translated?.text;
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
              locale: enUS,
            },
          },
          time: { unit: data.length > 360 ? "month" : "day" },
        },
      },
    },
  } as ChartConfiguration<"line", ChartDataset[]>;
};
