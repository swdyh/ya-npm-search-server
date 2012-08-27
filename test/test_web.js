var assert = require('assert')
var path = require('path')
var request = require('request')
var web = require(path.join(__dirname, '..', 'lib', 'web'))
var yn = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))
var port = '9991'

function testShowTopPage(next) {
    var u = 'http://localhost:' + port + '/'
    request({
        uri: u,
    }, function(err, res, val) {
        assert.ok(!err)
        assert.ok(res.statusCode == 200)
        next()
    })
}

function testSearchPage(next) {
    var u = 'http://localhost:' + port + '/search?query=redis'
    request({
        uri: u,
    }, function(err, res, val) {
        assert.ok(!err)
        assert.ok(res.statusCode == 200)
        next()
    })
}

function testSearchPageWithFrom(next) {
    var u = 'http://localhost:' + port + '/search?query=redis&from=10'
    request({
        uri: u,
    }, function(err, res, val) {
        assert.ok(!err)
        assert.ok(res.statusCode == 200)
        next()
    })
}

function testSearchPageWithSort(next) {
    var u = 'http://localhost:' + port + '/search?query=redis&sort=stared'
    request({
        uri: u,
    }, function(err, res, val) {
        assert.ok(!err)
        assert.ok(res.statusCode == 200)
        next()
    })
}

function testSearchPageNoQuery(next) {
    var u = 'http://localhost:' + port + '/search?query='
    request({
        uri: u,
        followRedirect: false
    }, function(err, res, val) {
        assert.ok(!err)
        assert.equal(res.statusCode, 302)
        next()
    })
}

function testSearchPageJSON(next) {
    var u = 'http://localhost:' + port + '/search?query=redis&format=json'
    request({
        uri: u,
        json: true
    }, function(err, res, val) {
        // assert.ok(!err)
        // assert.ok(res.statusCode == 200)
        // assert.ok(val.results)
        // assert.ok(val.total)
        // assert.equal(res.header('Access-Control-Allow-Origin'), '*')
        // assert.equal(res.header('Content-Type'), 'application/json')
        next()
    })
}

function testSeachAPI(next) {
    var u = 'http://localhost:' + port + '/api/raw_es_search'
    request.post({
        uri: u,
        json: {
            query: {
                query_string: {
                    query: 'mysql'
                }
            },
            sort: [{ stared: 'desc' }],
            size: 5
        }
    }, function(err, res, val) {
        // assert.ok(!err)
        // assert.ok(res.statusCode == 200)
        // assert.ok(val.hits.total)
        // assert.equal(val.hits.hits.length, 5)
        next()
    })
}

var esUrl = (process.env.YA_NPM_SEARCH_TEST_ES_INDEX_URL ||
             'http://localhost:9200/npm-test').replace(/\/$/, '')
web.start({ port: port, esUrl: esUrl }, function() {
    var tests = [yn.initIndex.bind(yn, esUrl),
                 testShowTopPage, testSearchPage, testSearchPageWithFrom,
                 testSearchPageWithSort, testSearchPageNoQuery, testSearchPageJSON,
                 testSeachAPI]
    tests.concat(function(){
        web.stop()
        console.log('ok')
    }).reduceRight(function(r, i) {
        return i.bind(null, r)
    })()
})

