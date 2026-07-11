const storyTarget = document.querySelector("#storyType");
const betaForm = document.querySelector("#betaForm");
const betaEmail = document.querySelector("#betaEmail");
const betaSubmit = document.querySelector("#betaSubmit");
const betaMessage = document.querySelector("#betaMessage");
const viewFullSite = document.querySelector("#viewFullSite");

const story = `// The story behind FlowBridge

Inspired by Pat Walls and Starter Story,
I finally decided to build my own product.

I don't write code.
I build with AI.

But constantly moving between AI chats
and the terminal was slowing me down.

So I built FlowBridge.

One bridge.
Less copy & paste.
More building.

Try the beta.
Your feedback will shape the public launch.`;

let storyIndex = 0;

function typeStory() {
  if (!storyTarget) return;
  storyTarget.textContent = story.slice(0, storyIndex);
  storyIndex += 1;

  if (storyIndex <= story.length) {
    const char = story[storyIndex - 1];
    const delay = char === "\n" ? 180 : 18;
    setTimeout(typeStory, delay);
  } else {
    setTimeout(() => {
      storyIndex = 0;
      storyTarget.textContent = "";
      typeStory();
    }, 2600);
  }
}

typeStory();

viewFullSite?.addEventListener("click", () => {
  sessionStorage.setItem("flowbridge_view_full_site", "1");
  window.location.href = "./index.html";
});

betaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = betaEmail.value.trim().toLowerCase();

  if (!email) return;

  betaSubmit.disabled = true;
  betaSubmit.textContent = "Saving...";
  betaMessage.textContent = "Adding you to the beta list...";

  if (!window.flowbridgeDb) {
    betaSubmit.disabled = false;
    betaSubmit.textContent = "Send me the beta link";
    betaMessage.textContent = "Saved locally for preview. Supabase is not connected yet.";
    localStorage.setItem("flowbridge_beta_email", email);
    return;
  }

  const { error } = await window.flowbridgeDb.from("beta_waitlist").insert({
    email,
    source: "beta_page",
  });

  betaSubmit.disabled = false;
  betaSubmit.textContent = "Send me the beta link";

  if (error) {
    betaMessage.textContent = error.code === "23505"
      ? "You are already on the beta list. We will email you the link."
      : "Could not save yet. Try again in a moment.";
    return;
  }

  betaForm.reset();
  betaMessage.textContent = "You are on the beta list. We will email the download link soon.";
});
