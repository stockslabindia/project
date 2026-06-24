const cron = require('node-cron');
const { supabaseAdmin } = require('../../config/supabase');

/**
 * Auth Cleanup Cron
 * 
 * Runs every 10 minutes to find and delete "orphan" auth.users.
 * An orphan is a user in Supabase Auth (auth.users) who does NOT have a corresponding 
 * entry in the public.profiles table AND was created more than 15 minutes ago.
 * 
 * This resolves the issue where a server crash or failed profile creation leaves
 * a half-created account, preventing the user from signing up again (giving "User already registered").
 */
async function cleanupOrphanedAuthUsers() {
  console.log('[Auth Cleanup] Starting orphan sweep...');
  try {
    // 1. Fetch all profiles emails
    // We fetch in batches if necessary, but 10k users is small enough to load in memory for now.
    const { data: profiles, error: profileErr } = await supabaseAdmin.from('profiles').select('email, phone');
    if (profileErr) {
      console.error('[Auth Cleanup] Failed to fetch profiles:', profileErr.message);
      return;
    }

    const profileEmails = new Set((profiles || []).map(p => p.email.toLowerCase()));
    
    // 2. Fetch all auth users
    // Admin API listUsers is paginated, we should loop to get all
    let allAuthUsers = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: page,
        perPage: 1000
      });
      
      if (error) {
        console.error('[Auth Cleanup] Failed to fetch auth users:', error.message);
        return;
      }
      
      if (data.users && data.users.length > 0) {
        allAuthUsers = allAuthUsers.concat(data.users);
        if (data.users.length < 1000) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // 3. Find and delete orphans
    const now = new Date();
    let deletedCount = 0;

    for (const user of allAuthUsers) {
      if (!user.email) continue; // Skip users without email if any

      const isOrphan = !profileEmails.has(user.email.toLowerCase());
      
      if (isOrphan) {
        const createdAt = new Date(user.created_at);
        const ageMinutes = (now - createdAt) / (1000 * 60);

        // Only delete if older than 15 minutes to allow in-progress signups to complete
        if (ageMinutes > 15) {
          console.log(`[Auth Cleanup] Deleting orphaned auth user: ${user.email} (Age: ${Math.round(ageMinutes)} mins)`);
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (delErr) {
            console.error(`[Auth Cleanup] Failed to delete ${user.email}:`, delErr.message);
          } else {
            deletedCount++;
          }
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`[Auth Cleanup] Sweep complete. Deleted ${deletedCount} orphaned accounts.`);
    } else {
      console.log(`[Auth Cleanup] Sweep complete. No orphans found.`);
    }

  } catch (err) {
    console.error('[Auth Cleanup] Error during sweep:', err.message);
  }
}

// Run every 10 minutes
cron.schedule('*/10 * * * *', cleanupOrphanedAuthUsers);

module.exports = { cleanupOrphanedAuthUsers };
