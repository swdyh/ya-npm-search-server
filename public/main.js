function throttle(f, interval) {
    var timer = null
    return function() {
        if (!timer) {
            timer = setTimeout(function() {
                f()
                timer = null
            }, interval || 500)
        }
    }
}

function httpGet(opt, callback) {
    var req = new XMLHttpRequest()
    req.onreadystatechange = function() {
        if (req.readyState === 4) {
            if ((/^2../).test(req.status)) {
                callback(null, req.responseText)
            }
            callback(req.status)
        }
    }
    var loc_ = location.href.split('/')
    var url_ = opt.url.split('/')
    if (opt.cross || (loc_[0] === url_[0] && loc_[2] === url_[2])) {
        req.open('GET', opt.url)
        req.send()
    }
}

function append(callback) {
    var n = document.querySelector('a[rel="next"]')
    if (n && n.href) {
        var u = (/format=html_body/).test(n.href) ? n.href : n.href + '&format=html_body'
        httpGet({ url: u }, function(err, val) {
            if (err) {
                return callback(err)
            }
            var div = document.createElement('div')
            div.innerHTML = val
            var df = document.createDocumentFragment()
            for (var i = 0; i < div.childNodes.length; i++) {
                var c = div.childNodes[i]
                if ((/div/i).test(c.nodeName)) {
                    df.appendChild(c)
                }
            }
            n.parentNode.parentNode.insertBefore(df, n.parentNode)
            n.parentNode.removeChild(n)
        })
    }
    else {
        callback(null, true)
    }
}

var onscroll = throttle(function() {
    var wh = window.innerHeight
    var r = document.body.scrollHeight - window.scrollY - (wh * 2)
    var loading = false
    if (r < 0 && !loading) {
        loading = true
        append(function(err, val) {
            loading = false
            if (val) {
                window.removeEventListener('scroll', onscroll, false)
            }
        })
    }
}, 1000)
window.addEventListener('scroll', onscroll, false)
onscroll()

window.addEventListener('DOMContentLoaded', function() {
    var q = document.getElementById('query')
    q && q.focus()
}, false)

