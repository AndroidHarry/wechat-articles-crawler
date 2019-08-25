var serverUrl = 'http://{$IP}:9000';
var socket = io(serverUrl+'/wechat').connect(serverUrl);

socket.on('client_jump_url', function (data) {
    window.localStorage.localIndex = data.index;
    window.localStorage.biz = data.biz;
    window.location = data.url;
});

socket.on('connect', function () {
    var crawler_placeholder = $('#crawler_placeholder').text().trim();
    if (crawler_placeholder === 'autorun') {
        //  验证通过，是服务端拦截后的网页
        socket.emit('crawler_msg', {
            url: window.location.href,
            biz: window.localStorage.biz, 
            index: window.localStorage.localIndex
        });
    }
});
