import { createCanvas } from "canvas";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import {
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import "dotenv/config";
import { writeFileSync } from "fs";
import "./deploy-commands.js";
import "./types/index.js";
import { filesPaths } from "./utils/helpers.js";

const token = process.env.TOKEN;

// discord client config
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.GuildScheduledEvent,
    Partials.User,
  ],
});

const main = async () => {
  // add slash commands on client globally
  client.commands = new Collection();

  // get commands path and files
  const commandFiles = filesPaths("commands");
  // get each command file and put them in to command collection on client
  for (const commandFile of commandFiles) {
    const command = await import(commandFile);

    (client as any).commands.set(command.default.data.name, command.default);
  }

  // get events path and files
  const eventsFiles = filesPaths("events");
  // get event files and create event listeners
  for (const eventsFile of eventsFiles) {
    const { default: event } = await import(eventsFile);
    // either once or on
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  await client.login(token);

  client.user?.setPresence({
    activities: [{ name: ".gg/coding", type: ActivityType.Watching }],
  });
};

main();

async function generateChart(): Promise<Buffer> {
  // Create a canvas
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext("2d");

  Chart.register(
    BarElement,
    BarController,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
  );
  // Define your chart configuration
  const configuration: ChartConfiguration = {
    type: "bar",
    data: {
      labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
      datasets: [
        {
          label: "# of Votes",
          data: [12, 19, 3, 5, 2, 3],
          borderWidth: 1,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };

  // Render the chart

  new Chart(ctx as any, configuration);

  // Convert canvas to buffer
  return canvas.toBuffer("image/png");
}

generateChart().then(async (buffer) => {
  // Do something with the buffer, like saving it or sending it as a response
  writeFileSync("chart.png", buffer);
});
