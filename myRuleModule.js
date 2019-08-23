const hlog = require("./hlog");
hlog.logger.debug("DEBUG TEST");

const Koa = require('Koa');
const Router = require('koa-router');
const fs = require('fs');
const ip = require('ip').address();

const app = new Koa();
const moment = require('moment');
var server = require('http').createServer(app.callback());	//	TBD
var io = require('socket.io')(server);

const router = new Router();

// error handle
app.use(async function (ctx, next) {
    try {
        await next();
    } catch (e) {
        hlog.logger.debug('error' + e.toString() + '$' + ctx.toString());
        // console.log('error', e, ctx);
        app.emit('error', e, ctx);
    }
});

app.use(require('koa2-cors')());

let articles = [], index = 0;

router.get('/', async (ctx, next) => {
    ctx.body = fs.readFileSync('./result.html', 'utf-8');
})


app.use(router.routes());	//	TBD

server.listen(9000);
require("openurl").open("http://localhost:9000");

let wechatIo = io.of('/wechat'), resultIo = io.of('/result');
wechatIo.on('connection', function (socket) {

    socket.on('crawler', (crawData) => {
        crawData.crawTime = moment().format('YYYY-MM-DD HH:mm');

        let newData = Object.assign({
            otitle: articles[index].title,
            ourl: articles[index].content_url,
            author: articles[index].author
        }, crawData);

        socket.emit('success');

        resultIo.emit('newData', newData);
        //  harry
        hlog.logger.debug('newData: ' + JSON.stringify(newData));

        index++;
        if (articles[index]) {
            socket.emit('url', {url: articles[index].content_url, index: index, total: articles.length});
        } else {
            socket.emit('end', {});
        }
    });


    socket.on('noData', (crawData) => {
        if (articles[index].content_url) {  //  harry, content_url 可能不存在
            //  console.warn(' 超时没有爬取到？ url: ', articles[index].content_url);
            hlog.logger.warn(' 超时没有爬取到？ url: ' + articles[index].content_url);
        }
        
        index++;
        if (articles[index]) {
            socket.emit('url', {url: articles[index].content_url, index: index, total: articles.length});
        } else {
            socket.emit('end', {});
        }
    });

});


function injectJquery(body) {
    return body.replace(/<\/head>/g, '<script src="https://cdn.bootcss.com/jquery/3.2.1/jquery.min.js"></script><script src="https://cdn.bootcss.com/socket.io/2.0.4/socket.io.js"></script></head>')
}

