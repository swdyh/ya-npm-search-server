var fs = require('fs')
var path = require('path')
var mustache = require('mustache')
var robotskirt = require('robotskirt')

var pubDir = path.join(__dirname, '..', 'public')

var indexMustache = fs.readFileSync(path.join(pubDir, 'index.html.mustache')).toString()
var indexPath = path.join(pubDir, 'index.html')
console.log(indexPath)
fs.writeFile(indexPath, mustache.to_html(indexMustache, {}))

var mds = fs.readdirSync(path.join(__dirname, '..', 'docs')).filter(function(i) {
    return (/\.md$/).test(i)
})
mds.forEach(function(i) {
    var s = fs.readFileSync(path.join(__dirname, '..', 'docs', i))
    robotskirt.toHtml(s, function(html) {
        var t = html.toString().replace(/<h2>/g, '<h3>').replace(/<\/h2>/g, '</h3>').replace(/<h1>/g, '<h2>').replace(/<\/h1>/g, '</h2>').replace(/<h3>([^<]+)<\/h3>/g, function(a, b) { var c = b.replace(/\s/g, '_'); return '<h3 id="' + c + '">' + b + '</h3>' })
        var locals = { hide_search: true }
        locals[i.replace('.md', '')] = { html: t }
        var to = path.join(pubDir, i.replace('.md', '.html'))
        var r = mustache.to_html(indexMustache, locals)
        console.log(to)
        fs.writeFile(to, r)
    })
})
