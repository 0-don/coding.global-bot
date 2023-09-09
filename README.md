<p align="center">
  <a href="https://github.com/don-cryptus/coding.global-bot">
    <img src="https://raw.githubusercontent.com/don-cryptus/coding.global-web/master/public/images/logo_512.gif" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">coding.global Discord Bot</h3>

  <p align="center">
    The official bot for the <a href="https://discord.gg/coding">discord.gg/coding</a> Discord Server.
    <br />
    <a href="#about-the-bot"><strong>» Explore the docs</strong></a>
    <br />
    ·
    <a href="https://github.com/don-cryptus/coding.global-bot/issues">Report Bug</a>
    ·
    <a href="https://github.com/don-cryptus/coding.global-bot/issues">Request Feature</a>
  </p>
</p>

### Slash Commands

---

- **/ai-reset** 
  - Description: reset ai context

- **/ai** 
  - Description: talk to ai

- **/text** 
  - Description: ask ai a question

- **/create-role-template** 
  - Description: Create a role template from JSON

- **/json** 
  - Description: JSON input for the role template

- **/create-verify-embed** 
  - Description: verify all users in the server

- **/delete-member-db** 
  - Description: delete specific member from database

- **/delete-messages** 
  - Description: Deletes messages from a channel

- **/amount** 
  - Description: Delete message History

- **/days** 
  - Description: Delete message History

- **/user** 
  - Description: Select either user which messages should be deleted

- **/edit-role-template** 
  - Description: Create a role template from JSON

- **/message-id** 
  - Description: copy the message ID of the embeded message

- **/json** 
  - Description: JSON input for the role template

- **/get-role-template** 
  - Description: get a role template as JSON

- **/message-id** 
  - Description: copy the message ID of the embeded message

- **/lookback-me** 
  - Description: Change lookback date range for yourself

- **/lookback** 
  - Description: Set lookback days range

- **/lookback-members** 
  - Description: Change lookback date range for guild

- **/lookback** 
  - Description: Set lookback days range

- **/me** 
  - Description: Get your stats

- **/members** 
  - Description: Memberflow and count of the past

- **/top** 
  - Description: Get top user stats

- **/translate** 
  - Description: translate text to english

- **/text** 
  - Description: the text to translate

- **/troll-move-user** 
  - Description: troll move user around empty voice channels

- **/user** 
  - Description: Select either user which should be moved

- **/user** 
  - Description: Get stats from specific user

- **/user** 
  - Description: Select user which stats should be shown

- **/verify-all-users** 
  - Description: verify all users in the server

- **/top-bumpers** 
  - Description: look at the top bumpers



<a href="https://discord.gg/coding">
 discord.gg/coding
</a>

### restore db in docker

```sh
docker exec -ti coding-global-db pg_restore -U postgres -c -d test /backups/daily/coding-global-db-latest.sql.gz
```

# coding.global Official Discord Bot
<a href="https://discord.gg/coding">
 discord.gg/coding
</a>


### backup raw restore db in docker

```sh
docker exec -ti coding-global-db pg_dump -U postgres coding-global-db > coding-global-db.sql

cat coding-global-db.sql | docker exec -i coding-global-db psql -U postgres -d coding-global-db
```
as
