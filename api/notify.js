// 易支付 - 支付回调通知
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
  
  let body = '';
  req.on('data', d => body += d);
  await new Promise(r => req.on('end', r));

  const params = Object.fromEntries(new URLSearchParams(body));
  
  if (!global.orders) global.orders = {};
  
  if (params.status === '1' && global.orders[params.out_trade_no]) {
    global.orders[params.out_trade_no].status = 'paid';
    console.log('✅ 支付成功:', params.out_trade_no, global.orders[params.out_trade_no].amount + '元');
  }

  res.writeHead(200);
  res.end('success');
};
