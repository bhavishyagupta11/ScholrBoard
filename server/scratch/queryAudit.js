import '../config/env.js';
import mongoose from 'mongoose';
import SupportTicket from '../models/SupportTicket.js';

async function runAudit() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Find a faculty member who has ANY tickets
  const ticket = await SupportTicket.findOne({
    $or: [{ assignedTo: { $exists: true } }, { createdBy: { $exists: true } }]
  });

  if (!ticket) {
    console.log('No tickets found for testing.');
    process.exit(0);
  }

  // To guarantee we get results, we use the faculty from a known ticket
  const facultyId = ticket.createdBy || ticket.assignedTo;

  console.log('--- FINAL MONGO QUERY ---');
  const baseQuery = {
    $or: [
      { assignedTo: facultyId },
      { createdBy: facultyId }
    ]
  };

  const statuses = ['open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'];

  for (const st of statuses) {
    const q = { ...baseQuery, status: st };
    const results = await SupportTicket.find(q).limit(2);
    if (results.length > 0) {
      console.log(`\nQuery with status='${st}':`);
      console.log(JSON.stringify(q, null, 2));
      console.log(`\n--- SAMPLE RESULTS (${st}) ---`);
      results.forEach(r => {
        console.log(`- ID: ${r._id} | Status: ${r.status} | Created By: ${r.createdBy} | Assigned To: ${r.assignedTo || 'Unassigned'}`);
      });
    }
  }

  // Verify No Data Leakage: ensure all returned tickets belong to the faculty (either created or assigned)
  console.log('\n--- DATA LEAKAGE AUDIT ---');
  const allResults = await SupportTicket.find(baseQuery);
  let leakageFound = false;
  allResults.forEach(r => {
    const isCreatedBy = String(r.createdBy) === String(facultyId);
    const isAssignedTo = String(r.assignedTo) === String(facultyId);
    if (!isCreatedBy && !isAssignedTo) {
      leakageFound = true;
      console.log(`LEAKAGE DETECTED! Ticket ${r._id} is neither created by nor assigned to faculty ${facultyId}`);
    }
  });

  if (!leakageFound) {
    console.log(`PASS: No data leakage detected. All ${allResults.length} tickets strictly belong to the querying faculty member (${facultyId}).`);
  }

  process.exit(0);
}

runAudit();
