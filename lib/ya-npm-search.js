var fs = require('fs')
var util = require('util')
var path = require('path')
var request = require('request')
var querystring = require('querystring')

function initIndex(esUrl, callback) {
    request({ uri: esUrl + '/_status' }, function(err, res, val) {
        if (res.statusCode != 404) {
            return callback(null, { ok: true, exists: true })
        }
        var mpath = path.join(__dirname, 'mappings.json')
        fs.readFile(mpath, function(err, val) {
            if (err) {
                return callback(err)
            }
            request.put({
                uri: esUrl,
                json: { mappings: JSON.parse(val) }
            }, function(err, res, val) {
                callback(err, val)
            })
        })
    })
}

function updateIndex(esUrl, opt, callback) {
    opt = opt || {}
    var meta = opt.meta || {}
    getLastUpdate(esUrl, function(err, val) {
        var opt =  val ? { startkey: val } : {}
        importData(opt, function(err, val) {
            if (err) {
                return callback && callback(err)
            }
            var updated = val.updated
            var keys = Object.keys(val.val)
            keys.forEach(function(i) {
                if (meta[i]) {
                    Object.keys(meta[i]).forEach(function(j) {
                        val.val[i][j] = meta[i][j]
                    })
                }
                val.val[i]._max_count = Math.max(
                    val.val[i].depended || 0,
                    val.val[i].starred || 0,
                    val.val[i].github_forks_count || 0,
                    val.val[i].github_watchers_count || 0
                )
            })
            bulkUpdate(esUrl, {
                keys: keys,
                data: val.val
            }, function(err, val) {
                if (err) {
                    return callback && callback(err)
                }
                if (updated) {
                    countIndex(esUrl, function(err, count) {
                        var v = {
                            updated: updated,
                            size: keys.length// ,
                            // created_at: new Date()
                        }
                        if (typeof count == 'number') {
                            v.total = count
                        }
                        updateLastUpdate(esUrl, v, function(err, val) {
                            callback(err, v)
                        })
                    })
                }
            })
        })
    })
}

function getLastUpdate(esUrl, callback) {
    request({
        uri: esUrl + '/update/_search',
        json: {
            sort: [{ _timestamp: 'desc' }],
            fields: ['_timestamp', '_source'],
            size: 1
        }
    }, function(err, res, val) {
        callback(err || val.error, val && val.hits &&
                 val.hits.hits[0] && val.hits.hits[0]._id)
    })
}

function updateLastUpdate(esUrl, v, callback) {
    request.put({
        uri: esUrl + '/update/' + v.updated + '?refresh=true',
        json: v
    }, function(err, res, val) {
        callback(err, val)
    })
}

function bulkUpdate(esUrl, opt, callback) {
    var keys = opt.keys || []
    var size = opt.size || 200
    var data = opt.data || {}
    if (keys.length === 0) {
        return callback && callback(null, true)
    }
    var t = keys.slice(0, size).map(function(i) { return data[i] })
    !opt.silent && util.log(JSON.stringify(['bulkUpdate', { size: t.length }]))
    postBulk(esUrl, t, function(err, val) {
        if (err) {
            return callback && callback(err)
        }
        var errors = val.items.filter(function(i) { return i.index.error })
        if (errors.length > 0) {
            !opt.silent && util.log(JSON.stringify(['updateIndexErr', errors]))
        }
        setTimeout(function() {
            opt.keys = keys.slice(size)
            bulkUpdate(esUrl, opt, callback)
        }, opt.interval || 100)
    })
}

function postBulk(esUrl, data, callback) {
    var index = esUrl.split('/')[3]
    var u = esUrl + '/_bulk?refresh=true'
    var body = [''].concat(data).reduce(function(r, i) {
        return r + JSON.stringify({
            index: { _index: index, _type: 'package', _id: i.name }
        }) + '\n' + JSON.stringify(convertPkg(i)) + '\n'
    })
    request.post({ uri: u, body: body }, function(err, res, val) {
        if (err) {
            return callback(err)
        }
        try {
            var v = JSON.parse(val)
            callback(err || v.error, v)
        }
        catch (err) {
            callback(err)
        }
    })
}

// users -> array
// version -> array
function convertPkg(pkg) {
    if (pkg.users) {
        pkg.users = Object.keys(pkg.users)
    }
    if (pkg.versions) {
        pkg.versions = Object.keys(pkg.versions)
    }
    if (typeof pkg.repository == 'string') {
        // array-promise
        // repository: 'https://github.com/bnoguchi/array-promise.git',
        // bounce
        // repository: 'http://github.com/weepy/bounce',
        pkg.repository = { url: pkg.repository }
        if (/\.git$/.test(pkg.repository)) {
            pkg.repository.type = 'git'
        }
    }
    // geohash
    // author: [ 'Chris Williams', 'David Troy' ],
    if (pkg.author && pkg.author.length) {
        pkg.author = { name: pkg.author.join(', ') }
    }
    if (typeof pkg.keywords == 'string') {
        pkg.keywords = pkg.keywords.split(/[, ]+/).map(function(i) {
            return i.trim()
        })
    }
    return pkg
}

