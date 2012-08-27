# API

  * [search](#search)
  * [raw elasticsearch search](#raw_elasticsearch_search)

access control

    Access-Control-Allow-Origin: *

## search

params

  * query: query string
  * sort: depended or recent stared or score
  * format: json

curl:

    % curl 'http://ya-npm-search.herokuapp.com/search?format=json&query=redis&size=3'

response:

    {
      "query": "redis",
      "total": 202,
      "results": [
        {
          "name": "redis",
          "description": "Redis client library",
          "dist-tags": {
            "latest": "0.7.2"
          },
          "maintainers": [
            {
              "name": "mjr",
              "email": "",
              "gravatar": "http://www.gravatar.com/avatar/f2602cabcccbe70f6e73e0c86379921d",
              "npm": "https://npmjs.org/browse/author/mjr"
            }
          ],
          "author": {
            "name": "Matt Ranney",
            "email": ""
          },
          "repository": {
            "type": "git",
            "url": "git://github.com/mranney/node_redis.git"
          },
          "time": {
            "modified": "2012-08-07T18:16:36.255Z"
          },
          "versions": [
            "0.7.2"
          ],
          "depended": 262,
          "stared": 17,
          "keywords": null,
          "github": {
            "url": "https://github.com/mranney/node_redis"
          }
        },
        {
          "name": "connect-redis",
          "description": "Redis session store for Connect",
          "dist-tags": {
            "latest": "1.4.1"
          },
          "maintainers": [
            {
              "name": "tjholowaychuk",
              "email": "",
              "gravatar": "http://www.gravatar.com/avatar/f1e3ab214a976a39cfd713bc93deb10f",
              "npm": "https://npmjs.org/browse/author/tjholowaychuk"
            }
          ],
          "author": {
            "name": "TJ Holowaychuk",
            "email": ""
          },
          "time": {
            "modified": "2012-08-04T13:28:01.778Z"
          },
          "versions": [
            "1.4.1"
          ],
          "depended": 22,
          "stared": 3,
          "keywords": null
        },
        {
          "name": "jugglingdb",
          "description": "ORM for every database: redis, mysql, neo4j, mongodb, postgres, sqlite",
          "dist-tags": {
            "latest": "0.1.13"
          },
          "maintainers": [
            {
              "name": "anatoliy",
              "email": "",
              "gravatar": "http://www.gravatar.com/avatar/00bcc518cddfa8502e2e8e219f3cdfb1",
              "npm": "https://npmjs.org/browse/author/anatoliy"
            }
          ],
          "author": {
            "name": "Anatoliy Chakkaev",
            "email": ""
          },
          "repository": {
            "type": "git",
            "url": "git://github.com/1602/jugglingdb.git"
          },
          "time": {
            "modified": "2012-08-16T10:22:29.847Z"
          },
          "versions": [
            "0.1.13"
          ],
          "depended": 5,
          "stared": 2,
          "keywords": null,
          "github": {
            "url": "https://github.com/1602/jugglingdb"
          }
        }
      ],
      "next": {
        "url": "/search?format=json&query=redis&size=3&from=20"
      }
    }


## raw elasticsearch search

proxyed elasticsearch search API.

http://www.elasticsearch.org/guide/reference/api/search/ <br />
http://www.elasticsearch.org/guide/reference/query-dsl/ <br/ >

use POST method

curl:

    curl -H 'Content-Type: application/json' 'http://ya-npm-search.herokuapp.com/api/raw_es_search' -d '
      {
        "query": {
          "query_string":
            { "query": "mysql"}
          },
        "sort": [{ "stared": "desc" }],
        "size": 3
      }
    '

response:

    {
      "took": 7,
      "timed_out": false,
      "_shards": {
        "total": 5,
        "successful": 5,
        "failed": 0
      },
      "hits": {
        "total": 64,
        "max_score": null,
        "hits": [
          {
            "_index": "npm",
            "_type": "package",
            "_id": "mysql",
            "_score": null,
            "_source": {
              "name": "mysql",
              "dist-tags": {
                "latest": "0.9.6",
                "2.0.0-alpha": "2.0.0-alpha",
                "2.0.0-alpha2": "2.0.0-alpha2",
                "alpha3": "2.0.0-alpha3"
              },
              "maintainers": [
                {
                  "name": "felixge",
                  "email": ""
                }
              ],
              "description": "A node.js driver for mysql. It is written in JavaScript, does not require compiling, and is 100% MIT licensed.",
              "author": {
                "name": "Felix Geisendörfer",
                "email": "",
                "url": "http://debuggable.com/"
              },
              "repository": {
                "url": ""
              },
              "users": [
                "dresende",
                "fgribreau",
                "hyq",
                "tellnes"
              ],
              "time": {
                "modified": "2012-08-04T22:46:44.909Z"
              },
              "versions": [
                "0.9.6",
                "2.0.0-alpha",
                "2.0.0-alpha2",
                "2.0.0-alpha3"
              ],
              "depended": 61,
              "stared": 4
            },
            "sort": [
              4
            ]
          },
          {
            "_index": "npm",
            "_type": "package",
            "_id": "persist",
            "_score": null,
            "_source": {
              "name": "persist",
              "description": "Node.js ORM framework supporting various relational databases",
              "dist-tags": {
                "latest": "0.2.5"
              },
              "maintainers": [
                {
                  "name": "joeferner",
                  "email": ""
                }
              ],
              "users": [
                "joeferner",
                "kunklejr",
                "fgribreau"
              ],
              "author": {
                "name": "Joe Ferner",
                "email": ""
              },
              "repository": {
                "type": "git",
                "url": "https://github.com/nearinfinity/node-persist.git"
              },
              "time": {
                "modified": "2012-08-02T13:43:54.056Z"
              },
              "versions": [
                "0.2.5"
              ],
              "keywords": [
                "database",
                "db",
                "orm",
                "sqlite",
                "mysql",
                "PostgreSQL",
                "oracle",
                "db-oracle"
              ],
              "depended": 1,
              "stared": 3
            },
            "sort": [
              3
            ]
          },
          {
            "_index": "npm",
            "_type": "package",
            "_id": "jugglingdb",
            "_score": null,
            "_source": {
              "name": "jugglingdb",
              "description": "ORM for every database: redis, mysql, neo4j, mongodb, postgres, sqlite",
              "dist-tags": {
                "latest": "0.1.13"
              },
              "maintainers": [
                {
                  "name": "anatoliy",
                  "email": ""
                }
              ],
              "author": {
                "name": "Anatoliy Chakkaev",
                "email": ""
              },
              "repository": {
                "type": "git",
                "url": "git://github.com/1602/jugglingdb.git"
              },
              "users": [
                "anatoliy",
                "pid"
              ],
              "time": {
                "modified": "2012-08-16T10:22:29.847Z"
              },
              "versions": [
                "0.1.13"
              ],
              "depended": 5,
              "stared": 2
            },
            "sort": [
              2
            ]
          }
        ]
      }
    }

