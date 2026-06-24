require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

async function check() {
  console.log('Fetching latest 5 chat sessions...');
  const { data: sessions, error: sErr } = await supabaseAdmin
    .from('chat_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  if (sErr) {
    console.error('Error fetching sessions:', sErr);
    return;
  }

  if (sessions.length === 0) {
    console.log('No chat sessions found.');
    return;
  }

  for (const s of sessions) {
    console.log(`\nSession ID: ${s.id}`);
    console.log(`Customer ID: ${s.customer_id}`);
    console.log(`Status: ${s.status}`);
    console.log(`Topic: ${s.topic}`);
    console.log(`Started At: ${s.started_at}`);

    console.log('Messages:');
    const { data: messages, error: mErr } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('session_id', s.id)
      .order('created_at', { ascending: true });

    if (mErr) {
      console.error('Error fetching messages:', mErr);
      continue;
    }

    if (messages.length === 0) {
      console.log('  No messages in this session.');
    } else {
      messages.forEach(m => {
        console.log(`  [${m.created_at}] ${m.sender_type.toUpperCase()}: ${m.message}`);
      });
    }
  }
}

check();
