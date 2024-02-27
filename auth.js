require("dotenv").config();
const knex = require("./knexfile");
const express = require("express");
const { specs, swaggerUi } = require("./swagger");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const fs = require("fs");
const util = require("util");
const readFile = util.promisify(fs.readFile);

app.use(express.json());
app.use("/api/documentation", swaggerUi.serve, swaggerUi.setup(specs));

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

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication related APIs
 *   - name: User
 *     description: User related APIs
 */

// Register API
/**
 * @swagger
 * /api/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new user
 *     description: Register a new user with username, email, and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: All fields are required
 *       409:
 *         description: User with this email already exists
 *       500:
 *         description: Internal server error
 */
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
/**
 * @swagger
 * /api/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     description: Login with email and password to get access token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid email or password
 *       500:
 *         description: Internal server error
 */
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

// GET users details
/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [User]
 *     summary: Get all users
 *     description: Retrieve details of all users.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns all users
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
app.get("/api/users", async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const users = await knex("users").select("*");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
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

/**
 * @swagger
 * /api/forget-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request to reset password
 *     description: Send an email with a one-time password (OTP) for password reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Email is required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
app.post("/api/forget-password", async (req, res) => {
  const { token, email } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await knex("users").where({ email }).first();
    if (!user || user.id !== decoded.userId) {
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
/**
 * @swagger
 * /api/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP for password reset
 *     description: Verify the OTP sent via email for password reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Email and OTP are required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
app.post("/api/verify-otp", async (req, res) => {
  const { token, email, otp } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await knex("users").where({ email }).first();
    if (!user || user.id !== decoded.userId) {
      return res.status(404).json({ error: "User not found" });
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// reset-password
/**
 * @swagger
 * /api/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset user password
 *     description: Reset user password after verifying OTP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               email:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Email and new password are required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
app.post("/api/reset-password", async (req, res) => {
  const { token, email, newPassword } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!email || !newPassword) {
    return res
      .status(400)
      .json({ error: "Email and new password are required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await knex("users").where({ email }).first();
    if (!user || user.id !== decoded.userId) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = otpData[email];

    if (!userData || Date.now() > userData.otpExpiration) {
      return res
        .status(400)
        .json({ error: "OTP expired, please request a new one" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await knex("users").where({ email }).update({ password: hashedPassword });

    delete otpData[email];

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user details API
/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [User]
 *     summary: Update user details
 *     description: Update username, email, or password for a user.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User details updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: "Forbidden: You can only update your own details"
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
app.put("/api/users/:id", async (req, res) => {
  const { token } = req.body;
  const { id } = req.params;
  const { username, email, password } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.userId !== parseInt(id)) {
      return res
        .status(403)
        .json({ error: "Forbidden: You can only update your own details" });
    }

    const user = await knex("users").where({ id }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = {};
    if (username) {
      updatedUser.username = username;
    }
    if (email) {
      updatedUser.email = email;
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedUser.password = hashedPassword;
    }

    await knex("users").where({ id }).update(updatedUser);

    res.status(200).json({ message: "User details updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout API
/**
 * @swagger
 * /api/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 *     description: Logout user and invalidate access token.
 *     responses:
 *       200:
 *         description: Logout successful
 */
app.post("/api/logout", (req, res) => {
  res.status(200).json({ message: "Logout successful" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
