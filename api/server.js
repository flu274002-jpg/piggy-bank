// 易支付后端服务 - 小荷包自动收款
const http = require('https');
const crypto = require('crypto');
const url = require('url');

const MERCHANT_ID = '4764';
const MERCHANT_KEY = 'HIKXdnAaoOY6kBGZtKekNTcPbYoN1rHj';
const API_URL = 'https://www.ezfpy.cn/submit.php';
const BASE = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000';

// 存储订单状态（生产环境应使用数据库）
const orders = {};

module.exports = async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ===== 创建订单 =====
  if (path === '/api/create-order' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { amount, accountId, note } = JSON.parse(body);
        if (!amount || amount <= 0) { res.writeHead(400); res.end(JSON.stringify({ error: '无效金额' })); return; }
        
        const outTradeNo = 'piggy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const notifyUrl = BASE + '/api/notify';
        
        // 构建参数
        const params = {
          pid: MERCHANT_ID,
          type: 'wxpay',
          out_trade_no: outTradeNo,
          notify_url: notifyUrl,
          return_url: BASE + '/api/success?out_trade_no=' + outTradeNo + '&accountId=' + (accountId || ''),
          name: '小荷包收款' + (note ? '-' + note : ''),
          money: parseFloat(amount).toFixed(2),
          sign_type: 'MD5'
        };
        
        // 生成签名
        const sortedKeys = Object.keys(params).sort();
        const signStr = sortedKeys.map(k => k + '=' + params[k]).join('&') + MERCHANT_KEY;
        params.sign = crypto.createHash('md5').update(signStr).digest('hex');
        
        // 存储订单
        orders[outTradeNo] = { amount: parseFloat(amount), accountId: accountId || '', status: 'pending', createdAt: Date.now() };
        
        // 构建提交URL
        const queryString = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
        const payUrl = API_URL + '?' + queryString;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 1, pay_url: payUrl, out_trade_no: outTradeNo }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ===== 支付回调（易支付服务器通知） =====
  if (path === '/api/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new url.URLSearchParams(body);
      const outTradeNo = params.get('out_trade_no');
      const tradeNo = params.get('trade_no');
      const status = params.get('status');
      const sign = params.get('sign');
      
      // 验证签名
      const sortedKeys = Array.from(params.keys()).filter(k => k !== 'sign' && k !== 'sign_type').sort();
      const signStr = sortedKeys.map(k => k + '=' + params.get(k)).join('&') + MERCHANT_KEY;
      const calcSign = crypto.createHash('md5').update(signStr).digest('hex');
      
      if (calcSign === sign && status === '1' && orders[outTradeNo]) {
        orders[outTradeNo].status = 'paid';
        orders[outTradeNo].tradeNo = tradeNo;
        orders[outTradeNo].paidAt = new Date().toISOString();
        console.log('✅ 支付成功:', outTradeNo, '金额:', orders[outTradeNo].amount);
        res.writeHead(200);
        res.end('success');
      } else {
        console.log('❌ 回调验证失败:', outTradeNo);
        res.writeHead(200);
        res.end('fail');
      }
    });
    return;
  }

  // ===== 查询订单状态 =====
  if (path === '/api/check-order' && req.method === 'GET') {
    const outTradeNo = parsed.query.out_trade_no;
    const order = orders[outTradeNo];
    if (order) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: order.status, amount: order.amount }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ status: 'not_found' }));
    }
    return;
  }
  
  // ===== 支付成功跳转 =====
  if (path === '/api/success') {
    const outTradeNo = parsed.query.out_trade_no;
    const order = orders[outTradeNo];
    // 跳转到小荷包，带上支付结果
    res.writeHead(302, {
      'Location': 'https://flu274002-jpg.github.io/piggy-bank/?pay_success=1&out_trade_no=' + outTradeNo + '&amount=' + (order ? order.amount : '')
    });
    res.end();
    return;
  }

  // 默认
  res.writeHead(404);
  res.end('Not found');
};
