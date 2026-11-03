const webpush = require('web-push');

// We use an in-memory map for the defense to avoid risking Supabase database changes!
const subscriptions = new Map(); // userId -> subscription object

// Since VAPID keys must match the frontend, we hardcode a generated keypair just for the defense demo.
const PUBLIC_KEY = 'BIRZFNtwbLzYXAJSV8g1nq7ikP1mNxDURmGqaYwWtUq86tHrmRI4TNQD_KqBQLf6gLStw2qtcZVUTcRMRv03CnY';
const PRIVATE_KEY = '5w7W6haq4JCIHFrIWSoTV9UEuBjk2Cv2QolJzfvwVdo';

webpush.setVapidDetails(
  'mailto:admin@aerosense.com',
  PUBLIC_KEY,
  PRIVATE_KEY
);

function saveSubscription(userId, subscription) {
  subscriptions.set(userId, subscription);
  console.log(`[PushService] Saved subscription for user ${userId}`);
}

async function notifyAllGuards(payload) {
  console.log(`[PushService] Notifying ${subscriptions.size} active sessions...`);
  
  const promises = [];
  for (const [userId, sub] of subscriptions.entries()) {
    promises.push(
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => {
        console.error(`[PushService] Failed to notify user ${userId}:`, err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          subscriptions.delete(userId);
        }
      })
    );
  }
  await Promise.all(promises);
}

module.exports = {
  getSubscriptionsCount: () => subscriptions.size, saveSubscription, notifyAllGuards, getPublicKey: () => PUBLIC_KEY };

