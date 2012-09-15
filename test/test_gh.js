var assert = require('assert')
var path = require('path')
var request = require('request')
var gh = require(path.join(__dirname, '..', 'lib', 'gh'))
var yn = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))
var esUrl = (process.env.YA_NPM_SEARCH_TEST_ES_INDEX_URL ||
             'http://localhost:9200/npm-test').replace(/\/$/, '')

describe('gh', function() {
    before(function(done) {
        var packages = [
            { name: 'a' },
            { name: 'b' },
            {
                name: 'ya-npm-search-server',
                repository: { url: 'https://github.com/swdyh/ya-npm-search-server.git' }
            },
            {
                name: 'ya-npm-search-cli',
                maintainers: [{ name: 'swdyh' }],
                _github: {
                    user: 'swdyh',
                    repos: 'ya-npm-search-cli',
                    ok: true,
                    got_at: new Date(0)
                }
            }
        ]
        request.del({ uri: esUrl }, function(err, val) {
            yn.initIndex(esUrl, function() {
                var body = packages.map(function(i) {
                    return JSON.stringify({ index: { _id: i.name } }) + '\n' +
                        JSON.stringify(i) + '\n'
                }).join('')
                request.post({
                    uri: esUrl + '/package/_bulk?refresh=true',
                    body: body,
                    json: true
                }, done)
            })
        })
    })

    describe('stats()', function() {
        it('should return stats object', function(done) {
            gh.stats(esUrl, function(err, val) {
                assert.ok(val.total >= 0)
                assert.ok(val.ok >= 0)
                assert.ok(val.ng >= 0)
                assert.ok(val.yet >= 0)
                assert.ok(val.expired >= 0)
                done()
            })
        })
    })

    describe('bulkUpdatePackage()', function() {
        it('should return ok_ids and update foo value', function(done) {
            var list = [
                { name: 'a', foo: 1 },
                { name: 'b', foo: 2 }
            ]
            gh.bulkUpdatePackage(esUrl, list, function(err, val) {
                assert.ok(val.ok_ids.length === 2)
                yn._request({
                    uri: esUrl + '/package/a'
                }, function(err, val) {
                    assert.equal(val._source.foo, 1)
                    done()
                })
            })
        })
    })

    describe('detectRepos()', function() {
        it('should return user and repos with https:', function() {
            var rs = gh.detectRepos({
                repository: { url: 'https://github.com/aaa/bbb' }
            })
            assert.equal(rs[0].user, 'aaa')
            assert.equal(rs[0].repos, 'bbb')
        })
        it('should return user and repos with git:', function() {
            var rs = gh.detectRepos({
                repository: { url: 'git://github.com/aaa/bbb.git' }
            })
            assert.equal(rs[0].user, 'aaa')
            assert.equal(rs[0].repos, 'bbb')
        })
        it('should return 2 results', function() {
            var rs = gh.detectRepos({
                name: 'bbb',
                maintainers: [
                    { name: 'aaa', email: 'aaa@example.com' }
                ]
            })
            assert.equal(rs.length, 2)
            assert.equal(rs[0].user, 'aaa')
            assert.equal(rs[0].repos, 'bbb')
            assert.equal(rs[1].user, 'aaa')
            assert.equal(rs[1].repos, 'node-bbb')
        })
        it('should return 1 results', function() {
            var rs = gh.detectRepos({
                name: 'node-bbb',
                maintainers: [
                    { name: 'aaa', email: 'aaa@example.com' }
                ]
            })
            assert.equal(rs.length, 1)
            assert.equal(rs[0].user, 'aaa')
            assert.equal(rs[0].repos, 'node-bbb')
        })
        it('should return 4 results', function() {
            var rs = gh.detectRepos({
                name: 'bbb',
                maintainers: [
                    { name: 'aaa', email: 'aaa@example.com' },
                    { name: 'ccc', email: 'ccc@example.com' }
                ]
            })
            assert.equal(rs.length, 4)
        })
        it('should return uesr aaa', function() {
            var rs = gh.detectRepos({
                name: 'bbb',
                maintainers: [
                    { name: 'aaa@example.com', email: 'aaa@example.com' }
                ]
            })
            assert.equal(rs[0].user, 'aaa')
            assert.equal(rs[0].repos, 'bbb')
        })
        it('should return userMap value', function() {
            var rs = gh.detectRepos({
                name: 'bbb',
                maintainers: [
                    { name: 'aaa', email: 'aaa@example.com' }
                ]
            }, { aaa: 'aaaa' })
            assert.equal(rs[0].user, 'aaaa')
        })
        it('should return reposMap value', function() {
            var rs = gh.detectRepos({
                name: 'bbb',
                maintainers: [
                    { name: 'aaa', email: 'aaa@example.com' }
                ]
            }, { aaa: 'aaaa' }, { bbb: 'bbbb' })
            assert.equal(rs[0].repos, 'bbbb')
        })
    })

    // remote access!
    describe.skip('requestGithub()', function() {
        it('should return repository object', function(done) {
            var u = 'https://api.github.com/repos/swdyh/ya-npm-search-server'
            gh.requestGithub(u, function(err, val, r) {
                assert.ok(val.name)
                assert.ok(val.owner.login)
                assert.ok(val.watchers_count >= 0)
                assert.ok(r)
                done()
            })
        })
    })

    // remote access!
    describe.skip('getRepos()', function() {
        it('should return repository object', function(done) {
            gh.getRepos('swdyh', 'ya-npm-search-server', function(err, val, r) {
                assert.ok(val.name)
                assert.ok(val.owner.login)
                assert.ok(val.watchers_count >= 0)
                assert.ok(r)
                done()
            })
        })
    })

    // remote access!
    describe.skip('findRepos()', function() {
        it('should return repository object', function(done) {
            var rs= [
                { user: 'swdyh', repos: 'ya-npm-search-server_' },
                { user: 'swdyh', repos: 'ya-npm-search-server' }
            ]
            gh.findRepos(rs, function(err, val, r) {
                assert.ok(val.name)
                assert.ok(val.owner.login)
                assert.ok(val.watchers_count >= 0)
                assert.ok(r)
                done()
            })
        })
    })

    // remote access!
    describe.skip('findAllRepos()', function() {
        it('should return ok_ids', function(done) {
            gh.findAllRepos(esUrl, 5, function(err, val) {
                assert.equal(val.errors.length, 0)
                assert.equal(val.ok_ids.length, 1)
                yn._request({
                    uri: esUrl + '/package/ya-npm-search-server'
                }, function(err, val) {
                    assert.ok(val._source._github.watchers_count >= 0)
                    assert.ok(val._source._max_count >= 0)
                    done()
                })
            })
        })
    })

    // remote access!
    describe.skip('updateMeta()', function() {
        it('should return ok_ids', function(done) {
            gh.updateMeta(esUrl, 10, function(err, val) {
                assert.equal(val.errors.length, 0)
                assert.equal(val.ok_ids.length, 1)
                var d = new Date(new Date() - 5000)
                yn._request({
                    uri: esUrl + '/package/ya-npm-search-cli'
                }, function(err, val) {
                    assert.ok(val._source._github.watchers_count >= 0)
                    assert.ok(val._source._github.forks_count >= 0)
                    assert.ok(val._source._max_count >= 0)
                    assert.ok(new Date(val._source._github.got_at) > d)
                    assert.ok(new Date(val._source._github.checked_at) > d)
                    done()
                })
            })
        })
    })
})
