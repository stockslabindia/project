require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const ioClient = require('socket.io-client');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BASE_URL = 'http://localhost:4000';

async function runTest() {
  console.log('🚀 Starting Customer Support Chat End-to-End Programmatic Test...');

  let testUserId = null;
  let testSessionId = null;
  let clientSocket = null;
  let agentSocket = null;

  try {
    // 1. Find or create a test trader user
    const testEmail = `support_test_user_${Date.now()}@stockslab.live`;
    const testPassword = 'TestPassword123!';
    const testName = 'John Tester';

    console.log(`\nStep 1: Creating test trader user: ${testEmail}`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (authError) throw new Error('Auth creation failed: ' + authError.message);
    testUserId = authData.user.id;
    console.log(`✅ Test User created with ID: ${testUserId}`);

    // Create the profile in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: testUserId,
        email: testEmail,
        full_name: testName,
        phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        status: 'active',
        kyc_status: 'verified',
        client_id: `CL-TEST-${Math.floor(1000 + Math.random() * 9000)}`
      });

    if (profileError) throw new Error('Profile insertion failed: ' + profileError.message);
    console.log('✅ User profile created.');

    // Ensure wallet exists for user
    await supabaseAdmin.from('wallets').upsert({
      user_id: testUserId,
      balance: 50000.00
    });

    // 2. Authenticate Trader User
    console.log('\nStep 2: Authenticating Trader User...');
    const { data: userSignIn, error: signInError } = await supabasePublic.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) throw new Error('User sign in failed: ' + signInError.message);
    const userToken = userSignIn.session.access_token;
    console.log('✅ Trader User authenticated.');

    // 3. Authenticate Admin/Agent
    console.log('\nStep 3: Authenticating Admin User (admin@stockslab.live)...');
    const adminLoginRes = await axios.post(`${BASE_URL}/api/admin/auth/login`, {
      email: 'admin@stockslab.live',
      password: 'admin123'
    });

    const adminToken = adminLoginRes.data.token;
    const adminUser = adminLoginRes.data.user;
    console.log(`✅ Admin authenticated. Name: ${adminUser.name}, Role: ${adminUser.role}`);

    // 4. Set Admin/Agent availability to ONLINE in DB
    console.log('\nStep 4: Ensuring Agent is marked ONLINE in database...');
    const { error: availError } = await supabaseAdmin
      .from('agent_availability')
      .upsert({
        agent_id: adminUser.id,
        is_online: true,
        toggled_by: adminUser.id,
        toggled_at: new Date().toISOString()
      });

    if (availError) throw new Error('Failed to toggle agent availability: ' + availError.message);
    console.log('✅ Agent availability toggled ONLINE.');

    // 5. Connect Sockets
    console.log('\nStep 5: Connecting WebSockets...');
    
    // Connect Agent socket first so it can receive the incoming chat broadcast
    agentSocket = ioClient(`${BASE_URL}/support`, {
      auth: { token: adminToken, role: 'agent' },
      transports: ['websocket']
    });

    const agentConnected = new Promise((resolve) => {
      agentSocket.on('connect', () => {
        console.log('  🔌 Agent socket connected.');
        resolve();
      });
    });

    await agentConnected;

    // Connect User socket
    clientSocket = ioClient(`${BASE_URL}/support`, {
      auth: { token: userToken, role: 'user' },
      transports: ['websocket']
    });

    const clientConnected = new Promise((resolve) => {
      clientSocket.on('connect', () => {
        console.log('  🔌 Client socket connected.');
        resolve();
      });
    });

    await clientConnected;

    // 6. Request Live Agent via REST API
    console.log('\nStep 6: User requesting a live agent via REST endpoint...');
    const requestRes = await axios.post(
      `${BASE_URL}/api/support/sessions/request`,
      {
        topic: 'Deposit > Paid amount not added',
        bot_transcript: [
          { role: 'bot', text: 'Hey John, check below options to proceed' },
          { role: 'user', text: 'Deposit' },
          { role: 'bot', text: 'Please select the type of issue:' },
          { role: 'user', text: 'Paid amount not added' }
        ]
      },
      {
        headers: { Authorization: `Bearer ${userToken}` }
      }
    );

    testSessionId = requestRes.data.session_id;
    console.log(`✅ Session created via REST. Session ID: ${testSessionId}`);

    // 7. Trigger the User requesting agent event on Sockets
    console.log('\nStep 7: Simulating user socket joining session and requesting agent...');
    
    const incomingChatReceived = new Promise((resolve) => {
      agentSocket.on('support:incoming_chat', (data) => {
        console.log(`  🔔 Agent received support:incoming_chat event:`, data);
        if (data.session_id === testSessionId) {
          resolve(data);
        }
      });
    });

    clientSocket.emit('support:join_session', { session_id: testSessionId });
    clientSocket.emit('support:request_agent', {
      session_id: testSessionId,
      user_name: testName,
      topic: 'Deposit > Paid amount not added'
    });

    const incomingChatData = await incomingChatReceived;
    console.log('✅ incoming_chat event verified.');

    // 8. Agent Accepts the Chat
    console.log('\nStep 8: Agent accepting the chat session...');
    
    const userSessionStarted = new Promise((resolve) => {
      clientSocket.on('support:session_started', (data) => {
        console.log('  💬 Client received support:session_started event:', data);
        resolve(data);
      });
    });

    const agentChatAccepted = new Promise((resolve) => {
      agentSocket.on('support:chat_accepted', (data) => {
        console.log('  💬 Agent received support:chat_accepted event:', data);
        resolve(data);
      });
    });

    agentSocket.emit('support:accept_chat', { session_id: testSessionId });

    const sessionStartData = await userSessionStarted;
    const acceptData = await agentChatAccepted;
    console.log('✅ Chat successfully accepted and room established.');

    // 9. Exchange messages & Upload media/documents
    console.log('\nStep 9: Exchanging messages between User and Agent...');
    
    // User -> Agent message
    const agentMsgReceived = new Promise((resolve) => {
      agentSocket.on('support:new_message', (msg) => {
        if (msg.sender_type === 'user') {
          console.log(`  📥 Agent received user message: "${msg.message}" (Type: ${msg.message_type})`);
          resolve(msg);
        }
      });
    });

    clientSocket.emit('support:user_message', {
      session_id: testSessionId,
      message: 'Hello, I paid 5000 INR but it is not showing in my wallet.'
    });

    await agentMsgReceived;

    // Agent -> User message
    const userMsgReceived = new Promise((resolve) => {
      clientSocket.on('support:new_message', (msg) => {
        if (msg.sender_type === 'agent') {
          console.log(`  📥 User received agent message: "${msg.message}" (Type: ${msg.message_type})`);
          resolve(msg);
        }
      });
    });

    agentSocket.emit('support:agent_message', {
      session_id: testSessionId,
      message: 'Hello John, let me check your transactions. Can you share the transaction ID?'
    });

    await userMsgReceived;
    console.log('✅ Bidirectional text messaging verified.');

    // Upload attachment (Image)
    console.log('\nStep 9b: Testing media upload via REST API...');
    const simulatedImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await axios.post(
      `${BASE_URL}/api/support/upload`,
      {
        file_base64: simulatedImageBase64,
        filename: 'test_payment.png'
      },
      {
        headers: { Authorization: `Bearer ${userToken}` }
      }
    );

    const uploadedFile = uploadRes.data;
    console.log(`✅ File uploaded successfully: ${uploadedFile.url}`);

    // Send Image via Socket
    const agentMediaReceived = new Promise((resolve) => {
      agentSocket.on('support:new_message', (msg) => {
        if (msg.sender_type === 'user' && msg.message_type === 'image') {
          console.log(`  📥 Agent received user image: "${msg.message}"`);
          resolve(msg);
        }
      });
    });

    clientSocket.emit('support:user_message', {
      session_id: testSessionId,
      message: uploadedFile.url,
      message_type: 'image'
    });

    await agentMediaReceived;
    console.log('✅ Socket image transfer verified.');

    // Agent sends document back
    const userDocReceived = new Promise((resolve) => {
      clientSocket.on('support:new_message', (msg) => {
        if (msg.sender_type === 'agent' && msg.message_type === 'document') {
          console.log(`  📥 User received agent document: "${msg.message}"`);
          resolve(msg);
        }
      });
    });

    agentSocket.emit('support:agent_message', {
      session_id: testSessionId,
      message: '/uploads/receipt_template.pdf',
      message_type: 'document'
    });

    await userDocReceived;
    console.log('✅ Socket document transfer verified.');

    // 10. Raise Trouble Ticket (TT) via REST
    console.log('\nStep 10: Agent raising Trouble Ticket via REST API...');
    const ttRes = await axios.post(
      `${BASE_URL}/api/support/admin/sessions/${testSessionId}/tt`,
      {
        category: 'deposit',
        priority: 'high',
        description: 'User paid 5000 INR, transaction ID TXN-99824. Wallet not updated.'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    const ticket = ttRes.data;
    console.log(`✅ Ticket raised successfully: ${ticket.ticket_number} (ID: ${ticket.id})`);

    // Verify DB entry for the ticket
    const { data: dbTicket } = await supabaseAdmin
      .from('trouble_tickets')
      .select('*')
      .eq('id', ticket.id)
      .single();

    if (!dbTicket) throw new Error('Ticket not found in DB!');
    console.log(`✅ Ticket verified in database. Status: ${dbTicket.status}, Priority: ${dbTicket.priority}`);

    // 11. End the Chat
    console.log('\nStep 11: Agent ending the chat session...');
    
    const userSessionEnded = new Promise((resolve) => {
      clientSocket.on('support:session_ended', (data) => {
        console.log('  ⛔ User received support:session_ended event:', data);
        resolve(data);
      });
    });

    agentSocket.emit('support:agent_end_chat', { session_id: testSessionId });
    await userSessionEnded;
    console.log('✅ Chat ended event verified.');

    // Verify session status is updated in DB
    const { data: dbSession } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', testSessionId)
      .single();

    if (dbSession.status !== 'ended') throw new Error('Session is not ended in database!');
    console.log(`✅ Chat session verified ended in DB. Duration: ${dbSession.session_duration_seconds}s`);

    console.log('\n🎉 ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('\n❌ E2E VERIFICATION FAILED:', err.message);
  } finally {
    // Cleanup
    console.log('\nStep 12: Cleaning up test data...');
    if (clientSocket) clientSocket.disconnect();
    if (agentSocket) agentSocket.disconnect();

    if (testSessionId) {
      console.log('  - Deleting test chat messages...');
      await supabaseAdmin.from('chat_messages').delete().eq('session_id', testSessionId);
      console.log('  - Deleting test trouble tickets...');
      await supabaseAdmin.from('trouble_tickets').delete().eq('session_id', testSessionId);
      console.log('  - Deleting test chat session...');
      await supabaseAdmin.from('chat_sessions').delete().eq('id', testSessionId);
    }

    if (testUserId) {
      console.log('  - Deleting test wallet...');
      await supabaseAdmin.from('wallets').delete().eq('user_id', testUserId);
      console.log('  - Deleting test profile...');
      await supabaseAdmin.from('profiles').delete().eq('id', testUserId);
      console.log('  - Deleting test auth user...');
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
    }

    console.log('✅ Cleanup finished.');
    process.exit(0);
  }
}

runTest();
