/*
 * log4js
 */
var log4js = require("log4js");
exports.log4js_config = require("./log4js.json");
log4js.configure(this.log4js_config);
exports.logger = log4js.getLogger("app");
exports.loggerBeforeReq = log4js.getLogger("beforeRequest");
exports.loggerBeforeRes = log4js.getLogger("beforeResponse");
exports.loggerBeforeDealHttpsReq = log4js.getLogger("beforeDealHttpsReq");
exports.loggerError = log4js.getLogger("onError");
exports.loggerConError = log4js.getLogger("onConnectError");
