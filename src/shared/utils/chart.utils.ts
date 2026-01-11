import { ChartDataPoint } from "@/types";

const QUICKCHART_URL = "https://quickchart.io/chart";

export const chartConfig = (data: ChartDataPoint[]) => {
  return {
    type: "line",
    data: {
      datasets: [
        {
          data: data.map((d) => ({ x: d.x.toISOString(), y: d.y })),
          fill: true,
          backgroundColor: "#495170",
          borderColor: "#6f86d4",
        },
      ],
    },
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
      },
      scales: {
        y: {
          ticks: { color: "#fff" },
          grid: { color: "#e6e6e6" },
        },
        x: {
          ticks: { color: "#fff" },
          grid: { display: false },
          type: "timeseries",
          time: { unit: data.length > 360 ? "month" : "day" },
        },
      },
    },
  };
};

export async function generateChart(data: ChartDataPoint[]): Promise<Buffer> {
  const config = chartConfig(data);

  const params = new URLSearchParams({
    c: JSON.stringify(config),
    w: "1200",
    h: "400",
    bkg: "#34363c",
    f: "png",
  });

  const response = await fetch(`${QUICKCHART_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`QuickChart request failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
