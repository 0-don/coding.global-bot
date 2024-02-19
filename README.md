<p align="center">
  <a href="https://github.com/0-don/coding.global-bot">
    <img src="https://raw.githubusercontent.com/0-don/coding.global-web/master/public/images/logo_512.gif" alt="Logo" width="80" height="80">
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

### Slash Commands

---

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

- **/verify-all-users**

  - **Description**: Verify all users in the server.

- **/ai**
  - **Description**: Talk to the AI
  - **Options**:
    - **text**: Ask the AI a question.

### restore db in docker

```sh
docker exec -i coding-global-db pg_restore -U postgres -c -d coding-global-db -v < ~/coding-global-db-latest.sql.gz
```

### backup raw restore db in docker

```sh
docker exec -ti coding-global-db pg_dump -U postgres coding-global-db > coding-global-db.sql

cat coding-global-db.sql | docker exec -i coding-global-db psql -U postgres -d coding-global-db
```

<!-- SELECT last_value FROM public."GuildVoiceEvents_id_seq"; -->
<!-- SELECT setval('public."GuildVoiceEvents_id_seq"', 51980, false); -->
