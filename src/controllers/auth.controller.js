import { supabase } from "../config/supabase.config.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

export const signUp = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into database
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([
        {
          email,
          password_hash: passwordHash,
          role: "user",
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("SignUp Insert Error:", insertError);
      return res.status(400).json({ error: insertError.message });
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role || "user",
      },
    });
  } catch (error) {
    console.error("SignUp Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (findError || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT access and refresh tokens
    const accessToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign({ id: user.id, email: user.email }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role || "user" },
    });
  } catch (error) {
    console.error("SignIn Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const refreshAuthToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(403).json({ error: "Refresh token is missing" });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Validate user still exists
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "User not found or disabled" });
    }

    const newAccessToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "15m",
    });

    const newRefreshToken = jwt.sign({ id: user.id, email: user.email }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh Token Error:", error);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

export const signOut = async (req, res) => {
  // For JWT, logout is typically handled on the client by deleting the token.
  res.status(200).json({ message: "Logout successful" });
};
