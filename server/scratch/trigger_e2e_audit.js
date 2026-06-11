async function trigger() {
  try {
    console.log("Triggering E2E Production Readiness Audit over HTTP...\n");
    const res = await fetch("http://localhost:5000/api/test-audit/run");
    const data = await res.json();
    console.log("-----------------------------------------------------------------");
    console.log("E2E Audit Execution Complete. HTTP Status:", res.status);
    console.log("Success:", data.success);
    console.log("Readiness Score:", data.readinessScore);
    console.log("Readiness Status:", data.readinessStatus);
    console.log("-----------------------------------------------------------------\n");
    
    if (data.auditLogs) {
      console.log("Audit Execution Step Logs:");
      data.auditLogs.forEach((log) => {
        console.log(`[Flow ${log.flow}] [${log.timestamp}] - ${log.message}`);
        if (log.data) console.log("   Details:", JSON.stringify(log.data));
      });
    }

    if (!data.success) {
      console.error("\n❌ Audit returned failure:", data.message);
      process.exit(1);
    }
    
    process.exit(0);
  } catch (e) {
    console.error("\n❌ HTTP trigger failed:", e.message);
    process.exit(1);
  }
}
trigger();
