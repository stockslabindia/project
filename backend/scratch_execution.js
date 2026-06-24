require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('spread_profiles').select('tier, segment, execution_delay_min_ms, execution_delay_max_ms').then(r => console.log(r.data));
supabase.from('system_settings').select('key, value').in('key', ['vdp_execution_delay_ms', 'vdp_asymmetric_delay_enabled']).then(r => console.log(r.data));
