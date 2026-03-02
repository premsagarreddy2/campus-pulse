// Auto-dismiss flash messages
document.addEventListener("DOMContentLoaded", () => {
  const flashes = document.querySelectorAll(".flash");
  flashes.forEach(f => {
    setTimeout(() => {
      f.style.transition = "opacity 0.5s";
      f.style.opacity = "0";
      setTimeout(() => f.remove(), 500);
    }, 4000);
  });

  // Auto-submit filter form on select change
  const filterForm = document.getElementById("filter-form");
  if (filterForm) {
    filterForm.querySelectorAll("select").forEach(sel => {
      sel.addEventListener("change", () => filterForm.submit());
    });
  }

  // QR code generation
  const qrTarget = document.getElementById("qr-code-target");
  if (qrTarget && typeof QRCode !== "undefined") {
    const url = qrTarget.dataset.url;
    new QRCode(qrTarget, {
      text: url,
      width: 220,
      height: 220,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // Confirm delete
  document.querySelectorAll(".confirm-delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) {
        e.preventDefault();
      }
    });
  });
});
