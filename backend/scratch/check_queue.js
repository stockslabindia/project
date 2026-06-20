require('dotenv').config({ path: '.env' });
const { Queue } = require('bullmq');
const { redisOpts } = require('../src/redis/client');

const queue = new Queue('email-queue', { connection: redisOpts });

async function checkQueue() {
  try {
    const [waiting, active, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getCompletedCount()
    ]);

    console.log('--- email-queue stats ---');
    console.log('Waiting jobs:', waiting);
    console.log('Active jobs:', active);
    console.log('Failed jobs:', failed);
    console.log('Completed jobs:', completed);

    const jobs = await queue.getJobs(['waiting', 'active', 'failed']);
    console.log('\nDetails of non-completed jobs:');
    jobs.forEach(job => {
      console.log(`Job ID: ${job.id} | Name: ${job.name} | Data:`, job.data);
      if (job.failedReason) {
        console.error(`  Failed Reason: ${job.failedReason}`);
      }
    });

  } catch (err) {
    console.error('Error checking queue:', err.message);
  } finally {
    await queue.close();
  }
}

checkQueue();
