var express = require('express')

var app = express.createServer()
app.get('/', function(req, res) {
    res.send('ok')
})
app.listen(process.env.PORT || 9990)
