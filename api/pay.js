// 虎皮椒支付 - 创建订单
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const APP_ID = '20211120058';
const APP_KEY = '4545140cb02f1b185a475627e401fa95';
const API_URL = 'https://api.dfpweixin.com/payment/do.html';
const BASE = 'https://piggy-bank-plum.vercel.app';
const RETURN_URL = 'https://flu274002-jpg.github.io/piggy-bank/';

// 官方签名算法：排除 hash → 排序 → k=v & 拼接 → 直接 + APPKEY → MD5
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

    const tradeOrderId = 'piggy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const now = Math.floor(Date.now() / 1000);

    const params = {
      version: '1.1',
      appid: APP_ID,
      trade_order_id: tradeOrderId,
      total_fee: parseFloat(amount).toFixed(2),
      title: '小荷包充值',
      time: now,
      notify_url: BASE + '/api/notify',
      return_url: RETURN_URL,
      nonce_str: nonceStr(16)
    };

    // 生成签名
    params.hash = generateHash(params, APP_KEY);

    // 调用虎皮椒 API（POST JSON）
    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(params);
      const opts = {
        hostname: 'api.dfpweixin.com',
        path: '/payment/do.html',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      const req = https.request(opts, resp => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve({ errcode: -1, errmsg: '解析失败: ' + data }); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (result.errcode === 0) {
      // 存储订单
      if (!global.orders) global.orders = {};
      global.orders[tradeOrderId] = { amount: parseFloat(amount), accountId: accountId || '', status: 'pending' };

      // 优先使用二维码，其次使用支付链接
      const payUrl = result.url_qrcode || result.url || '';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 1, pay_url: payUrl, out_trade_no: tradeOrderId }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, error: result.errmsg || '创建订单失败' }));
    }
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
  }
};
