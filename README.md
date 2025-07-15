<p align="center">
  <a href="https://github.com/0-don/coding.global-bot">
    <img src="https://raw.githubusercontent.com/0-don/coding.global-web/master/public/images/logo_512.gif" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">coding.global Discord Bot.</h3>

  <p align="center">
    The official bot for the <a href="https://discord.gg/coding">discord.gg/coding</a> Discord Server.
    <br />
    <a href="#about-the-bot"><strong>» Explore the docs</strong></a>
    <br />
    ·
    <a href="https://github.com/0-don/coding.global-bot/issues">Report Bug</a>
    ·
    <a href="https://github.com/0-don/coding.global-bot/issues">Request Feature</a>
  </p>
</p>

## Setup

### Prerequisites

1. **Discord Bot Token** - Follow this [YouTube tutorial](https://www.youtube.com/watch?v=aI4OmIbkJH8) to create a Discord bot and get your token
2. **Database** - Set up a PostgreSQL database using Neon (recommended) or your preferred provider

### Database Setup with Neon

1. **Create a Neon Account**
   - Go to [Neon.tech](https://neon.tech) and sign up for a free account
   - Create a new project and give it a name (e.g., "coding-global-bot")

2. **Get Database Connection String**
   - In your Neon dashboard, go to your project
   - Navigate to the "Connection Details" section
   - Copy the connection string (it looks like: `postgresql://username:password@host/database?sslmode=require`)

3. **Configure Environment Variables**
   Create a `.env` file from the `.env.example` template and fill in the required variables:

4. **Install Dependencies & Run Prisma**
   ```sh
   npm install
   npm run prisma
   npm run dev
   ```
   run `/verify-all-users` to verify all users in the server and the db.

### Slash Commands

---

- **/verify-all-users**
  - **Description**: Important for the first run, this command verifies all users in the server.

- **/delete-messages**
  - **Description**: Deletes messages from a channel.
  - **Options**:
    - **amount**: Delete message history.

- **/me**
  - **Description**: Get your stats.

- **/members**
  - **Description**: Member flow and count of the past.

- **/top**
  - **Description**: Get top user stats.

- **/translate**
  - **Description**: Translate text to English.
  - **Options**:
    - **text**: The text to translate.

- **/troll-move-user**
  - **Description**: Troll move user around empty voice channels.
  - **Options**:
    - **user**: Select either user which should be moved.

- **/user**
  - **Description**: Get stats from a specific user.
  - **Options**:
    - **user**: Select the user whose stats should be shown.

### restore db

```sh
docker exec -i coding-global-db pg_restore -U postgres -c -d coding-global-db -v < ~/coding-global-db-latest.sql.gz
```

### backup raw db / restore raw db

```sh
docker exec -ti coding-global-db pg_dump -U postgres coding-global-db > coding-global-db.sql

cat coding-global-db.sql | docker exec -i coding-global-db psql -U postgres -d coding-global-db
```

<!-- SELECT last_value FROM public."GuildVoiceEvents_id_seq"; -->
<!-- SELECT setval('public."GuildVoiceEvents_id_seq"', 51980, false); -->
<!-- GIT_COMMITTER_DATE="2024-06-09T12:00:00" git commit --amend --no-edit --date "2024-06-09T12:00:00" -->
