// 支付宝当面付 - 创建支付二维码
const https = require('https');
const crypto = require('crypto');

const APP_ID = '2021006159689567';
const ALIPAY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAktVuAXH9fLpVfFTLvgphMp/9vJoQEtQWOCE5MWX7P2J+6SZCpcNTA4Hg1eJPZCt+iOemr2JJDg3JKaWLP0/GlX+4VJA4ncWSM90MJ6TnwHh0nu/NkbUXaFHc4m05KcjB3UR7N2b8JGEG/LB+l7i3F+r0Iwufg73lg73K9X1wKPWMiGhDdf8JGXuzqw3qO9RFAlYjK8iXyG/ujoMoK+BUBVrAUjPvptMkAm1FO4geBnjX4yfrqnVbm5dqT1LRbdHhtkHtkYD2KMVo0ONqkEyi42tYXYgxBOH8Svld491KYPWvnUA6GjQB7vsGE/L4Mwp63Yh5y7FrBGTibmMeILl8QIDAQAB
-----END PUBLIC KEY-----`;

const APP_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCS1W4Bcf18ulV8VMu+CmEyn/28mhAS1BY4ITkxZfs/Yn7pJkKlw1MDgeDV4k9kK36I56avYkkODckppYs/T8aVf7hUkDidxZIz3QwnpOfAeHSe782RtRdoUdzibTkpyMHdRHs2fZvwkYQb8sH6XuLcX6vQjC5+DveWDvcr1fXAo9YyIaEN1/wkZe7OrDeo71EUCViMryJfIb+6Ogygr4FQFWsBSM++m0yQCbUU7iB4GeNfjJ+uqdVubl2pPUtFt0eG2Qe2RgPYoxWjQ42qQTKLja1hdiDEE4fxK+V3j3Upg9a+dQDoaNAHu+wYT8vgzCnrdiHnLsWsEZOJuYx4guXxAgMBAAECggEALUaCVQ/BCeSq11uON1sb/XA33R/kNOoQr94OtJytjC3i1CFoC5Te1AYIPes6b7i5m51SWGIGBL9bd+wDs9H1ecOYIvsVehChtDxEszS2ATMjQp7O1E7ymMglQ+xJ5AhzPrcPBw5UNymngran+XuomCsn33ZaH6Sd0zdqH6opzOw8DfSFRdwBX2VGk7wLalnisOYq6QPcg4BZ70yXaKf1weXU0Zd10TIfX4PVvKjk8Y5JJYL/tQp28rIsi3CWZm/67+wFMtxQ8mkFkNYUhOrFy6L6z1TwoEi3Paltqiu/85hw1Nsr6OQ6MYv/skzlBZAqbJ4dhG+nxpNyVH6NgHoBwQKBgQD9ckdt62r4GjppZa/PCMUTdkVnObI/ZPJq1S1u0qQvrZ330c8KlzEPQ8wMe6mI9MbLc7o47JlavOT9HzQjgTuqEZpcH50Y4OUOJzowdOItSavj9tXkGV8ocgcMqImxoE3mFxGKaCg/wpXNHvvTwDLMijE72jApy/spJxuw1w28RwKBgQCUUClpUw5EWfJJTJNszRhw9qKNNGWbvTbdG7GF0hsmIjfsGToH7sNqrhm3L67IOrhNygVp5jemTumqWW0PJxzwxAD8rfNB8FGwz2XtLuTdPu7hTgytgAVawQKmsrqjuLyslWZKdyEbckVR3wVvR3NCQo3xKp+YJd/HUfwVnOdABwKBgFDs8n3Yk7lQtqH8xBw5UqQaOaLyO0Yet4EBPJaMT7yhlTUSGyfoitOy9C5wNfvzHJ7N/wI6GeVtNzjTg9RqaWCuajlMJt9QwBK618utJqMLSQVrRXSl3UqOzk1uazj6VKVJbGJjS6bAPRDX+dTtI8tHvNy9mG9gIHxNbnwSzuH1AoGALUI1EOX+gY8tJ38NsfL4VWh9/DcUFq1r85dC2gJetIlWpV6hXdBXo9NTF5qebI22tk5CzqkpLEACgDBf3nLiGvrFDlaK2AFc/GadxP49auKMhQaLSdq6R5KEm5gI6nMyaDwDBhBKcxSw4KX9A5M7MeobZI/MOeK84hc7pODHlLsCgYBSVuS+uLO2Vj2+dzPJkRE4AojOHi7qlof3Ju1Y4zuwigKbK5aCzlk0Nl6lfH9DXR/aiTzT1P/stTEA0Q/N+TXoQXw8FiLvQoZEg6AxO5QDv+AoustDWzEmpXSrwXC85BTeyC8frnW4XqZFnIpvU3EDE+ycDPlja76aS54wAvldlw==
-----END RSA PRIVATE KEY-----`;

const BASE = 'https://piggy-bank-plum.vercel.app';
const GATEWAY = 'https://openapi.alipay.com/gateway.do';

// RSA2 签名
function rsaSign(params, privateKey) {
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => k + '=' + params[k]).join('&');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signStr, 'utf8');
  return signer.sign(privateKey, 'base64');
}

// 支付宝 API 调用
function callAlipay(bizContent) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/\.\d{3}/, '').replace('Z', '+08:00');
    
    const publicParams = {
      app_id: APP_ID,
      method: 'alipay.trade.precreate',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: timestamp,
      version: '1.0',
      notify_url: BASE + '/api/notify',
      biz_content: JSON.stringify(bizContent)
    };

    publicParams.sign = rsaSign(publicParams, APP_PRIVATE_KEY);

    // 构建请求 body
    const body = Object.keys(publicParams).sort().map(k => k + '=' + encodeURIComponent(publicParams[k])).join('&');

    const opts = {
      hostname: 'openapi.alipay.com',
      path: '/gateway.do',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const resp = result['alipay_trade_precreate_response'];
          if (resp && resp.code === '10000') {
            resolve({ success: true, qr_code: resp.qr_code, out_trade_no: resp.out_trade_no });
          } else {
            resolve({ success: false, error: (resp && resp.sub_msg) || '支付宝接口调用失败', raw: data });
          }
        } catch (e) {
          resolve({ success: false, error: '解析返回数据失败', raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
    
    // 金额转分为单位
    const totalAmount = parseFloat(amount).toFixed(2);

    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject: '小荷包充值',
      qr_code_timeout_express: '120m'
    };

    const result = await callAlipay(bizContent);

    if (result.success) {
      // 存储订单
      if (!global.orders) global.orders = {};
      global.orders[outTradeNo] = { amount: parseFloat(amount), accountId: accountId || '', status: 'pending' };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 1,
        pay_url: result.qr_code,
        out_trade_no: outTradeNo
      }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, error: result.error }));
    }
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
  }
};
