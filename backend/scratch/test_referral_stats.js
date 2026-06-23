require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

async function run() {
  const userId = '2bc8d6c0-c090-41d9-b14c-a28d1dd9374d';

  try {
    const [
      { data: profile, error: pe },
      { data: config, error: ce },
      { data: tiers, error: te },
      { data: bonusEvent, error: bee },
      { data: referrals, error: re },
      { data: commissions, error: coe },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('referral_code, referred_by').eq('id', userId).single(),
      supabaseAdmin.from('referral_reward_config').select('*').eq('id', 1).single(),
      supabaseAdmin.from('referral_tiers').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('referral_bonus_events').select('*').eq('referee_id', userId).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, status, created_at').eq('referred_by', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('referral_commissions').select('amount_earned, status').eq('referrer_id', userId),
    ]);

    console.log('Errors:', { pe, ce, te, bee, re, coe });
    console.log('Config:', config);
    console.log('referral_program_active:', config?.referral_program_active !== false);

  } catch (err) {
    console.error(err);
  }
}

run();
