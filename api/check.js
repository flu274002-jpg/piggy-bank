// 易支付 - 查询订单
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (!global.orders) global.orders = {};
  const outTradeNo = new URL(req.url, 'http://localhost').searchParams.get('out_trade_no');
  const order = global.orders[outTradeNo] || { status: 'not_found', amount: 0 };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(order));
};
