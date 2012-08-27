var fs = require('fs')
var util = require('util')
var path = require('path')
var assert = require('assert')
var crypto = require('crypto')
var querystring = require('querystring')
var express = require('express')
var request = require('request')
var mustache = require('mustache')
var yaNpmSearch = require(path.join(__dirname, '..', 'lib', 'ya-npm-search'))

var esUrl = (process.env.YA_NPM_SEARCH_ES_INDEX_URL ||
             process.env.BONSAI_INDEX_URL ||
             'http://localhost:9200/npm').replace(/\/$/, '')
var template = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html.mustache')).toString()
var sortTypes = {
    'depended': [{ depended: 'desc' }, { stared: 'desc' }],
    'stared': [{ stared: 'desc' }, { depended: 'desc' }],
    'recent': [{ 'time.modified': 'desc' }, { depended: 'desc' }],
    'score': ['_score', { depended: 'desc' }]
}
var app = express.createServer(express['static'](path.join(__dirname, '..', 'public')),
                               express.bodyParser(),
                               express.logger())
var setAPIHeader = function(res) {
    res.header('Content-Type', 'application/json')
    res.header('Access-Control-Allow-Origin', '*')
    return res
}
app.get('/', function(req, res) {
    res.send(mustache.to_html(template, {}))
})
app.all('/api/raw_es_search', function(req, res) {
    if (typeof req.body != 'object') {
        return res.send('error set json body', 400)
    }
    request({
        uri: esUrl + '/package/_search',
        json: req.body
    }, function(err, _res, val) {
        return setAPIHeader(res).send(JSON.stringify(val, null, 2))
    })
})
app.get('/search', function(req, res) {
    var locals = {}
    var query = req.param('query')
    var queryOpt = {
        query: {
            query_string: {
                default_operator: 'AND',
                query: query
            }
        },
        from: parseInt(req.param('from'), 10) || 0,
        size: parseInt(req.param('size'), 10) || 20
    }
    queryOpt.size = queryOpt.size <= 100 ? queryOpt.size : 100
    var send = function(arg) {
        res.send(mustache.to_html(template, arg || {}))
    }
    if (!query) {
        return res.redirect('/')
    }
    queryOpt.sort = sortTypes[req.param('sort')] ? sortTypes[req.param('sort')] :
        sortTypes['depended']
    Object.keys(sortTypes).forEach(function(i) {
        if (i == req.param('sort')) {
            locals['sort_selected_' + i] = 'selected'
        }
    })
    request({
        uri: esUrl + '/package/_search',
        json: queryOpt
    }, function(err, _res, val) {
        if (err) {
            return send({ err: err })
        }
        locals.query = query
        locals.total = val.hits.total
        locals.results = val.hits.hits.map(convert)

        if (locals.total - (queryOpt.from + 20) > 0) {
            req.query.from = queryOpt.from + 20
            locals.next = { url: '/search?' + querystring.stringify(req.query) }

        }
        if (req.param('format') == 'json') {
            return setAPIHeader(res).send(JSON.stringify(locals, null, 2))
        }
        send(locals)
    })
})

function convert(i) {
    var s = i._source
    s.depended = s.depended || 0
    s.stared = s.stared || 0
    s.reactions = s.depended + s.stared

    s.keywords = s.keywords && s.keywords.join ? s.keywords.join(' ') : null
    if (s.maintainers) {
        s.maintainers.forEach(function(i) {
            if (i.email) {
                i.gravatar = 'http://www.gravatar.com/avatar/' +
                    crypto.createHash('md5').update(i.email, 'utf8').digest('hex')
            }
            if (i.name) {
                i.npm = 'https://npmjs.org/browse/author/' + encodeURIComponent(i.name)
            }
        })
    }
    var reg = /github\.com[\/:](.+)\/(.+)/
    var regr = reg.exec(s.repository && s.repository.url)
    if (regr) {
        s.github = {
            url: 'https://github.com/' + regr[1] + '/' + regr[2].replace(/\.git$/, '')
        }
    }
    if (s.users) {
        delete s.users
    }
    return s
}

function update(esUrl, opt) {
    opt = opt || {}
    yaNpmSearch.initIndex(esUrl, function(err, val) {
        if (err || val) {
            util.log(JSON.stringify(['initIndex', err, val]))
        }
        var up = yaNpmSearch.updateIndex.bind(null, esUrl, function(err, val) {
            util.log(JSON.stringify(['updated', err, val]))
        })
        if (!opt.disableInterval) {
            setInterval(up, opt.updateInterval || 20 * 60 * 1000)
        }
        up()
    })
}
exports.server = app
exports.update = update
exports.start = function start(opt, callback) {
    opt = opt || {}
    port = opt.port || process.env.PORT || 9990
    if (opt.esUrl) {
        esUrl = opt.esUrl
    }
    util.log(JSON.stringify(['startWeb', 'port', port, 'es', esUrl]))
    app.listen(port, callback)
}
exports.stop = function stop() {
    app.close()
}
if (process.argv[1] == __filename) {
    if (process.argv[2] == '-i') {
        yaNpmSearch.initIndex(esUrl, function(err, val) {
            if (err || val) {
                util.log(JSON.stringify(['initIndex', err, val]))
            }
        })
    }
    else if (process.argv[2] == '-d') {
        request.del({ uri: esUrl }, function(err, res, val) {
            util.log(JSON.stringify(['deleteIndex', err, val]))
        })
    }
    else {
        exports.start()
        if (process.argv[2] != '-n') {
            update(esUrl)
        }
    }
}
