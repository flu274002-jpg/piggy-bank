// 易支付后端服务 - 小荷包自动收款
const http = require('https');
const crypto = require('crypto');
const url = require('url');

const MERCHANT_ID = '4764';
const MERCHANT_KEY = 'HIKXdnAaoOY6kBGZtKekNTcPbYoN1rHj';
const API_URL = 'https://www.ezfpy.cn/submit.php';

// 订单存储（内存，生产环境建议用数据库）
const orders = {};

module.exports = async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname.replace(/\/+$/, '');

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const BASE = 'https://' + (process.env.VERCEL_URL || 'localhost');
  const RETURN_URL = 'https://flu274002-jpg.github.io/piggy-bank/';

  // 创建订单
  if (path === '/api/create-order' && req.method === 'POST') {
    return await handleBody(req, async (body) => {
      const { amount, accountId } = body;
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
      json(res, 200, { code: 1, pay_url: API_URL + '?' + qs, out_trade_no: outTradeNo });
    });
  }

  // 支付回调
  if (path === '/api/notify') {
    return await handleBody(req, async (params) => {
      const outTradeNo = params.out_trade_no;
      const status = params.status;
      // 简化验证 - 生产环境需要验证签名
      if (status === '1' && orders[outTradeNo]) {
        orders[outTradeNo].status = 'paid';
        orders[outTradeNo].tradeNo = params.trade_no || '';
        console.log('✅ 支付成功:', outTradeNo, orders[outTradeNo].amount + '元');
      }
      res.writeHead(200);
      res.end('success');
    });
  }

  // 查询订单
  if (path === '/api/check-order' && req.method === 'GET') {
    const order = orders[parsed.query.out_trade_no] || { status: 'not_found', amount: 0 };
    return json(res, 200, order);
  }

  // 健康检查
  if (path === '/api' || path === '/api/') {
    return json(res, 200, { status: 'ok', name: '小荷包支付服务' });
  }

  json(res, 404, { error: 'Not found' });
};

// 工具函数
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleBody(req, cb) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const parsed = req.headers['content-type'] === 'application/x-www-form-urlencoded'
          ? Object.fromEntries(new url.URLSearchParams(body))
          : JSON.parse(body || '{}');
        await cb(parsed);
      } catch (e) {
        json(req.socket._httpMessage, 400, { error: e.message });
      }
      resolve();
    });
  });
}
