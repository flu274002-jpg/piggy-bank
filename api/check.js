// 虎皮椒 - 查询订单状态
// 先查本地内存，再查虎皮椒 API 作为兜底
const https = require('https');
const crypto = require('crypto');

const APP_ID = '20211120058';
const APP_KEY = '4545140cb02f1b185a475627e401fa95';
const API_HOST = 'api.dpweixin.com';

// 虎皮椒签名算法：排除 hash → 排序 → k=v& 拼接 → 直接 + APPKEY → MD5
function generateHash(params, appkey) {
  const sortedKeys = Object.keys(params).sort();
  let arg = '';
  sortedKeys.forEach(k => {
    if (k === 'hash' || params[k] === null || params[k] === '') return;
    if (arg) arg += '&';
    arg += k + '=' + params[k];
  });
  return crypto.createHash('md5').update(arg + appkey).digest('hex').toLowerCase();
}

// 生成随机字符串
function nonceStr(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// 通过虎皮椒 API 查询订单
function queryXunhu(orderNo) {
  return new Promise(resolve => {
    const now = Math.floor(Date.now() / 1000);
    const params = {
      appid: APP_ID,
      out_trade_order: orderNo,
      time: now,
      nonce_str: nonceStr(16)
    };
    params.hash = generateHash(params, APP_KEY);

    const postData = JSON.stringify(params);
    const opts = {
      hostname: API_HOST,
      path: '/payment/query.html',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.errcode === 0 && j.data) {
            const status = j.data.status === 'OD' ? 'paid' : 'pending';
            resolve({ status: status, amount: parseFloat(j.data.total_fee || j.data.order_money || 0) });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const outTradeNo = new URL(req.url, 'http://localhost').searchParams.get('out_trade_no');
  if (!outTradeNo) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'not_found', amount: 0 }));
    return;
  }

  // 1. 先查本地内存
  if (global.orders && global.orders[outTradeNo]) {
    const o = global.orders[outTradeNo];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: o.status, amount: o.amount }));
    return;
  }

  // 2. 本地没有，查虎皮椒 API
  const xhResult = await queryXunhu(outTradeNo);
  if (xhResult) {
    // 查到已支付，同步到本地内存
    if (!global.orders) global.orders = {};
    global.orders[outTradeNo] = { status: xhResult.status, amount: xhResult.amount };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(xhResult));
    return;
  }

  // 3. 两处都找不到 - 返回 pending 让前端继续轮询
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'pending', amount: 0 }));
};
