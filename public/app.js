import { startApp } from "/src/app/app.js";

function maybeEnableSignalTheme() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme");
  if (theme !== "signal") return;

  document.documentElement.dataset.theme = "signal";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/public/theme_signal.css";
  document.head.appendChild(link);
}

maybeEnableSignalTheme();
startApp();
