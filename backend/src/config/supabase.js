const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY) {
  console.error('\n❌ CRITICAL ERROR: Supabase Environment Variables are missing!');
  console.error('If you are deploying to Render, you MUST add the following variables in the Render Dashboard (Environment tab):');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_ANON_KEY');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('- SUPABASE_JWT_SECRET\n');
  process.exit(1);
}

// Service role client — bypasses RLS (for admin/backend operations)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { 
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws }
  }
);

// Anon client — respects RLS (for user-facing operations)
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws }
  }
);

/**
 * Utility to fetch all active instruments with range pagination to bypass Supabase 1000-row limit.
 * @param {string} selectFields - comma-separated list of fields to select
 * @returns {Promise<Array>}
 */
async function fetchAllActiveInstruments(selectFields = '*') {
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;
  const allInstruments = [];
  
  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('instruments')
      .select(selectFields)
      .eq('is_active', true)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
    if (error) {
      throw error;
    }
    
    if (data && data.length > 0) {
      allInstruments.push(...data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allInstruments;
}

module.exports = { supabaseAdmin, supabasePublic, fetchAllActiveInstruments };
