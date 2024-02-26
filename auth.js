require("dotenv").config();
const knex = require("./knexfile");
const express = require("express");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const fs = require("fs");
const util = require("util");
const readFile = util.promisify(fs.readFile);

app.use(express.json());

knex.schema.hasTable("users").then((exists) => {
  if (!exists) {
    knex.schema
      .createTable("users", (table) => {
        table.increments("id").primary();
        table.string("username").notNullable().unique();
        table.string("email").notNullable().unique();
        table.string("password").notNullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
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

// Register API
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

// Login API
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout API
app.post("/api/logout", (req, res) => {
  res.status(200).json({ message: "Logout successful" });
});

const sendOTPByEmail = async (email, otp) => {
  try {
    const htmlTemplate = await readFile("EmailTemplate.html", "utf8");

    let transporter = nodemailer.createTransport({
      service: process.env.SERVICE,
      auth: {
        user: process.env.USER,
        pass: process.env.PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    let info = await transporter.sendMail({
      from: process.env.USER,
      to: email,
      subject: "Verify Your Account - Your One-Time Password (OTP)",
      html: htmlTemplate.replace("{{otp}}", otp).replace("{{time_limit}}", 10),
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error occurred while sending email:", error);
    throw error;
  }
};

//forget-password
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

let otpData = {};

app.post("/api/forget-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const otp = generateOTP();
    const otpExpiration = Date.now() + 10 * 60 * 1000;
    otpData[email] = { otp, otpExpiration };

    await sendOTPByEmail(email, otp);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// verify-otp
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  const userData = otpData[email];

  if (!userData) {
    return res.status(400).json({ error: "User data not found" });
  }

  if (userData.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  const currentTime = Date.now();
  if (currentTime > userData.otpExpiration) {
    return res.status(400).json({ error: "OTP expired" });
  }

  res.status(200).json({ message: "OTP verified successfully", email });
});

// reset-password
app.post("/api/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res
      .status(400)
      .json({ error: "Email and new password are required" });
  }

  const userData = otpData[email];

  if (!userData || Date.now() > userData.otpExpiration) {
    return res
      .status(400)
      .json({ error: "OTP expired, please request a new one" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await knex("users").where({ email }).update({ password: hashedPassword });

    delete otpData[email];

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET users details
app.get("/api/users", async (req, res) => {
  try {
    const users = await knex("users").select("*");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
