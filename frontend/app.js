import {
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging.js";
import { createMessaging } from "./firebase.js";
import { vapidKey } from "./firebase-config.js";

const enable = document.querySelector("#enable");
const copy = document.querySelector("#copy");
const tokenBox = document.querySelector("#token");
const status = document.querySelector("#status");
const messages = document.querySelector("#messages");
let messaging;
let listening = false;

enable.addEventListener("click", async () => {
  enable.disabled = true;
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      throw new Error(
        "Notifications or service workers are not supported in this browser.",
      );
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error(
        "Notification permission was not granted. Check your browser settings.",
      );
    status.textContent = "Connecting to Firebase…";
    messaging ??= await createMessaging();
    const registration = await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js",
    );
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token)
      throw new Error("Firebase did not return a token. Please try again.");
    tokenBox.value = token;
    copy.disabled = false;
    status.textContent =
      "Token generated. You can now send it to the backend.";
    if (!listening) {
      onMessage(messaging, (payload) => {
        messages.querySelector(".empty")?.remove();
        const item = document.createElement("div");
        item.className = "message";
        const title = document.createElement("strong");
        title.textContent =
          payload.notification?.title ||
          payload.data?.title ||
          "New notification";
        const body = document.createElement("p");
        body.textContent =
          payload.notification?.body ||
          payload.data?.body ||
          "You have a new message.";
        item.append(title, body);
        messages.prepend(item);
        if (Notification.permission === "granted") {
          registration.showNotification(title.textContent, {
            body: body.textContent,
          }).catch((error) => {
            console.error("Unable to display notification:", error);
          });
        }
      });
      listening = true;
    }
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Unable to generate a token.";
  } finally {
    enable.disabled = false;
  }
});

copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(tokenBox.value);
    status.textContent = "Token copied.";
  } catch {
    tokenBox.select();
    status.textContent = "Select and copy the token manually.";
  }
});

document
  .querySelector("#send-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const send = document.querySelector("#send");
    const sendStatus = document.querySelector("#send-status");
    if (!tokenBox.value) {
      sendStatus.textContent = "Generate an FCM token first.";
      return;
    }
    send.disabled = true;
    sendStatus.textContent = "Sending...";
    try {
      const baseUrl = document
        .querySelector("#api-url")
        .value.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenBox.value }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.msg || "The backend could not receive the token.",
        );
      sendStatus.textContent =
        "Token sent. Check the backend terminal.";
    } catch (error) {
      sendStatus.textContent =
        error instanceof Error
          ? error.message
          : "Unable to send the token.";
    } finally {
      send.disabled = false;
    }
  });
