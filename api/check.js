// 虎皮椒 - 查询订单状态
const https = require('https');
const crypto = require('crypto');

const APP_ID = '20211120058';
const APP_KEY = '4545140cb02f1b185a475627e401fa95';
const API_HOST = 'api.dpweixin.com';

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
            // 有可能金额字段是 total_fee 或 order_money 或其他
            const amount = parseFloat(j.data.total_fee || j.data.order_money || j.data.money || 0);
            const status = j.data.status === 'OD' ? 'paid' : 'pending';
            resolve({ status, amount, raw: j });
          } else {
            resolve({ status: 'pending', amount: 0, raw: j, notFound: true });
          }
        } catch (e) {
          resolve({ status: 'pending', amount: 0, raw: null, parseError: e.message });
        }
      });
    });
    req.on('error', e => resolve({ status: 'pending', amount: 0, raw: null, networkError: e.message }));
    req.write(postData);
    req.end();
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 'pending', amount: 0, raw: null, timeout: true }); });
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

  // 1. 先查本地内存（如果有的话）
  if (global.orders && global.orders[outTradeNo]) {
    const o = global.orders[outTradeNo];
    if (o.status === 'paid') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'paid', amount: o.amount }));
      return;
    }
  }

  // 2. 查虎皮椒 API（不依赖本地内存，解决多实例问题）
  const xhResult = await queryXunhu(outTradeNo);

  if (xhResult && xhResult.status === 'paid') {
    // 查到已支付，同步到本地内存
    if (!global.orders) global.orders = {};
    global.orders[outTradeNo] = { status: 'paid', amount: xhResult.amount };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'paid', amount: xhResult.amount }));
    return;
  }

  // 3. 如果虎皮椒说订单不存在，但本地有记录（跨实例），保留 pending
  if (global.orders && global.orders[outTradeNo]) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'pending', amount: global.orders[outTradeNo].amount }));
    return;
  }

  // 4. 都查不到
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'pending', amount: 0 }));
};
