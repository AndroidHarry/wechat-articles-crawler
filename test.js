const hlog = require("./hlog");
hlog.logger.debug("DEBUG TEST");

const fs = require('fs');
var fakeHtml = fs.readFileSync('./fake.html').toString();
console.log(typeof fakeHtml);

function injectJquery(body) {
    return body.replace(/<\/head>/g, '<script src="https://cdn.bootcss.com/jquery/3.2.1/jquery.min.js"></script><script src="https://cdn.bootcss.com/socket.io/2.0.4/socket.io.js"></script></head>')
}

var injectJsFile = fs.readFileSync('./profileInjectJs.js', 'utf-8').replace('{$IP}', '111');
var injectJs = `<script id="injectJs" type="text/javascript">${injectJsFile}</script>`;

let body = injectJquery(fakeHtml.toString()).replace(/<\/body>/g, injectJs + '</body>');

hlog.logger.debug(body);

if (/qq.com/i.test('https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=MjM5MjAxNDM4MA==&scene=124')) {
    hlog.logger.debug('qq test ok');
} else {
    hlog.logger.debug('qq test fail');
}
