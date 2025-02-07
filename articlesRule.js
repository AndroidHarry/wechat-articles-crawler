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


router.get('/', async (ctx, next) => {
    ctx.body = fs.readFileSync('./result.html', 'utf-8');
})

router.get('/config_mp', async (ctx, next) => {
    ctx.body = fs.readFileSync('./config.html', 'utf-8');
})


app.use(router.routes());	//	TBD

server.listen(9000);
require("openurl").open("http://localhost:9000");


/////////////////////////////////////////////////////////////////////////
//  读取配置
let config_mp = JSON.parse(fs.readFileSync('config_mp.json'));
config_mp.url = "";     //  微信客户端浏览器正在抓取的 公众号的 url
config_mp.index = -1;   //  正在抓取的 公众号 对应的配置文件的索引

//  获取下一个要抓取的公众号的 biz
function nextCrawlerTask(url) {
    if (!url) {
        return;
    }

    if (url.indexOf('/config_mp') !== -1) {
        return { index: 0, url: urlByBiz(config_mp.mp[0].biz), biz: config_mp.mp[0].biz, oldBiz: '' };
    } else {
        let bFound = false;
        let i = 0;
        for (i = 0; i < config_mp.mp.length; ++i) {
            let v = config_mp.mp[i];
            if (url.indexOf(v.biz) !== -1) {
                bFound = true;
                ++i;
                break;
            }
        }
        if (bFound) {
            if (i < config_mp.mp.length) {
                return {
                    index: i,
                    url: urlByBiz(config_mp.mp[i].biz),
                    biz: config_mp.mp[i].biz, 
                    oldBiz: config_mp.mp[i-1].biz
                };
            } else {
                return { index: -1, url: 'http://' + ip + '/config_mp', biz: '' };
            }
        }
    }

    return;
}
//  公众号的 biz -> url
function urlByBiz(biz) {
    if (!biz) {
        return;
    } else {
        return 'https://mp.weixin.qq.com/mp/profile_ext?action=getmsg&__biz=' + biz + '&f=json&offset=0&count=20&is_ok=1&scene=126';
    }
}

