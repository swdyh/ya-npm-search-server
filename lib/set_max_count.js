var request = require('request')
var yn = require('./ya-npm-search')
var esUrl = (process.env.YA_NPM_SEARCH_ES_INDEX_URL ||
             process.env.BONSAI_INDEX_URL ||
             'http://localhost:9200/npm').replace(/\/$/, '')
var limit = 10 * 0000
request({
    uri: esUrl + '/package/_search',
    json: {
        filter: { not: { exists: { field: '_max_count' } } },
        fields: [],
        size: limit
    },
}, function(err, res, val) {
    var t = val.hits.total
    var list = val.hits.hits.map(function(i, index) {
        return function(done) {
            var pkg = i._id
            request.post({
                uri: esUrl + '/package/' + pkg + '/_update',
                json: {
                    script: 'ctx._source._max_count = max(max(ctx._source.?depended or 0, ctx._source.?starred or 0), max(ctx._source.?github_forks_count or 0, ctx._source.?github_watchers_count or 0))'
                }
            }, function(err, res, val) {
                console.log(index + 1 + '/' +  t, pkg, err, val.ok)
                done()
            })
        }
    })
    yn.seq(list, 10)
})
