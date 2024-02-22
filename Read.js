const knex = require("./knexfile");

knex("admissions")
  .select("*")
  .then((records) => {
    console.log("Retrieved admission records:", records);
    const firstRecord = records[0];
    const patientId = firstRecord.patient_id;
    console.log("Patient ID:", patientId);
  })
  .catch((err) => {
    console.error("Error retrieving admission records:", err);
  });