//  解析文章列表，多图文 转 单图文列表
function parse_mp_articles_list(msgList, newAdd) {
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

    newAdd.forEach(v => {
        delete v.multi_app_msg_item_list;

        //  harry, &amp; -> & 
        v.content_url = v.content_url.replace(/amp;/g, '').replace(/\\\//g, '/').replace('#wechat_redirect', '');
        v.source_url = v.source_url.replace(/amp;/g, '').replace(/\\\//g, '/');
        v.cover = v.cover.replace(/amp;/g, '').replace(/\\\//g, '/');
    })
}

/////////////////////////////////////////////////////////////////////////


let wechatIo = io.of('/wechat'), resultIo = io.of('/result');
wechatIo.on('connection', function (socket) {

    socket.on('crawler_msg', (crawData) => {

        //  20190826
        hlog.logger.debug("wechatIo.sockct_on_crawler_msg, crawData: " + JSON.stringify(crawData));

        crawData.crawTime = moment().format('YYYY-MM-DD HH:mm:ss');

        //let t = nextCrawlerTask(crawData.url);
        //if (t) {
        //    hlog.logger.debug("wechatIo.sockct_on_crawler_msg2, crawData: " + JSON.stringify(t));

        //    //  TBD, crawData.url 还是有问题的，应该用 preRequest 的 url
        //    // config_mp.url = crawData.url.replace(crawData.biz, t.biz); // t.url;
            
        //    //config_mp.index = t.index;
        //    //config_mp.biz = t.biz;
        //    //config_mp.oldBiz = t.oldBiz;
        //    //config_mp.url = config_mp.url.replace(config_mp.oldBiz, config_mp.biz);
        //    //hlog.logger.debug("wechatIo.sockct_on_crawler_msg3, url: " + config_mp.url);
        //    //socket.emit('client_jump_url', { url: t.url, index: t.index, biz: t.biz });
        //}
    });
});


function injectJquery(body) {
    return body.replace(/<\/head>/g, '<script src="https://cdn.bootcss.com/jquery/3.2.1/jquery.min.js"></script><script src="https://cdn.bootcss.com/socket.io/2.0.4/socket.io.js"></script></head>')
}

hlog.logger.debug('ip: ' + ip); //  harry
var injectJsFile = fs.readFileSync('./profileInjectJs.js', 'utf-8').replace('{$IP}', ip);

//  20190826
// var hnexturl = 'setTimeout(function () { window.location.href = "https://mp.weixin.qq.com/mp/profile_ext?action=getmsg&__biz=MjM5MDIwNDEyMg==&f=json&offset=0&count=20&is_ok=1&scene=126"; }, 2000);';
var hnexturl = 'setTimeout(function () { window.location.href = "https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=MjM5MDIwNDEyMg==&scene=124#wechat_redirect"; }, 2000);';

//var injectJs = `<script id="injectJs" type="text/javascript">${injectJsFile}</script>`;
var injectJs = `<script id="injectJs" type="text/javascript">${injectJsFile}${hnexturl}</script>`;

var fakeImg = fs.readFileSync('./fake.png');
var fakeHtml = fs.readFileSync('./fake.html').toString();
// hlog.logger.debug('fakeHtml: ' + fakeHtml); //  harry

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

        var newOption = Object.assign({}, requestDetail.requestOptions);

        if (/qq.com/i.test(requestDetail.url) &&
            requestDetail.requestOptions.method === 'GET') {

            //  打印微信相关请求的信息
            hlog.loggerBeforeReq.debug('url:' + requestDetail.url + ';headers: ' + JSON.stringify(newOption.headers));
        }

        //if (requestDetail.url.indexOf('mp.weixin.qq.com/mp/profile_ext?') !== -1 &&
        //    requestDetail.requestOptions.method === 'GET') {

        //    if (config_mp.url === "") {
        //        config_mp.url = requestDetail.url;
        //    } else {
        //        requestDetail.url = config_mp.url.replace(config_mp.oldBiz, config_mp.biz);
        //    }

        //    //if (requestDetail.requestOptions.headers['Referer'] &&
        //    //    requestDetail.requestOptions.headers['Referer'].indexOf('/config_mp') !== -1) {

        //        //  修改请求参数
                
        //        newOption.headers['Referer'] = requestDetail.url;

        //        hlog.loggerBeforeReq.debug('headers2: ' + JSON.stringify(newOption.headers));

        //        return {
        //            url: requestDetail.url,
        //            requestOptions: newOption
        //        };
        //    //}
        //}
    },

    *beforeSendResponse(requestDetail, responseDetail) {

        // 配置页面，起始页
        //if (requestDetail.url.indexOf('/config_mp') !== -1 &&
        //    requestDetail.requestOptions.method === 'GET') {

        //    let h = JSON.stringify(requestDetail.requestOptions.headers);
        //    hlog.loggerBeforeRes.debug('config_mp_headers: ' + h);

        //    if (requestDetail.requestOptions.headers &&
        //        requestDetail.requestOptions.headers['User-Agent'].indexOf('MicroMessenger/') !== -1) {
        //        //  来自微信手机客户端，开始抓取公众号。

        //        const newResponse = responseDetail.response;
        //        let body = responseDetail.response.body.toString();

        //        //  注入 js
        //        newResponse.body = injectJquery(body).replace(/<\/body>/g, injectJs + '</body>');

        //        return { response: newResponse };
        //    }
        //}

        if (responseDetail.response.statusCode == 302) {
            //  https://mp.weixin.qq.com/s?src=11&timestamp=1567069076&ver=1819&signature=hCS3l7UTLiCImn9cr-QGg1oxVwFtZjK*pE*6wFSf*5h724pR8x8uloCwzXcH07A5vwzWi0csEV6O4BgCQPj02jMAFheb2mzvtloSjpCY4b7lxayc0WmR-kVyfWLsUY2u&new=1
            //  302 后
            //  /s?__biz=MjM5MDIwNDEyMg==&mid=2650646310&idx=4&sn=31eee7e7c5225f770fe67babd72757fd&scene=0&key=6e9a44b68383d76388dd1836fb0846fc1a84a1b21aefb08a2ef71876cb98b908bb6fbf90363acb930fc1037d460194710d52702417821644eea55e463d6f1821b9f369a5a48ec0d31502ab358b51f9cf&ascene=1&uin=MTU3MzQyMzQyMg%3D%3D&devicetype=Windows+7&version=62060833&lang=zh_CN&pass_ticket=RQrkrncZomnEUfJ5NWkmMC8Y0O%2Blxy49j0xUDlhNWgsmHyM9i4ylyEPWoRuKpwCl&winzoom=1
            //  https://mp.weixin.qq.com/s/3vosXcJ-vOQRh9sDvQXAdg
            //  打印微信相关请求的信息
            hlog.loggerBeforeRes.debug('302-res,url:' + requestDetail.url + ';header: ' + JSON.stringify(responseDetail.response.header));
        }

        // 历史文章列表
        if (requestDetail.url.indexOf('mp.weixin.qq.com/mp/profile_ext?') !== -1 &&
            requestDetail.requestOptions.method === 'GET') {

            // console.log('get  profile_ext', responseDetail.response.header['Content-Type']);    //  text/html or application/json; charset=UTF-8

            let contentType = responseDetail.response.header['Content-Type'] || '';
            contentType = 'contentType: ' + contentType;
            hlog.loggerBeforeRes.debug('history_list ' + contentType + ';' + requestDetail.url + ';');

            const newResponse = responseDetail.response;
            let body = responseDetail.response.body.toString();

            //  20190826
            hlog.loggerBeforeRes.debug('history_list begin responseDetail.response.body');
            hlog.loggerBeforeRes.debug(body);
            hlog.loggerBeforeRes.debug('history_list end responseDetail.response.body');

            // if (responseDetail.response.header['Content-Type'].indexOf('application/json') !== -1) {

                // let md5 = crypto.createHash('md5').update(body).digest("hex");
                //  md5 更新 config_mp TBD
                //  console.log(md5);

                hlog.loggerBeforeRes.debug('history_list_json');

                //let regList = /general_msg_list":"(.*)","next_offset/;

                //let r = regList.exec(body);
                //  maybe error, because body doesn't match regList
                //if (r && r.length > 0) {
                    //let list = r[1];

                    //let reg = /\\"/g;

                    //let msgList = JSON.parse(list.replace(reg, '"'));

                    //let newAdd = [];
                    //parse_mp_articles_list(msgList, newAdd);

                    //hlog.loggerBeforeRes.debug('history_list_json,fakeHtml:' + fakeHtml);
                //}

                //  注入 js
                newResponse.body = injectJquery(fakeHtml).replace(/<\/body>/g, injectJs + '</body>');

                hlog.loggerBeforeRes.debug('newResponse.body:' + newResponse.body);

                newResponse.header['Content-Type'] = 'text/html; charset=UTF-8';

                //  resultIo.emit('newData', newData);  //  TBD

                // hlog.loggerBeforeRes.debug('history_list get newAdd.length=' + newAdd.length);

                // hlog.loggerBeforeRes.debug('history_list get newAdd: ' + JSON.stringify(newAdd));

                return { response: newResponse };
            //}
        } 
    },

    *beforeDealHttpsRequest(requestDetail) {
        return true;
    },
};
