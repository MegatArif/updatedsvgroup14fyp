export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  console.log('SECRET KEY:', process.env.TOYYIBPAY_SECRET_KEY_SANDBOX ? 'loaded' : 'MISSING');
  console.log('CATEGORY CODE:', process.env.TOYYIBPAY_CATEGORY_CODE_SANDBOX ? 'loaded' : 'MISSING');
  const { customerName, customerEmail, customerPhone, amount, reservationId, cafeName } = req.body;

  const params = new URLSearchParams({
    userSecretKey:         process.env.TOYYIBPAY_SECRET_KEY_SANDBOX,
    categoryCode:          process.env.TOYYIBPAY_CATEGORY_CODE_SANDBOX,
    billName:              `Reservation - ${cafeName}`,
    billDescription:       `Reservation ID: ${reservationId}`,
    billPriceSetting:      1,                        // fixed price
    billPayorInfo:         1,                        // collect payer info
    billAmount:            String(amount * 100),     // in cents e.g. RM10 = 1000
    billReturnUrl:         `https://svgroup14fyp.vercel.app/successfulpaymentpage.html?reservationId=${reservationId}`,
    billCallbackUrl:       `https://svgroup14fyp.vercel.app/api/payment-callback`,
    billExternalReferenceNo: reservationId,
    billTo:                customerName,
    billEmail:             customerEmail,
    billPhone:             customerPhone,
    billSplitPayment:      0,
    billSplitPaymentArgs:  "",
    billPaymentChannel:    0,                        // all channels
    billDisplayMerchant:   1,
    billContentEmail:      "Thank you for your reservation!",
    billChargeToCustomer:  1,                        // customer absorbs charges
  });

  try {
  const response = await fetch("https://dev.toyyibpay.com/index.php/api/createBill", {
    method: "POST",
    body: params,
  });

  const text = await response.text(); // ← read as text first
  console.log('ToyyibPay raw response:', text);

  const data = JSON.parse(text); // ← then parse

  if (data[0]?.BillCode) {
  res.status(200).json({ billCode: data[0].BillCode });
} else {
  res.status(400).json({ 
    error: "Failed to create bill", 
    detail: data,
    raw: text,
    // also echo back what we sent so we can verify
    sentData: {
      userSecretKey: process.env.TOYYIBPAY_SECRET_KEY_SANDBOX ? 'present' : 'MISSING',
      categoryCode:  process.env.TOYYIBPAY_CATEGORY_CODE_SANDBOX ? 'present' : 'MISSING',
      billName:      `Reservation - ${cafeName}`,
      billAmount:    String(amount * 100),
      billPhone:     customerPhone,
      billEmail:     customerEmail,
    }
  });
}
} catch (err) {
  console.error('create-bill crash:', err.message); // ← this will show in Vercel logs
  res.status(500).json({ error: err.message });
}
}