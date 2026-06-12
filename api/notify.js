// 支付回调通知（支持虎皮椒）
const crypto = require('crypto');

const APP_KEY = '4545140cb02f1b185a475627e401fa95';

// 虎皮椒签名验证
function verifyHash(params, appkey) {
  const sortedKeys = Object.keys(params).sort();
  let arg = '';
  sortedKeys.forEach(k => {
    if (k === 'hash' || params[k] === null || params[k] === '') return;
    if (arg) arg += '&';
    arg += k + '=' + params[k];
  });
  const expected = crypto.createHash('md5').update(arg + appkey).digest('hex').toLowerCase();
  return expected === params.hash;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }

  let body = '';
  req.on('data', d => body += d);
  await new Promise(r => req.on('end', r));

  const params = Object.fromEntries(new URLSearchParams(body));
  
  if (!global.orders) global.orders = {};

  // 虎皮椒回调：trade_order_id, total_fee, status, hash
  if (params.trade_order_id) {
    // 验证签名
    if (verifyHash(params, APP_KEY)) {
      if (params.status === 'OD') { // OD = 已支付
        const orderId = params.trade_order_id;
        if (global.orders[orderId]) {
          global.orders[orderId].status = 'paid';
          console.log('✅ 虎皮椒支付成功:', orderId, params.total_fee + '元');
        } else {
          // 未在本地内存找到，存入（跨实例情况）
          global.orders[orderId] = { amount: parseFloat(params.total_fee), status: 'paid' };
          console.log('✅ 虎皮椒支付完成(跨实例):', orderId, params.total_fee + '元');
        }
        res.writeHead(200);
        res.end('success');
        return;
      }
    } else {
      console.log('❌ 签名验证失败:', params.trade_order_id);
    }
  }

  // 旧版易支付回调兼容
  if (params.status === '1' && global.orders[params.out_trade_no]) {
    global.orders[params.out_trade_no].status = 'paid';
    console.log('✅ 支付成功:', params.out_trade_no, global.orders[params.out_trade_no].amount + '元');
  }

  res.writeHead(200);
  res.end('success');
};
