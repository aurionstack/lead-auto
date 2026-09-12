async function trigger() {
  const secret = "wiEmpz2Ndw6O87btw8FnYGJbHavLGcYyT2dWm/oYr4k=";
  console.log('Triggering outreach cron...');
  try {
    const r = await fetch('http://localhost:3000/api/cron/process-outreach', {
      headers: { 'authorization': `Bearer ${secret}` }
    });
    const data = await r.json();
    console.log('Result:', data);
  } catch (err) {
    console.error(err);
  }
}
trigger();
