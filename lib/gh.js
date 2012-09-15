var fs = require('fs')
var util = require('util')
var path = require('path')
var request = require('request')
var yn = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))

function requestGithub(u, callback) {
    request({ uri: u, json: true }, function(err, res, val) {
        var remaining = parseInt(res.headers['x-ratelimit-remaining'], 10)
        util.log(JSON.stringify(['requestGithub', u, res.statusCode,
                                 'limit-remaining', remaining]))
        if (!err && !(/^2../).test(res.statusCode)) {
            err = new Error(res.statusCode)
        }
        callback(err, val, remaining)
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

function getRepos(user, name, callback) {
    var u = 'https://api.github.com/repos/' + user + '/' + name
    requestGithub(u, function(err, val, remaining) {
        if (val && 'name' in val) {
            return callback(null, val, remaining)
        }
        callback(err, val, remaining)
    })
}

function findRepos(list, callback) {
    callback = callback || function() {}
    if (list.length === 0) {
        return callback()
    }
    getRepos(list[0].user, list[0].repos, function(err, val, r) {
        if (!err && val && 'name' in val) {
            return callback(null, val, r)
        }
        setTimeout(findRepos.bind(null, list.slice(1), callback), 0)
    })
}

function detectRepos(pkg, userMap, reposMap) {
    userMap = userMap || {}
    reposMap = reposMap || {}
    var r = []
    var rg = (/github\.com\/([^\/]+)\/([^\/]+)/)
    if (pkg.repository && pkg.repository.url) {
        var rr = rg.exec(pkg.repository.url)
        if (rr) {
            return [{ user: rr[1], repos: rr[2].replace(/\.git$/, '') }]
        }
    }
    if (!pkg.maintainers || !pkg.maintainers[0]) {
        return r
    }
    pkg.maintainers.slice(0, 3).forEach(function(i) {
        if (i.name) {
            var user = userMap[i.name] || i.name
            var name = reposMap[pkg.name] || pkg.name
            if (/@/.test(user)) {
                user = user.replace(/@.+$/, '')
            }
            r.push({ user: user, repos: name })
            if (!(/^node-/).test(name)) {
                r.push({ user: user, repos: 'node-' + name })
            }
        }
    })
    return r
}

function findAllRepos(esUrl, limit, callback) {
    limit = limit || 100
    callback = callback || function() {}
    var userMap = {
        'tjholowaychuk': 'visionmedia',
        'richard.astbury': 'richorama',
        'steven.looman': 'StevenLooman',
        'jozef.dransfield': 'jozefdransfield',
        'k.parnell': 'kparnell',
        'alex.pilon': 'xaptronic',
        'bryan.rockwood': 'brockwood',
        'jonas.huckestein': 'jonashuckestein',
        'kenneth.koontz': 'kennethkoontz',
        'ryan.roemer': 'ryan-roemer',
        'tobiasz.cudnik': 'TobiaszCudnik',
        'rhio.kim': 'rhiokim',
        'r.varonos': 'rvaronos',
        'rob.robb.ns': 'robrobbins'
    }
    var reposMap = {
    }
    _request({
        uri: esUrl + '/package/_search',
        json: {
            filter: { not: { exists: { field: '_github.ok' } } },
            size: limit
        }
    }, function(err, val) {
        var len = val.hits.hits.length
        util.log(JSON.stringify(['findAllRepos', esUrl.split('/')[2],
                                 'total', val.hits.total,'hits', len]))
        if (len === 0) {
            return callback()
        }
        var list = val.hits.hits
        yn.seq(list.map(function(i, index) { return function(done) {
            var reposList = detectRepos(i._source, userMap, reposMap)
            if (reposList.length === 0) {
                return done()
            }
            findRepos(reposList, function(err, val) {
                util.log(JSON.stringify([(index + 1) + '/' + len,
                                         i._id, val ? JSON.stringify(val) : null]))
                var d = new Date()
                var _github = { ok: false, checked_at: d }
                if (val) {
                    _github.user = val.owner.login
                    _github.repos = val.name
                    _github.forks_count = val.forks_count
                    _github.watchers_count = val.watchers_count
                    _github.got_at = d
                    _github.ok = true
                    i._source.github_watchers_count = val.watchers_count
                    i._source.github_forks_count = val.forks_count
                    i._source._max_count = Math.max(i._source.depended || 0,
                                                    i._source.starred || 0,
                                                    val.watchers_count || 0,
                                                    val.forks_count || 0)
                }
                i._source._github = _github
                done(null, i._source)
            })
        }}), 0, [], function(err, val) {
            val = (val || []).filter(function(i) { return i })
            if (val.length === 0) {
                return callback(null, {})
            }
            bulkUpdatePackage(esUrl, val, callback)
        })
    })
}

function updateMeta(esUrl, limit, callback) {
    limit = limit || 20
    callback = callback || function() {}
    var expire = 10 * 24 * 60 * 60 * 1000
    var to = new Date(new Date().getTime() - expire)
    _request({
        uri: esUrl + '/package/_search',
        json: {
            filter: { range: { '_github.got_at': { to: to } } },
            size: limit
        }
    }, function(err, val) {
        if (err) {
            return callback(err, val)
        }
        if (!val.hits.hits || val.hits.hits.length === 0) {
            return callback(null, { message: '0 package' })
        }
        var total = val.hits.total
        var len = val.hits.hits.length
        util.log(JSON.stringify(['updateGithub', esUrl.split('/')[2],
                                 'total', total, 'hits', len]))
        if (len === 0) {
            return callback()
        }
        var list = val.hits.hits.map(function(i, index) {
            return function(done) {
                getRepos(i._source._github.user, i._source._github.repos, function(err, val) {
                    var d = new Date()
                    var pf = i._source._github.forks_count || 0
                    var pw = i._source._github.watchers_count || 0
                    console.log(pf, pw)
                    console.log('XXX', val)
                    if (val && 'forks_count' in val && 'watchers_count' in val) {
                        i._source._github.forks_count = val.forks_count
                        i._source._github.watchers_count = val.watchers_count
                        i._source._github.got_at = d
                        i._source._github.checked_at = d
                        i._source.github_watchers_count = val.watchers_count
                        i._source.github_forks_count = val.forks_count
                        i._source._max_count = Math.max(i._source.depended || 0,
                                                        i._source.starred || 0,
                                                        val.watchers_count || 0,
                                                        val.forks_count || 0)
                    }
                    else {
                        i._source._github.checked_at = d
                    }
                    var dw = (i._source._github.watchers_count || 0) - pw
                    var df = (i._source._github.forks_count || 0) - pf
                    console.log('d', dw, df)
                    util.log(JSON.stringify([
                        (index + 1) + '/' + len,
                        'w', (dw > 0 ? '+' : '') + dw,
                        'f', (df > 0 ? '+' : '') + df,
                        i._id, i._source._github
                    ]))
                    done(null, i._source)
                })
            }
        })
        yn.seq(list, 100, [], function(err, val) {
            if (val && val.length > 0) {
                bulkUpdatePackage(esUrl, val, callback)
            }
        })
    })
}

function bulkUpdatePackage(esUrl, list, callback) {
    if (list.length === 0) {
        return callback(new Error('bulkUpdatePackageEmpty'))
    }
    var body = list.map(function(i) {
        return JSON.stringify({ index: { _id: i.name } }) + '\n' +
            JSON.stringify(i) + '\n'
    }).join('')
    request.post({
        uri: esUrl + '/package/_bulk?refresh=true',
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
        callback(err, r)
    })
}

function stats(esUrl, callback) {
    var expire = 10 * 24 * 60 * 60 * 1000
    var to = new Date(new Date() - expire)
    var ss = [
        { search_type: 'count' },
        { query: { match_all: {} } }, // total
        { search_type: 'count' },
        { filter: { term: { '_github.ok': true } } }, // ok
        { search_type: 'count' },
        { filter: { term: { '_github.ok': false} } }, // ng
        { search_type: 'count' },
        { filter: { not: { exists: { field: '_github.ok' } } } }, // yet
        { search_type: 'count' },
        { filter: { and: [
            { term: { '_github.ok': true } },
            { range: { got_at: { to: to  } } }
        ] } } // expired
    ]
    var body = ss.map(function(i) { return JSON.stringify(i) + '\n' }).join('')
    _request({
        uri: esUrl + '/package/_msearch', body: body, json: true
    }, function(err, val) {
        if (err) {
            return callback(err)
        }
        var r = val.responses.map(function(i) { return i.hits.total })
        callback(null, {
            total: r[0], ok: r[1], ng: r[2], yet: r[3], expired: r[4]
        })
    })
}

exports.requestGithub = requestGithub
exports._request = _request
exports.findAllRepos = findAllRepos
exports.detectRepos = detectRepos
exports.findRepos = findRepos
exports.updateMeta = updateMeta
exports.bulkUpdatePackage = bulkUpdatePackage
exports.getRepos = getRepos
exports.stats = stats
