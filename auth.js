const knex = require("./knexfile");
const express = require("express");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

knex.schema.hasTable("users").then((exists) => {
  if (!exists) {
    knex.schema
      .createTable("users", (table) => {
        table.increments("id").primary();
        table.string("username").notNullable().unique();
        table.string("email").notNullable().unique();
        table.string("password").notNullable();
      })
      .then(() => {
        console.log("Table 'users' created successfully!");
      })
      .catch((err) => {
        console.error(err);
      });
  } else {
    console.log("Table 'users' already exists!");
  }
});

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existingUser = await knex("users").where({ email }).first();
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await knex("users").insert({ username, email, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
