const express = require("express");
const knex = require("./knexfile");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Read route (Get data from server)
app.get("/api/admissions", async (req, res) => {
  try {
    const admissions = await knex("admissions").select("*");
    res.json(admissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create route (Send data to server)
app.post("/api/admissions", async (req, res) => {
  const {
    patient_id,
    admission_date,
    discharge_date,
    diagnosis,
    attending_doctor_id,
  } = req.body;
  try {
    const newAdmissionId = await knex("admissions").insert({
      patient_id,
      admission_date,
      discharge_date,
      diagnosis,
      attending_doctor_id,
    });
    res.json({
      id: newAdmissionId[0],
      message: "Admission created successfully",
    });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Duplicate entry for admission" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update route (Update the existing table data)=
app.put("/api/admissions/:id", async (req, res) => {
  const { id } = req.params;
  const {
    patient_id,
    admission_date,
    discharge_date,
    diagnosis,
    attending_doctor_id,
  } = req.body;
  try {
    await knex("admissions").where({ patient_id: id }).update({
      patient_id,
      admission_date,
      discharge_date,
      diagnosis,
      attending_doctor_id,
    });
    res.json({ message: "Admission updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete route (Delete the existing table data)
app.delete("/api/admissions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await knex("admissions").where({ patient_id: id }).del();
    res.json({ message: "Admissions deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
