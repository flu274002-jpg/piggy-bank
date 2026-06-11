// 易支付 - 查询订单状态
// 先查本地内存，再查易支付 API 作为兜底
const https = require('https');
const crypto = require('crypto');

const MERCHANT_KEY = 'HIKXdnAaoOY6kBGZtKekNTcPbYoN1rHj';

function queryEzfpy(orderNo) {
  return new Promise(resolve => {
    const signRaw = 'order_no=' + orderNo + '&type=1&key=' + MERCHANT_KEY;
    const sign = crypto.createHash('md5').update(signRaw).digest('hex');
    const body = 'order_no=' + orderNo + '&type=1&sign=' + sign;
    const opts = {
      hostname: 'www.ezfpy.cn',
      path: '/api/findorder',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.code === 200 && j.data && j.data.length > 0) {
            const order = j.data[0];
            resolve({ status: order.status === '1' ? 'paid' : 'pending', amount: parseFloat(order.money || 0) });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
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

  // 2. 本地没有，查易支付 API
  const ezResult = await queryEzfpy(outTradeNo);
  if (ezResult) {
    // 查到已支付，同步到本地内存
    if (!global.orders) global.orders = {};
    global.orders[outTradeNo] = { status: ezResult.status, amount: ezResult.amount };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ezResult));
    return;
  }

  // 3. 两处都找不到
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'not_found', amount: 0 }));
};
