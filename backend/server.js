import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

// Temporary in-memory DB (replace with Postgres/Mongo)
let users = [];

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    user_id: users.length + 1,
    username,
    password: hashedPassword,
    role: "user",
    created_at: new Date(),
  };
  users.push(user);
  res.json({ message: "User registered", user });
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ user_id: user.user_id, role: user.role }, "SECRET_KEY");
  res.json({ message: "Login successful", token });
});

app.listen(5000, () => console.log("Server running on port 5000"));
