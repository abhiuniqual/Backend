const knex = require("./knexfile");

knex("admissions")
  .where({ patient_id: 20 })
  .del()
  .then((rowCount) => {
    console.log("Deleted", rowCount, "admission records");
  })
  .catch((err) => {
    console.error("Error deleting admission records:", err);
  });

// knex.schema
//   .dropTableIfExists("appointments")
//   .then(() => {
//     console.log("Table 'appointments' deleted successfully!");
//   })
//   .catch((err) => {
//     console.error("Error deleting 'appointments' table:", err);
//   });
