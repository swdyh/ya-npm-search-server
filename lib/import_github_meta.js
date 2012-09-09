var fs = require('fs')
var util = require('util')
var path = require('path')
var request = require('request')
var yn = require(path.join(__dirname, 'ya-npm-search'))

var esUrl = (process.env.YA_NPM_SEARCH_ES_INDEX_URL ||
             process.env.BONSAI_INDEX_URL ||
             'http://localhost:9200/npm').replace(/\/$/, '')

var mg = JSON.parse(fs.readFileSync(path.join(__dirname, 'meta_github.json')))
var limit = 100
request({
    uri: esUrl + '/package/_count',
    json: {
        // query: { match_all: {} },
        filtered: {
            query: { match_all: {} },
            filter: { not: { exists: { field: 'github_watchers_count' } } }
        }
    }
}, function(err, res, val) {
    request({
        uri: esUrl + '/package/_search',
        json: {
            size: val.count,
            filter: { not: { exists: { field: 'github_watchers_count' } } },
            fields: ['_source.name']
        }
    }, function(err, res, val) {
        var ps = {}
        val.hits.hits.forEach(function(i) {
            ps[i.fields['_source.name']] = true
        })
        var mg = JSON.parse(fs.readFileSync('lib/meta_github.json'))
        var ks = Object.keys(mg).filter(function(i) { return ps[i] })
        util.log(JSON.stringify(['startMergeMeta', ks.length]))
        if (ks.length > 0) {
            ks = ks.slice(0, limit)
            var meta = {}
            ks.forEach(function(i) { meta[i] = mg[i] })
            yn.mergeMeta(esUrl, meta)
        }
    })
})

