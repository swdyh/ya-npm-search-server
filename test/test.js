var assert = require('assert')
var path = require('path')
var request = require('request')
var yn = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))
var web = require(path.join(__dirname, '..', 'lib', 'web'))

var esUrl = (process.env.YA_NPM_SEARCH_TEST_ES_INDEX_URL ||
             'http://localhost:9200/npm-test').replace(/\/$/, '')
var port = '9991'

describe('ya-npm-search', function() {

    describe('initIndex()', function() {
        it('should return index mapping', function(done) {
            request.del({ uri: esUrl }, function(err, val) {
                yn.initIndex(esUrl, function(err, val) {
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
            var t = new Date().getTime()
            yn.updateLastUpdate(esUrl, t, null, function(err, val) {
                yn.getLastUpdate(esUrl, function(err, val) {
                    assert.ok(!err)
                    assert.equal(val, String(t))
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
            yn.bulkUpdate(esUrl, {
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
            yn.postBulk(esUrl, d, function(err, val) {
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
            var r = yn.convertPkg(d)
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
            yn.seqRequest(rs, [], function(err, val) {
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
            var r = yn.mergeViewAttr(from, to, 'starred')
            assert.ok(r.a.starred)
            done()
        })
    })

    describe('countIndex()', function() {
        it('should return index count', function(done) {
            yn.countIndex(esUrl, function(err, val) {
                assert.ok(!err)
                assert.ok(val >= 0)
                var cond = { term: { name: 'test' } }
                yn.countIndex(esUrl, cond, function(err, val) {
                    assert.ok(!err)
                    assert.ok(val >= 0)
                    done()
                })
            })
        })
    })

    describe('patch()', function() {
        it('should return patched object', function(done) {
            request.put({
                uri: esUrl + '/patch_test/1?refresh=true',
                json: { a: 1, b: 2 }
            }, function(err, val) {
                yn.patch({
                    uri: esUrl + '/patch_test/1',
                    param: { refresh: true }
                }, { b: 3, c: 1 }, function(err, val) {
                    request({
                        uri: esUrl + '/patch_test/1', json: true
                    }, function(err, res, val) {
                        assert.equal(val._source.a, 1)
                        assert.equal(val._source.b, 3)
                        assert.equal(val._source.c, 1)
                        done()
                    })
                })
            })
        })

        it('should return 404 error object', function(done) {
            yn.patch({
                uri: esUrl + '/patch_test/not_exists',
                param: { refresh: true }
            }, { b: 3, c: 1 }, function(err, val) {
                assert.equal(err.message, '404')
                done()
            })
        })

        it('should return 400 error object', function(done) {
            yn.patch({
                uri: esUrl + '/patch_test/not_exists/foo/bar',
                param: { refresh: true }
            }, { b: 3, c: 1 }, function(err, val) {
                assert.equal(err.message, '400')
                done()
            })
        })
    })

    describe('seq()', function() {
        it('should return', function(done) {
            var a = function(next) {
                setTimeout(function() { next(null, 1) }, 10)
            }
            var b = function(next) {
                setTimeout(function() { next(null, 2) }, 10)
            }
            var c = function(next) {
                setTimeout(function() { next(new Error('c'), 3) }, 10)
            }
            yn.seq([a, b, c], 10, [], function(err, val) {
                assert.equal(val[0], 1)
                assert.equal(val[1], 2)
                assert.equal(val[2], 3)
                assert.ok(err[2])
                done()
            })
        })
    })

    describe('_request()', function() {
        it('should return json object', function(done) {
            yn._request({ uri: esUrl + '/_status' }, function(err, val) {
                assert.ok(val.ok)
                done()
            })
        })

        it('should return 400 err', function(done) {
            yn._request({ uri: esUrl + '/_statuss' }, function(err, val) {
                assert.equal(err.message, '400')
                done()
            })
        })

        it('should return 404 err', function(done) {
            yn._request({ uri: esUrl + '/package/zzz' }, function(err, val) {
                assert.equal(err.message, '404')
                done()
            })
        })
    })

    // remote access!
    describe.skip('loadView()', function() {
        it('should return starred count', function(done) {
            yn.loadView('starred', function(err, val) {
                var keys = Object.keys(val)
                assert.ok(keys.length > 0)
                assert.ok(val[keys[0]].starred >= 0)
                done()
            })
        })

        it('should return depended count', function(done) {
            yn.loadView('depended', function(err, val) {
                var keys = Object.keys(val)
                assert.ok(keys.length > 0)
                assert.ok(val[keys[0]].depended >= 0)
                done()
            })
        })

        it('should return empty', function(done) {
            yn.loadView('else', function(err, val) {
                var keys = Object.keys(val)
                assert.equal(keys.length, 0)
                done()
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
                uri: u
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
                uri: u
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
                uri: u
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
