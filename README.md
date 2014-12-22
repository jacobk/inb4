inb4
====

Create local last.fm statistics for groups

```
git clone https://github.com/jacobk/inb4.git
cd inb4
npm link
inb4 build --key=<lastfmkey> --group=<groupname> --from=2014-01-01 --db=/tmp/stats.sqlite3
````

Builds local cache files for listen stats under `/tmp` and a sqlite3 database with stats in `/tmp/inb4.sqlite`

See https://github.com/jacobk/inb4/blob/master/db/inb4_01.sql for db schema

todo
----
- cli options
- release dates
- clean up cache files
- refactor cb/promise-hell code
- log builds
- add stats since last build