function importData(opt, callback) {
    if (typeof opt == 'function' && typeof callback == 'undefined') {
        callback = opt
        opt = {}
    }
    var urls = ['http://registry.npmjs.org/-/all/',
                'http://registry.npmjs.org/-/_view/dependedUpon?group_level=1',
                'http://registry.npmjs.org/-/_view/browseStarPackage?group_level=1']
    if (opt.startkey) {
        urls[0] += 'since?stale=update_after&startkey=' + opt.startkey
    }
    seqRequest(urls.map(function(i) {
        return { uri: i, json: true }
    }), [], function(err, val) {
        if (err) {
            return callback(err)
        }
        mergeViewAttr(val[1], val[0], 'depended')
        mergeViewAttr(val[2], val[0], 'starred')
        var updated = val[0]._updated
        delete val[0]._updated
        callback(null, { updated: updated, val: val[0] })
    })
}

function seqRequest(list, results, callback) {
    if (list.length === 0) {
        return callback && callback(null, results)
    }
    if (list[0]._silent) {
        delete list[0]._silent
    }
    else {
        util.log(JSON.stringify(['get', list[0].uri]))
    }
    request(list[0], function(err, res, val) {
        if (err) {
            return callback && callback(err)
        }
        seqRequest(list.slice(1), results.concat(val), callback)
    })
}

function mergeViewAttr(from, to, attr) {
    from.rows.forEach(function(i) {
        var k = i.key[0].trim()
        var obj = to[k] || to[k.toLowerCase()]
        if (obj) {
            obj[attr] = i.value
        }
    })
    return to
}

function countIndex(esUrl, cond, callback) {
    if (typeof cond == 'function') {
        callback = cond
        cond = true
    }
    request({
        uri: esUrl + '/package/_count',
        json: (cond || true)
    }, function(err, res, val) {
        err = err || (val && val._shards && val._shards.failures)
        callback(err, err ? null : (val && val.count))
    })
}

function patch(opt, obj, callback) {
    var u = (opt.uri || opt.url).replace(/\/$/, '')
    request({
        uri: u, json: true
    }, function(err, res, val) {
        if (!err && !(/^2../).test(res.statusCode)) {
            err = new Error(res.statusCode)
        }
        if (err) {
            return callback(err, { result: 'get_error', res: val })
        }
        var s = val._source
        var update = false
        Object.keys(obj).forEach(function(i) {
            if (s[i] !== obj[i]) {
                s[i] = obj[i]
                update = true
            }
        })
        var param = opt.param || {}
        param.version = val._version
        u = u + '?' + querystring.stringify(param)
        if (!update) {
            return callback(null, { result: 'skip' })
        }
        request.put({
            uri: u, json: s
        }, function(err, res, val) {
            if (!err && !(/^2../).test(res.statusCode)) {
                err = new Error(res.statusCode)
            }
            if (err) {
                return callback(err, { result: 'update_error', res: val })
            }
            return callback(err, { result: 'update', res: val })
        })
    })
}

function patchByScript(opt, obj, callback) {
    var sc = [''].concat(Object.keys(obj)).reduce(function(r, i) {
        return r + 'ctx._source.' + i + ' = ' + i + ';'
    })
    var param = querystring.stringify(opt.param || {})
    var u = (opt.uri || opt.url).replace(/\/$/, '') + '/_update' +
        ((param.length > 0) ? '?' + param : '')
    request.post({
        uri: u,
        json: {
            script: sc,
            params: obj
        }
    }, function(err, res, val) {
        if (!err && !(/^2../).test(res.statusCode)) {
            err = new Error(res.statusCode)
        }
        callback(err, val)
    })
}

function seq(list, interval, results, callback) {
    results = results || []
    callback = callback || function() {}
    if (list.length === 0) {
        var errs = results.map(function(i) { return i[0] } )
        var vals = results.map(function(i) { return i[1] } )
        return callback(errs.some(function(i) { return i }) ? errs : null, vals)
    }
    list[0](function(err, val) {
        results.push([err, val])
        var rest = seq.bind(null, list.slice(1), interval, results, callback)
        // false null -> recursive, undefined -> setTimeout 1000
        if (interval === false || interval === null) {
            rest()
        }
        else {
            setTimeout(rest, interval === 0 ? 0 : (interval || 1000))
        }
    })
}

function mergeMeta(esUrl, meta, callback) {
    var keys = Object.keys(meta)
    callback = callback || function() {}
    if (keys.length === 0) {
        return callback(null, [])
    }
    var length = keys.length
    var list = keys.map(function(i, index) {
        return function(done) {
            // use script update
            patch = patchByScript
            patch({
                url: esUrl + '/package/' + i,
                param: {
                    refresh: true
                }
            }, meta[i], function(err, val) {
                util.log(JSON.stringify(['mergeMeta', i, String(index + 1) + '/' +
                                         String(length),
                                         { err: err }, val]))
                done()
            })
        }
    })
    seq(list, 100, [], callback)
}

exports.initIndex = initIndex
exports.updateIndex = updateIndex
exports.getLastUpdate = getLastUpdate
exports.updateLastUpdate = updateLastUpdate
exports.bulkUpdate = bulkUpdate
exports.postBulk = postBulk
exports.convertPkg = convertPkg
exports.importData = importData
exports.seqRequest = seqRequest
exports.mergeViewAttr = mergeViewAttr
exports.countIndex = countIndex
exports.patch = patch
exports.seq = seq
exports.mergeMeta = mergeMeta