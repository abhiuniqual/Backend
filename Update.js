const knex = require("./knexfile");

knex("admissions")
  .where({ patient_id: 20 })
  .update({ diagnosis: "Headache" })
  .then((rowCount) => {
    console.log("Updated", rowCount, "admission records");
  })
  .catch((err) => {
    console.error("Error updating admission records:", err);
  });
