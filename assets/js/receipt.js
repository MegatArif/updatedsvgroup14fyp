async function downloadReceipt(btn) {

  const card = btn.closest(".reservation-card");

  const data = {
    cafe: card.dataset.cafe,
    location: card.dataset.location,
    date: card.dataset.date,
    time: card.dataset.time,
    guests: card.dataset.guests,
    status: card.dataset.status
  };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // ===== HEADER BACKGROUND =====
  doc.setFillColor(107, 79, 58); // coffee brown
  doc.rect(0, 0, 210, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("CafeHunt Receipt", 20, 25);

  // reset color
  doc.setTextColor(40, 40, 40);

  // ===== CARD STYLE BOX =====
  doc.setFillColor(245, 240, 235);
  doc.roundedRect(15, 55, 180, 90, 6, 6, "F");

  doc.setFontSize(12);

  doc.text(`Cafe: ${data.cafe}`, 25, 70);
  doc.text(`Location: ${data.location}`, 25, 82);
  doc.text(`Date: ${data.date}`, 25, 94);
  doc.text(`Time: ${data.time}`, 25, 106);
  doc.text(`Guests: ${data.guests}`, 25, 118);
  doc.text(`Status: ${data.status}`, 25, 130);

  // divider
  doc.setDrawColor(180, 150, 120);
  doc.line(25, 140, 185, 140);

  // ===== THANK YOU SECTION =====
  doc.setFontSize(14);
  doc.text("Thank you for booking with CafeHunt ☕", 25, 160);

  // footer small text
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("This is an auto-generated receipt", 25, 175);

  doc.save(`${data.cafe}-receipt.pdf`);

  showToast("Receipt downloaded successfully!");
}