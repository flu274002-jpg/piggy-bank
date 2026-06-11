// 易支付 - 创建订单
const https = require('https');
const crypto = require('crypto');

const MERCHANT_ID = '4764';
const MERCHANT_KEY = 'HIKXdnAaoOY6kBGZtKekNTcPbYoN1rHj';
const API_URL = 'https://www.ezfpy.cn/submit.php';
const RETURN_URL = 'https://flu274002-jpg.github.io/piggy-bank/';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

  let body = '';
  req.on('data', d => body += d);
  await new Promise(r => req.on('end', r));

  try {
    const { amount, accountId } = JSON.parse(body);
    if (!amount || amount <= 0) { res.writeHead(400); res.end(JSON.stringify({ error: '无效金额' })); return; }

    const outTradeNo = 'piggy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const BASE = 'https://' + (process.env.VERCEL_URL || 'localhost');

    const params = {
      pid: MERCHANT_ID, type: 'wxpay',
      out_trade_no: outTradeNo,
      notify_url: BASE + '/api/notify',
      return_url: RETURN_URL + '?pay_success=1&out_trade_no=' + outTradeNo,
      name: '小荷包收款', money: parseFloat(amount).toFixed(2), sign_type: 'MD5'
    };

    // Generate MD5 sign
    const keys = Object.keys(params).sort();
    const signStr = keys.map(k => k + '=' + params[k]).join('&') + MERCHANT_KEY;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex');

    // Store order in global (note: resets on cold start)
    if (!global.orders) global.orders = {};
    global.orders[outTradeNo] = { amount: parseFloat(amount), accountId: accountId || '', status: 'pending' };

    const qs = keys.map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 1, pay_url: API_URL + '?' + qs, out_trade_no: outTradeNo }));
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
  }
};
