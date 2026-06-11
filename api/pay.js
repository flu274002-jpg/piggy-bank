// 易支付 - 创建订单
const https = require('https');
const crypto = require('crypto');

const MERCHANT_ID = '4764';
const MERCHANT_KEY = '71kPZP2PmrwIV2ELZS2VxwW8Ey3bzYQLz';
const API_URL = 'https://www.ezfpy.cn/submit.php';
const RETURN_URL = 'https://flu274002-jpg.github.io/piggy-bank/';

// 官方 get_sign 函数: 排除 sign/sign_type → 按键名排序 → k=v 拼接（不 URL 编码）→ 直接 + KEY → MD5
function getSign(params, key) {
  const filtered = {};
  Object.keys(params).sort().forEach(k => {
    if (k !== 'sign' && k !== 'sign_type' && params[k] !== null && params[k] !== '') {
      filtered[k] = params[k];
    }
  });
  const sorted = Object.keys(filtered).sort();
  const arg = sorted.map(k => k + '=' + filtered[k]).join('&');
  return crypto.createHash('md5').update(arg + key).digest('hex');
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

    const outTradeNo = 'piggy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const BASE = 'https://piggy-bank-plum.vercel.app';

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

    // 官方签名算法：排除 sign/sign_type，排序，k=v 直接拼接，+KEY，MD5
    const sign = getSign(params, MERCHANT_KEY);
    params.sign = sign;

    // Store order in global (note: resets on cold start)
    if (!global.orders) global.orders = {};
    global.orders[outTradeNo] = { amount: parseFloat(amount), accountId: accountId || '', status: 'pending' };

    // 构建 URL：参数值需要 URL 编码，防止 & 和 ? 破坏 URL
    const allKeys = Object.keys(params).sort();
    const qs = allKeys.map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 1, pay_url: API_URL + '?' + qs, out_trade_no: outTradeNo }));
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
  }
};
