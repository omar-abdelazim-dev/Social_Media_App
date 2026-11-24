import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import "./config.service.js";

// Initialize on first use so Firebase credentials are only needed when messaging is used.
export const getFirebaseMessaging = () => {
  const app = getApps().find((existingApp) => existingApp.name === "[DEFAULT]")
    ?? initializeApp({ credential: applicationDefault() });

  return getMessaging(app);
};
