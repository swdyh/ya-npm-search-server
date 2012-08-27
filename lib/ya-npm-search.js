var fs = require('fs')
var util = require('util')
var path = require('path')
var request = require('request')

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

function updateIndex(esUrl, callback) {
    getLastUpdate(esUrl, function(err, val) {
        var opt =  val ? { startkey: val } : {}
        importData(opt, function(err, val) {
            if (err) {
                return callback && callback(err)
            }
            var updated = val.updated
            var keys = Object.keys(val.val)
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
        mergeViewAttr(val[2], val[0], 'stared')
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
