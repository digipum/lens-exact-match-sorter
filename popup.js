const status = document.getElementById("status");
const buttons = [...document.querySelectorAll("button[data-direction]")];

async function send(action, direction) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const result = await chrome.tabs.sendMessage(tab.id, { action, direction });
    if (!result?.exact) {
      status.textContent = "Open Google's Exact matches tab first. Other search results are left unchanged.";
      buttons.forEach(button => { button.disabled = true; });
      return;
    }
    const outcome = result.count ? "Results are sorted directly on Google." : "Waiting for supported exact-match results.";
    status.textContent = `${result.count} loaded matches, ${result.known} with Google-reported sizes. ${outcome}`;
    buttons.forEach(button => {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.direction === result.direction));
    });
  } catch {
    status.textContent = "Open a Google Exact matches page and refresh it after loading or reloading this extension.";
    buttons.forEach(button => { button.disabled = true; });
  }
}

buttons.forEach(button => button.addEventListener("click", () => send("sort", button.dataset.direction)));
send("status");
