# coding.global Official Discord Bot

discord.gg/coding

### restore db

```sh
docker exec -ti coding-global-db pg_restore -U postgres -c -d coding-global-db /backups/daily/coding-global-db-latest.sql.gz
```
