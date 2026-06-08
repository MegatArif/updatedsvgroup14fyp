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