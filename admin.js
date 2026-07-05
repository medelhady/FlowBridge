const navButtons = document.querySelectorAll(".side-nav button");
const panels = document.querySelectorAll(".panel");
const saveButton = document.querySelector("#saveChanges");
const toast = document.querySelector("#toast");

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    navButtons.forEach((item) => item.classList.remove("active"));
    panels.forEach((panel) => panel.classList.remove("active"));

    button.classList.add("active");
    document.querySelector(`#${button.dataset.panel}`).classList.add("active");
  });
});

saveButton.addEventListener("click", () => {
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
});
