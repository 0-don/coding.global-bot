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

  const response = await fetch(QUICKCHART_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "4",
      chart: config,
      width: 1200,
      height: 400,
      backgroundColor: "#34363c",
      format: "png",
    }),
  });

  if (!response.ok) {
    throw new Error(`QuickChart request failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
