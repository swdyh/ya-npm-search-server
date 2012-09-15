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
            var packages = val.val
            var keys = Object.keys(packages)
            if (keys.length === 0) {
                return callback(null, { message: '0 update' })
            }
            request({
                uri: esUrl + '/package/_mget',
                json: { ids: keys }
            }, function(err, res, val) {
                if (err) {
                    return callback(err, { message: '_mget error', val: val })
                }
                var list = val.docs.map(function(i) {
                    if (i.exists) {
                        var pkg = packages[i._id]
                        Object.keys(pkg).forEach(function(j) {
                            i._source[j] = pkg[j]
                        })
                        return i._source
                    }
                    else {
                        return packages[i._id]
                    }
                })
                var body = list.map(function(i) {
                    return JSON.stringify({ index: { _id: i.name } }) + '\n' +
                        JSON.stringify(i) + '\n'
                }).join('')
                request.post({
                    uri: esUrl + '/package/_bulk',
                    body: body
                }, function(err, res, val) {
                    if (err) {
                        return callback(err, val)
                    }
                    try {
                        val = JSON.parse(val)
                    }
                    catch(e) {
                        return callback(e, { message: '_bulk json parse error' })
                    }
                    var r = {
                        errors: val.items.filter(function(i) {
                            return !i.index.ok
                        }),
                        ok_ids: val.items.filter(function(i) {
                            return i.index.ok
                        }).map(function(i) { return i.index._id })
                    }
                    if (updated) {
                        updateLastUpdate(esUrl, updated, keys.length, function(err, val) {
                            r.lastupdate = val
                            return callback(null, r)
                        })
                    }
                    else {
                        return callback(null, r)
                    }
                })
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

function updateLastUpdate(esUrl, updated, size, callback) {
    callback = callback || function() {}
    countIndex(esUrl, function(err, count) {
        var v = {
            updated: updated,
            size: size // keys.length
        }
        if (typeof count == 'number') {
            v.total = count
        }
        request.put({
            uri: esUrl + '/update/' + v.updated + '?refresh=true',
            json: v
        }, function(err, res, val) {
            callback(err, [val, v])
        })
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

function _request(opt, callback) {
    if (typeof opt.json == 'undefined') {
        opt.json = true
    }
    request(opt, function(err, res, val) {
        if (!err && !(/^2../).test(res.statusCode)) {
            err = new Error(res.statusCode)
        }
        callback(err, val, res)
    })
}

function loadView(name, callback) {
    var views = {
        starred: 'http://registry.npmjs.org/-/_view/browseStarPackage?group_level=1',
        depended: 'http://registry.npmjs.org/-/_view/dependedUpon?group_level=1'
    }
    if (!views[name]) {
        return callback(null, {})
    }
    util.log(JSON.stringify(['loadView', name, views[name]]))
    _request({ uri: views[name] }, function(err, val) {
        if (!err && (!val || !val.rows)) {
            err = new Error('no_rows')
        }
        if (err) {
            return callback(err)
        }
        var r = {}
        val.rows.forEach(function(i) {
            r[i.key[0]] = {}
            r[i.key[0]][name] = i.value
        })
        callback(null, r)
    })
}

function updateAllAttrs(esUrl, obj, callback) {
    var keys = Object.keys(obj)
    _request({
        uri: esUrl + '/package/_mget',
        json: { ids: keys }
    }, function(err, val) {
        if (err) {
            return callback(err)
        }
        var ps = val.docs.filter(function(i) { return i.exists })
        var body = ps.map(function(i) {
            Object.keys(obj[i._id]).forEach(function(j) {
                i._source[j] = obj[i._id][j]
            })
            return JSON.stringify({ index: { _id: i._id, _version: i._version } }) +
                '\n' + JSON.stringify(i._source) + '\n'
        }).join('')
        request.post({
            uri: esUrl + '/package/_bulk?refresh=true',
            body: body,
            json: true
        }, function(err, res, val) {
            callback(err, val)
        })
    })
}

function updateViewAttrs(esUrl, callback) {
    loadView('depended', function(err, val_d) {
        if (err) {
            return callback(err)
        }
        loadView('starred', function(err, val_s) {
            if (err) {
                return callback(err)
            }
            var r = {}
            Object.keys(val_d).forEach(function(i) {
                r[i] = r[i] || {}
                r[i].depended = val_d[i].depended
            })
            Object.keys(val_s).forEach(function(i) {
                r[i] = r[i] || {}
                r[i].starred= val_s[i].starred
            })
            updateAllAttrs(esUrl, r, callback)
        })
    })
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
exports._request = _request
exports.loadView = loadView
exports.updateAllAttrs = updateAllAttrs
exports.updateViewAttrs = updateViewAttrs
