var assert = require('assert')
var path = require('path')
var request = require('request')
var yaNpmSearch = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))
var web = require(path.join(__dirname, '..', 'lib', 'web'))

var esUrl = (process.env.YA_NPM_SEARCH_TEST_ES_INDEX_URL ||
             'http://localhost:9200/npm-test').replace(/\/$/, '')
var port = '9991'

describe('ya-npm-search', function() {

    describe('initIndex()', function() {
        it('should return index mapping', function(done) {
            request.del({ uri: esUrl }, function(err, val) {
                yaNpmSearch.initIndex(esUrl, function(err, val) {
                    assert.ok(!err)
                    assert.ok(val.ok)
                    request({
                        uri: esUrl + '/_mapping',
                        json: true
                    }, function(err, res, val) {
                        assert.ok(!err)
                        assert.ok(val['npm-test'])
                        done()
                    })
                })
            })
        })
    })

    describe('getLastUpdate()', function() {
        it('should return update timestamp', function(done) {
            var v = { updated: new Date().getTime() }
            yaNpmSearch.updateLastUpdate(esUrl, v, function(err, val) {
                yaNpmSearch.getLastUpdate(esUrl, function(err, val) {
                    assert.ok(!err)
                    assert.equal(val, String(v.updated))
                    done()
                })
            })
        })
    })

    describe('bulkUpdate()', function() {
        it('should return ok', function(done) {
            var d = {
                'test-package-01': { name: 'test-package-01' },
                'test-package-02': { name: 'test-package-02' }
            }
            yaNpmSearch.bulkUpdate(esUrl, {
                keys: Object.keys(d),
                size: 1,
                data: d,
                silent: true
            }, function(err, val) {
                assert.ok(!err)
                assert.ok(val)
                done()
            })
        })
    })

    describe('postBulk()', function() {
        it('should return ok', function(done) {
            var d = [{ name: 'test-package-01' }, { name: 'test-package-02' }]
            yaNpmSearch.postBulk(esUrl, d, function(err, val) {
                assert.ok(!err)
                assert.equal(val.items.length, 2)
                assert.ok(val.items.every(function(i) { return i.index.ok }))
                done()
            })
        })
    })

    describe('convertPkg()', function() {
        it('should return converted package info', function(done) {
            var d = {
                name: 'test-packages',
                users: {
                    a: true,
                    b: true,
                    c: true
                },
                versions: {
                    '0.9.6': 'latest',
                    '2.0.0-alpha': '2.0.0-alpha',
                    '2.0.0-alpha2': '2.0.0-alpha2',
                    '2.0.0-alpha3': 'alpha3'
                },
                repository: 'https://github.com/bnoguchi/array-promise.git'
            }
            var r = yaNpmSearch.convertPkg(d)
            assert.ok(r)
            assert.equal(r.users.length, 3)
            assert.equal(r.versions.length, 4)
            assert.ok(r.repository.url)
            done()
        })
    })

    describe('seqRequest()', function() {
        it('should return request results', function(done) {
            var rs = [{ uri: esUrl + '/_status', json: true, _silent: true },
                      { uri: esUrl + '/_stats', json: true, _silent: true }]
            yaNpmSearch.seqRequest(rs, [], function(err, val) {
                assert.ok(!err)
                assert.ok(val.every(function(i) { return i.ok } ))
                done()
            })
        })
    })

    describe('mergeViewAttr()', function() {
        it('should return object that include starred value', function(done) {
            var from = { rows: [{ key: ['a'], value: 5 }] }
            var to = { a: {} }
            var r = yaNpmSearch.mergeViewAttr(from, to, 'starred')
            assert.ok(r.a.starred)
            done()
        })
    })

    describe('countIndex()', function() {
        it('should return index count', function(done) {
            yaNpmSearch.countIndex(esUrl, function(err, val) {
                assert.ok(!err)
                assert.ok(val >= 0)
                var cond = { term: { name: 'test' } }
                yaNpmSearch.countIndex(esUrl, cond, function(err, val) {
                    assert.ok(!err)
                    assert.ok(val >= 0)
                    done()
                })
            })
        })
    })

    // describe('()', function() {
    //     it('should return', function(done) {
    //         done()
    //     })
    // })
})

describe('web', function() {
    before(function(done) {
        web.start({ port: port, esUrl: esUrl, silent: true }, done)
    })
    after(function(done) {
        web.stop()
        done()
    })

    describe('show top page', function() {
        it('should return 200', function(done) {
            var u = 'http://localhost:' + port + '/'
            request({
                uri: u,
            }, function(err, res, val) {
                assert.ok(!err)
                assert.ok(res.statusCode == 200)
                done()
            })
        })
    })


    describe('show search page', function() {
        it('should return 200', function(done) {
            var u = 'http://localhost:' + port + '/search?query=redis'
            request({
                uri: u,
            }, function(err, res, val) {
                assert.ok(!err)
                assert.ok(res.statusCode == 200)
                done()
            })
        })
    })

    describe('show search page with params', function() {
        it('should return 200', function(done) {
            var u = 'http://localhost:' + port + '/search?query=redis&from=10&sort=starred'
            request({
                uri: u,
            }, function(err, res, val) {
                assert.ok(!err)
                assert.ok(res.statusCode == 200)
                done()
            })
        })
    })

    describe('show search page with no query', function() {
        it('should redirect /', function(done) {
            var u = 'http://localhost:' + port + '/search?query='
            request({
                uri: u,
                followRedirect: false
            }, function(err, res, val) {
                assert.ok(!err)
                assert.equal(res.statusCode, 302)
                assert.equal(res.header('Location'),
                             'http://localhost:' + port + '/')
                done()
            })
        })
    })

    describe('show json resutls', function() {
        it('should return object', function(done) {
            var u = 'http://localhost:' + port + '/search?query=redis&format=json'
            request({
                uri: u,
                json: true
            }, function(err, res, val) {
                assert.ok(!err)
                assert.ok(res.statusCode == 200)
                assert.ok(val.results)
                assert.ok(val.total >= 0 )
                assert.equal(res.header('Access-Control-Allow-Origin'), '*')
                assert.equal(res.header('Content-Type'), 'application/json')
                done()
            })
        })
    })

    describe('show es api json', function() {
        it('should return results object', function(done) {
            var u = 'http://localhost:' + port + '/api/raw_es_search'
            request.post({
                uri: u,
                json: {
                    query: {
                        query_string: {
                            query: 'mysql'
                        }
                    },
                    sort: [{ starred: 'desc' }],
                    size: 5
                }
            }, function(err, res, val) {
                assert.ok(!err)
                assert.ok(res.statusCode == 200)
                assert.ok(val.hits.total >= 0)
                assert.equal(res.header('Access-Control-Allow-Origin'), '*')
                assert.equal(res.header('Content-Type'), 'application/json')
                done()
            })
        })
    })
})
