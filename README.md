# coding.global Official Discord Bot..

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
