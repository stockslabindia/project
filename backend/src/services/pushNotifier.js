const webpush = require('web-push');
const { supabaseAdmin } = require('../config/supabase');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:support@stockslab.live';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('📶 Web Push service initialized successfully');
} else {
  console.warn('⚠️ Web Push service NOT initialized: Missing VAPID keys in environment');
}

/**
 * Send a web push notification to a specific user's registered PWA subscriptions
 * @param {string} userId - The Supabase auth user ID
 * @param {object} payload - The notification payload { title, body, url }
 */
async function sendPushNotification(userId, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return;
  }

  try {
    // 1. Fetch subscriptions for user
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error(`Error fetching push subscriptions for user ${userId}:`, error.message);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return; // No active subscriptions for this user
    }

    const payloadString = JSON.stringify(payload);

    // 2. Broadcast in parallel
    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadString);
      } catch (err) {
        // Handle subscription expiration / invalid endpoints
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`🗑️ Removing expired push subscription for user ${userId}: ${sub.endpoint}`);
          try {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          } catch (deleteErr) {
            console.warn('Failed to delete invalid subscription:', deleteErr.message);
          }
        } else {
          console.error(`Failed to send push notification to subscription ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.all(sendPromises);

  } catch (err) {
    console.error(`Push notification broadcast error for user ${userId}:`, err.message);
  }
}

module.exports = {
  sendPushNotification
};
