// 易支付后端服务 - 小荷包自动收款
const https = require('https');
const crypto = require('crypto');
const url = require('url');

const MERCHANT_ID = '4764';
const MERCHANT_KEY = 'HIKXdnAaoOY6kBGZtKekNTcPbYoN1rHj';
const API_URL = 'https://www.ezfpy.cn/submit.php';
const orders = {};

// Vercel serverless function
module.exports = async (req, res) => {
  const path = url.parse(req.url).pathname.replace(/\/+$/, '');
  const parsed = url.parse(req.url, true);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const BASE = 'https://' + (process.env.VERCEL_URL || 'localhost');
  const RETURN_URL = 'https://flu274002-jpg.github.io/piggy-bank/';

  // Create order
  if (path === '/api/create-order' && req.method === 'POST') {
    let body = '';
    try {
      req.on('data', d => body += d);
      await new Promise(r => req.on('end', r));
      const { amount, accountId } = JSON.parse(body);
      if (!amount || amount <= 0) return json(res, 400, { error: '无效金额' });

      const outTradeNo = 'piggy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const params = {
        pid: MERCHANT_ID,
        type: 'wxpay',
        out_trade_no: outTradeNo,
        notify_url: BASE + '/api/notify',
        return_url: RETURN_URL + '?pay_success=1&out_trade_no=' + outTradeNo,
        name: '小荷包收款',
        money: parseFloat(amount).toFixed(2),
        sign_type: 'MD5'
      };
      
      const keys = Object.keys(params).sort();
      const signStr = keys.map(k => k + '=' + params[k]).join('&') + MERCHANT_KEY;
      params.sign = crypto.createHash('md5').update(signStr).digest('hex');
      
      orders[outTradeNo] = { amount: parseFloat(amount), accountId: accountId || '', status: 'pending' };
      
      const qs = keys.map(k => k + '=' + encodeURIComponent(params[k])).join('&');
      return json(res, 200, { code: 1, pay_url: API_URL + '?' + qs, out_trade_no: outTradeNo });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  // Payment callback
  if (path === '/api/notify') {
    let body = '';
    req.on('data', d => body += d);
    await new Promise(r => req.on('end', r));
    const params = Object.fromEntries(new url.URLSearchParams(body));
    if (params.status === '1' && orders[params.out_trade_no]) {
      orders[params.out_trade_no].status = 'paid';
      console.log('✅ 支付成功:', params.out_trade_no, orders[params.out_trade_no].amount + '元');
    }
    res.writeHead(200); res.end('success');
    return;
  }

  // Check order
  if (path === '/api/check-order' && req.method === 'GET') {
    const order = orders[parsed.query.out_trade_no] || { status: 'not_found', amount: 0 };
    return json(res, 200, order);
  }

  // Health check
  if (path === '/api') return json(res, 200, { status: 'ok', name: '小荷包支付服务' });

  json(res, 404, { error: 'Not found: ' + path });
};

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
