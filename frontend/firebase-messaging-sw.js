importScripts("https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js");

// Service workers run separately from the page and need their own Firebase app.
firebase.initializeApp({
  apiKey: "AIzaSyBQW9q10tEzAYN6v_IVIBB-ujUZo-3VpVM",
  authDomain: "socialmediaapp-3b656.firebaseapp.com",
  projectId: "socialmediaapp-3b656",
  storageBucket: "socialmediaapp-3b656.firebasestorage.app",
  messagingSenderId: "744399446915",
  appId: "1:744399446915:web:d55569352e080e2a538cb6",
});

firebase.messaging().onBackgroundMessage((payload) => {
  // FCM already displays notification payloads; show data-only messages here.
  if (payload.notification) return;
  return self.registration.showNotification(payload.data?.title || "New notification", {
    body: payload.data?.body || "You have a new message.",
  });
});
