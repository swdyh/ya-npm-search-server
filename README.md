# ya-npm-search-server

![screen capture](https://raw.github.com/swdyh/ya-npm-search-server/master/public/sc001_60.png)

Yet Another npm search
https://ya-npm-search.herokuapp.com/

A search engine for npm packages powered by elasticsearch.

  * github: https://github.com/swdyh/ya-npm-saerch-server
  * auhtor: swdyh https://github.com/swdyh/ https://twitter.com/swdyh/
  * icon: http://hail2u.github.com/drawic/

## Setup Server

run Elasticsearch

    export YA_NPM_SEARCH_ES_INDEX_URL="http://example.com/your_elasticsearch_index"
    git clone https://github.com/swdyh/ya-npm-search-server.git
    cd ya-npm-search-server
    npm install
    node lib/web

open http://localhost:9990/

## License

Apache License Version 2.0