hlog.logger.debug('ip: ' + ip); //  harry
var injectJsFile = fs.readFileSync('./injectJs.js', 'utf-8').replace('{$IP}', ip);
var articleInjectJsFile = fs.readFileSync('./articleInjectJs.js', 'utf-8').replace('{$IP}', ip);
var injectJs = `<script id="injectJs" type="text/javascript">${injectJsFile}</script>`;
var articleInjectJs = `<script id="injectJs" type="text/javascript">${articleInjectJsFile}</script>`;
var fakeImg = fs.readFileSync('./fake.png');
const maxLength = 10;   //  3000;
module.exports = {
    summary: 'wechat articles crawler',
    *beforeSendRequest(requestDetail) {
        // 如果请求图片，直接返回一个本地图片，提升性能
        let accept = requestDetail.requestOptions.headers['Accept'];
        if (accept && accept.indexOf('image') !== -1 && requestDetail.url.indexOf('mmbiz.qpic.cn/') !== -1) {
            return {
                response: {
                    statusCode: 200,
                    header: {'content-type': 'image/png'},
                    body: fakeImg
                }
            };
        }
    },
    *beforeSendResponse(requestDetail, responseDetail) {
        // 历史文章列表
        if (requestDetail.url.indexOf('mp.weixin.qq.com/mp/profile_ext?') !== -1 && requestDetail.requestOptions.method === 'GET') {
            // console.log('get  profile_ext', responseDetail.response.header['Content-Type']);    //  text/html or application/json; charset=UTF-8

            let contentType = responseDetail.response.header['Content-Type'] || '';
            contentType = 'contentType: ' + contentType;
            hlog.loggerBeforeRes.debug('history_list ' + contentType + ';' + requestDetail.url + ';');

            const newResponse = responseDetail.response;
            let body = responseDetail.response.body.toString();
            let newAdd = [];

            hlog.loggerBeforeRes.debug('history_list begin responseDetail.response.body');
            hlog.loggerBeforeRes.debug(body);
            hlog.loggerBeforeRes.debug('history_list end responseDetail.response.body');

            let can_msg_continue = true;

            if (responseDetail.response.header['Content-Type'].indexOf('text/html') !== -1) {

                hlog.loggerBeforeRes.debug('history_list_1');

                let msgReg = /var msgList = \'(.*?)\';/;

                let execBody = msgReg.exec(body)[1];
                let msgList = JSON.parse(execBody.replace(/&quot;/g, '"'));//JSON.parse(msgReg.exec(body)[1]);

                msgList.list.forEach((v, i) => {
                    if (v.app_msg_ext_info) {
                        v.app_msg_ext_info.del_flag != 4 && v.app_msg_ext_info.content_url && newAdd.push(
                            Object.assign({}, v.app_msg_ext_info, v.comm_msg_info)
                        )
                        let subList = (v.app_msg_ext_info && v.app_msg_ext_info.multi_app_msg_item_list) || [];
                        subList.forEach(v1 => {
                            v1.del_flag != 4 && v1.content_url && newAdd.push(
                                Object.assign({}, v1, v.comm_msg_info)
                            )
                        })
                    }
                })

                newResponse.body = injectJquery(body).replace(/<\/body>/g, injectJs + '</body>');

                let header = Object.assign({}, responseDetail.response.header);
                // 删除微信的安全策略，禁止缓存
                delete header['Content-Security-Policy'];
                delete header['Content-Security-Policy-Report-Only'];
                header['Expires'] = 0;
                header['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                newResponse.header = header;

            } else {
                hlog.loggerBeforeRes.debug('history_list_2');

                can_msg_continue = body.indexOf('can_msg_continue":1') !== -1;

                let regList = /general_msg_list":"(.*)","next_offset/;

                let list = regList.exec(body)[1];

                let reg = /\\"/g;

                let general_msg_list = JSON.parse(list.replace(reg, '"'));

                general_msg_list.list.forEach((v, i) => {
                    if (v.app_msg_ext_info) {
                        v.app_msg_ext_info.del_flag != 4 && v.app_msg_ext_info.content_url && newAdd.push(
                            Object.assign({}, v.app_msg_ext_info, v.comm_msg_info)
                        )
                        let subList = (v.app_msg_ext_info && v.app_msg_ext_info.multi_app_msg_item_list) || [];
                        subList.forEach(v1 => {
                            v1.del_flag != 4 && v1.content_url && newAdd.push(
                                Object.assign({}, v1, v.comm_msg_info)
                            )
                        })
                    }
                });

            }

            newAdd.forEach(v => {
                //  harry, &amp; -> & 
                v.content_url = v.content_url.replace(/amp;/g, '').replace(/\\\//g, '/').replace('#wechat_redirect', '');
            })


            if (articles.length <= maxLength)
                articles = articles.concat(newAdd);

            // console.log('获取文章的列表总数articles.length ', articles.length);
            hlog.loggerBeforeRes.debug('history_list get articles.length=' + articles.length);

            if (!can_msg_continue || articles.length > maxLength) {
                fetchListEnd_StartArticle();
            }


            return {response: newResponse};


        } else if (requestDetail.url.indexOf('mp.weixin.qq.com/mp/getappmsgext?') !== -1 && requestDetail.requestOptions.method == 'POST') {   // 获取评论数，点赞数

        } else if (requestDetail.url.indexOf('mp.weixin.qq.com/s?') !== -1 && requestDetail.requestOptions.method == 'GET') {  // 文章内容
            let contentType = responseDetail.response.header['Content-Type'] || '';
            contentType = 'contentType: ' + contentType;
            hlog.loggerBeforeRes.debug('article_content ' + contentType + ';' + requestDetail.url + ';');

            const newResponse = responseDetail.response;
            let body = responseDetail.response.body.toString();

            //hlog.loggerBeforeRes.debug('article_content begin responseDetail.response.body');
            //hlog.loggerBeforeRes.debug(body);
            //hlog.loggerBeforeRes.debug('article_content end responseDetail.response.body');

            newResponse.body = injectJquery(body).replace(/\s<\/body>\s/g, articleInjectJs + '</body>');

            let header = Object.assign({}, responseDetail.response.header);
            // 删除微信的安全策略，禁止缓存
            delete header['Content-Security-Policy'];
            delete header['Content-Security-Policy-Report-Only'];
            header['Expires'] = 0;
            header['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            newResponse.header = header;

            return {response: newResponse};
        } else if (requestDetail.url.indexOf('mp.weixin.qq.com') !== -1 && requestDetail.requestOptions.method == 'GET') {  // 其他来自 weixin 的链接
            let contentType = responseDetail.response.header['Content-Type'] || '';
            contentType = 'contentType: ' + contentType;
            hlog.loggerBeforeRes.debug('qq.com, ' + contentType + ';' + requestDetail.url + ';');

            const newResponse = responseDetail.response;
            let body = responseDetail.response.body.toString();

            hlog.loggerBeforeRes.debug('qq_com begin responseDetail.response.body');
            hlog.loggerBeforeRes.debug(body);
            hlog.loggerBeforeRes.debug('qq_com end responseDetail.response.body');
        }
    },
    *beforeDealHttpsRequest(requestDetail) {
        return true;
    },
};

function fetchListEnd_StartArticle() {
    hlog.loggerBeforeRes.debug('history_list final get articles.length=' + articles.length);
    // console.log('最终获取文章的列表总数： ', articles.length);

    wechatIo.emit('url', {url: articles[0].content_url, index: 0, total: articles.length});
}


function resetData() {
    index = 0;
    articles = [];
}