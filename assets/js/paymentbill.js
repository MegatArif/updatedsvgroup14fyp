import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db  = getFirestore(app);

export default async function handler(req, res) {
  const { billExternalReferenceNo, status_id } = req.body;
  // status_id 1 = successful payment

  if (status_id === "1" && billExternalReferenceNo) {
    try {
      // Find reservation by ID and mark completed
      await db.collection("reservation").doc(billExternalReferenceNo).update({
        status:        "completed",
        paymentStatus: "paid",
        paidAt:        new Date().toISOString(),
      });
    } catch (err) {
      console.error("Callback update failed:", err);
    }
  }

  res.status(200).send("OK");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { customerName, customerEmail, customerPhone, amount, reservationId, cafeName } = req.body;

  const params = new URLSearchParams({
    userSecretKey:         process.env.TOYYIBPAY_SECRET_KEY,
    categoryCode:          process.env.TOYYIBPAY_CATEGORY_CODE,
    billName:              `Reservation - ${cafeName}`,
    billDescription:       `Reservation ID: ${reservationId}`,
    billPriceSetting:      1,                        // fixed price
    billPayorInfo:         1,                        // collect payer info
    billAmount:            String(amount * 100),     // in cents e.g. RM10 = 1000
    billReturnUrl:         "https://yoursite.com/reservation.html?payment=success",
    billCallbackUrl:       "https://yoursite.com/api/payment-callback",
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
    const response = await fetch("https://toyyibpay.com/index.php/api/createBill", {
      method: "POST",
      body: params,
    });

    const data = await response.json();

    if (data[0]?.BillCode) {
      res.status(200).json({ billCode: data[0].BillCode });
    } else {
      res.status(400).json({ error: "Failed to create bill", detail: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

