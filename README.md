<p align="center">
  <a href="https://github.com/0-don/coding.global-bot">
    <img src="https://raw.githubusercontent.com/0-don/coding.global-web/master/public/images/logo.gif" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">coding.global Discord Bot!</h3>

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

1. **Discord Bot Token** from the [Discord Developer Portal](https://discord.com/developers/applications)
2. **PostgreSQL** database (run one locally, use Docker, or any hosted provider)
3. **Bun** runtime

### Getting Started

1. Copy `.env.example` to `.env` and fill in your bot token and database credentials.

2. Install dependencies and push the database schema:
   ```sh
   bun install
   bun run db:push
   ```

3. Start the bot:
   ```sh
   bun run dev
   ```

4. Run `!verify-users` in Discord to sync all server members with the database.

### Commands

#### Public

| Command | Description | Options |
| --- | --- | --- |
| `/me` | Get your stats | |
| `/user` | Get stats from a specific user | `user` |
| `/top` | Get top stats for the guild | `lookback` (optional) |
| `/members` | Member flow and count | |
| `/translate` | Translate text to English | `text` |
| `/lookback-me` | Change your lookback date range | `lookback` |

#### Mod (Manage Roles)

| Command | Description | Options |
| --- | --- | --- |
| `/delete-messages` | Delete messages from a channel | `amount` |
| `/delete-user-messages` | Delete messages from a specific user | `user`, `user-id`, `jail`, `reason` |
| `/delete-member-db` | Remove a member from the server database | `user` |
| `/lookback-members` | Change lookback date range for the guild | `lookback` |
| `/log-command-history` | Show command history | `count` (optional) |
| `/log-deleted-messages-history` | Show deleted messages | `count` (optional) |

#### Admin

| Command | Description | Options |
| --- | --- | --- |
| `/troll-move-user` | Move user around empty voice channels | `user`, `count`, `timeout` |
| `/audit-roles` | Audit all roles for elevated permissions | |

#### Prefix Commands

| Command | Description |
| --- | --- |
| `!verify-users` | Sync all server members with the database |
| `!verify-threads` | Sync thread templates |
