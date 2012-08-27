var assert = require('assert')
var path = require('path')
var request = require('request')
var yaNpmSearch = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))

var esUrl = (process.env.YA_NPM_SEARCH_TEST_ES_INDEX_URL ||
             'http://localhost:9200/npm-test').replace(/\/$/, '')

function testInitIndex(next) {
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
                next()
            })
        })
    })
}

function testUpdateIndex(next) {
    // TODO
    next()
}

function testLastUpdate(next) {
    var v = { updated: new Date().getTime() }
    yaNpmSearch.updateLastUpdate(esUrl, v, function(err, val) {
        yaNpmSearch.getLastUpdate(esUrl, function(err, val) {
            assert.ok(!err)
            assert.equal(val, String(v.updated))
            next()
        })
    })
}

function testBulkUpdate(next) {
    var d ={
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
        next()
    })
}

function testPostBulk(next) {
    var d = [{ name: 'test-package-01' }, { name: 'test-package-02' }]
    yaNpmSearch.postBulk(esUrl, d, function(err, val) {
        assert.ok(!err)
        assert.equal(val.items.length, 2)
        assert.ok(val.items.every(function(i) { return i.index.ok }))
        next()
    })
}

function testConvertPkg(next) {
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
    next()
}

function testImportData(next) {
    // TODO
    next()
}

function testImportMeta(next) {
    // TODO
    next()
}

function testSeqRequest(next) {
    var rs = [{ uri: esUrl + '/_status', json: true, _silent: true },
              { uri: esUrl + '/_stats', json: true, _silent: true }]
    yaNpmSearch.seqRequest(rs, [], function(err, val) {
        assert.ok(!err)
        assert.ok(val.every(function(i) { return i.ok } ))
        next()
    })
}

function testMergeViewAttr(next) {
    var from = { rows: [{ key: ['a'], value: 5 }] }
    var to = { a: {} }
    var r = yaNpmSearch.mergeViewAttr(from, to, 'starred')
    assert.ok(r.a.starred)
    next()
}

function testCountIndex(next) {
    yaNpmSearch.countIndex(esUrl, function(err, val) {
        assert.ok(!err)
        assert.ok(val >= 0)
        var cond = { term: { name: 'test' } }
        yaNpmSearch.countIndex(esUrl, cond, function(err, val) {
            assert.ok(!err)
            assert.ok(val >= 0)
            next()
        })
    })
}

var tests = [testInitIndex, testUpdateIndex,
             testLastUpdate, testBulkUpdate, testPostBulk,
             testConvertPkg, testImportData,
             testSeqRequest, testMergeViewAttr, testCountIndex]
tests.concat(function(){ console.log('ok') }).reduceRight(function(r, i) {
    return i.bind(null, r)
})()