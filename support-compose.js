document.querySelectorAll("[data-gmail-compose]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.open(
      link.href,
      "flowbridgeSupportCompose",
      "width=720,height=680,left=160,top=80,noopener,noreferrer"
    );
  });
});
