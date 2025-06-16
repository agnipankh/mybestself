# README
An agentic app that works with me to help me create the best version of myself 

###  To Run locally

* ```git checkout mybestself```
* ```uvicorn mvp_step1_onboarding:app --reload```
* ```http://127.0.0.1:8000/docs```



### Mailpit

See the mailpit at ```http://localhost:8025```


### How to look into the database 

* Name of db 'mvp_app'
* Connect to the database 
    * Get Container id by running the docker -ps
    * Connect to the database and then explore tables by running
        * `\l` - list database
        * `\c <db-name>` - connect to your database
        * `\dt` - list tables
        * `SELECT * FROM <table>;` -- View data

```
backend% docker ps
CONTAINER ID   IMAGE                    COMMAND                  CREATED       STATUS                PORTS                                                      NAMES
c2f22b0769b3   mcp/filesystem           "node /app/dist/inde…"   2 days ago    Up 2 days                                                                        clever_jemison
ea58300ae51e   postgres:14              "docker-entrypoint.s…"   13 days ago   Up 2 days             0.0.0.0:5432->5432/tcp                                     mvp-db
1dfe00c4b6c4   axllent/mailpit:latest   "/mailpit"               13 days ago   Up 2 days (healthy)   0.0.0.0:1025->1025/tcp, 0.0.0.0:8025->8025/tcp, 1110/tcp   mvp-mailpit

backend% docker exec -it ea58300ae51e psql -U postgres -d mvp_app
psql (14.18 (Debian 14.18-1.pgdg120+1))
Type "help" for help.

mvp_app=# \dt
            List of relations
 Schema |    Name     | Type  |  Owner
--------+-------------+-------+----------
 public | magic_links | table | postgres
 public | personas    | table | postgres
 public | users       | table | postgres
(3 rows)

mvp_app=# SELECT * FROM users;
                  id                  |  name  |        email        |         created_at
--------------------------------------+--------+---------------------+----------------------------
 1174d108-bef9-4760-a1b5-da46f190b0fa |        | amit.agrawal@me.com | 2025-06-01 19:46:33.772985
 03e4db4d-f7af-4245-b634-3a8cfcfa36e8 |        | amit@awesome.org    | 2025-06-03 02:59:30.677408
 81dd5ab5-5503-4376-850e-8812f3161586 |        | amit@23andme.com    | 2025-06-03 03:05:59.065698
 af6e004b-5e1d-450f-9bc2-cbc30d503939 |        | amit@me.com         | 2025-06-03 03:13:39.523774
 2fbe1792-6368-4c9b-a80d-6fce9adc3a63 |        | amit@23nme.com      | 2025-06-03 03:17:16.958872
 f905f9a1-82e5-4201-9a3d-9923ed5b0470 |        | andrea@23nme.com    | 2025-06-03 03:21:20.278754
 b77b178a-3ff8-4b55-bdf1-788971bd01f8 |        | jony@sony.com       | 2025-06-03 03:32:06.883491
 47a1eb52-3689-42aa-b65c-8a0d48a89295 |        | test@awesome.org    | 2025-06-07 00:11:38.258382
 50eb79ed-315d-4e1b-b324-e2ea66bf67c4 | amit2  | amit2@20250613.org  | 2025-06-13 19:34:30.887544
 39835fb3-e361-4e71-bf70-b9771b22e58c | andrea | andrea@awesome.org  | 2025-06-13 19:37:03.873897
(10 rows)

```

