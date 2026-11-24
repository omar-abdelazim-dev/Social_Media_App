import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getMessaging, isSupported } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging.js";
import { firebaseConfig } from "./firebase-config.js";

export async function createMessaging() {
  if (!(await isSupported())) throw new Error("Firebase Messaging is not supported in this browser.");
  return getMessaging(initializeApp(firebaseConfig));
}
