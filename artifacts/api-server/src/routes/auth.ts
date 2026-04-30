import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "fallback-secret-key";

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

  if (!name || !email || !password) {
    res.status(400).json({ error: "validation_error", message: "Name, email, and password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "conflict", message: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash }).returning();

  const token = jwt.sign({ userId: user!.id, email: user!.email }, JWT_SECRET, { expiresIn: "7d" });

  res.status(201).json({
    token,
    user: { id: user!.id, name: user!.name, email: user!.email },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "validation_error", message: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
    return;
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

export default router;
