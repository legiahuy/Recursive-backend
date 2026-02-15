import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.config.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Middleware to verify JWT token
 */
export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ message: "No token provided!" });
  }

  // Remove Bearer prefix if present
  const tokenString = token.startsWith("Bearer ")
    ? token.slice(7, token.length)
    : token;

  jwt.verify(tokenString, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized!" });
    }
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  });
};

/**
 * Middleware to check if user is admin
 */
export const isAdmin = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Require Admin Role!" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "Unable to validate user role!" });
  }
};
