const knex = require("./knexfile");

knex.schema
  .createTable("appointments", (table) => {
    table.increments("id").primary();
    table.integer("patient_id").unsigned();
    table.integer("doctor_id").unsigned();
    table.date("appointment_date");
    table.time("appointment_time");
    table.string("appointment_purpose");
  })
  .then(() => {
    console.log("Table 'appointments' created successfully!");
    return knex("admissions")
      .where({
        admission_date: "2024-01-07",
        attending_doctor_id: 22,
        diagnosis: "migrain",
        discharge_date: "2024-01-08",
        patient_id: 22,
      })
      .first();
  })
  .then((existingRecord) => {
    if (existingRecord) {
      console.error("Duplicate admission record found!");
      return Promise.reject("Duplicate admission record found!");
    } else {
      return knex("admissions").insert({
        admission_date: "2024-01-07",
        attending_doctor_id: 22,
        diagnosis: "migrain",
        discharge_date: "2024-01-08",
        patient_id: 22,
      });
    }
  })
  .then(() => {
    console.log("Admission record inserted successfully!");
  })
  .catch((err) => {
    console.error(err);
  });
