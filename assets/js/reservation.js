function showToast(msg){
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}

function downloadReceipt(btn){

  const card = btn.closest(".reservation-card");

  const data = {
    cafe: card.dataset.cafe,
    location: card.dataset.location,
    date: card.dataset.date,
    time: card.dataset.time,
    guests: card.dataset.guests,
    status: card.dataset.status
  };

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF not loaded");
    return;
  }

  const doc = new window.jspdf.jsPDF({
    unit: "mm",
    format: [80, 150] // ⭐ 关键：小票尺寸（58mm/80mm）
  });

  // =========================
  // 🧾 HEADER（店名）
  // =========================
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text("CAFEHUNT", 40, 10, { align: "center" });

  doc.setFontSize(9);
  doc.text("Reservation Receipt", 40, 16, { align: "center" });

  // =========================
  // 虚线
  // =========================
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 20, 75, 20);

  // =========================
  // 📍 内容
  // =========================
  let y = 30;

  doc.setFontSize(9);
  doc.setFont("courier", "normal");

  doc.text(`Cafe: ${data.cafe}`, 5, y); y += 7;
  doc.text(`Location: ${data.location}`, 5, y); y += 7;
  doc.text(`Date: ${data.date}`, 5, y); y += 7;
  doc.text(`Time: ${data.time}`, 5, y); y += 7;
  doc.text(`Guests: ${data.guests}`, 5, y); y += 7;

  // =========================
  // 再一条虚线
  // =========================
  doc.line(5, y, 75, y);
  y += 8;

  // =========================
  // STATUS
  // =========================
  doc.text(`Status: ${data.status}`, 5, y);
  y += 10;

  // =========================
  // FOOTER
  // =========================
const footer = "Thank you for dining with us";
doc.text(footer, 40, y + 10, { align: "center" });
  doc.text("Please come again!", 40, y + 16, {
    align: "center"
  });

  // =========================
  // SAVE
  // =========================
  doc.save(`${data.cafe}-receipt.pdf`);

  showToast("Receipt downloaded!");
}