import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db  = getFirestore(app);

export default async function handler(req, res) {
  console.log('Callback received:', req.body);
  console.log('SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT ? 'present' : 'MISSING');
  const { billExternalReferenceNo, status_id } = req.body;
  console.log('status_id:', status_id, 'reservationId:', billExternalReferenceNo);

  if ((status_id === "1" || status_id === 1) && billExternalReferenceNo) {
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