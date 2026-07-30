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
 * Roles allowed into the admin area.
 * - `owner`: full access. Legacy `admin` accounts are treated as owner.
 * - `ar`: A&R — signing/catalog pipeline only (submissions, artists,
 *   releases, genres). No access to marketing/comms or settings.
 */
export const OWNER_ROLES = ["admin", "owner"];
export const STAFF_ROLES = ["admin", "owner", "ar"];

/**
 * Factory that builds a role guard. Looks up the caller's role once and
 * allows the request only when the role is in `allowedRoles`.
 */
const requireRoles = (allowedRoles) => async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res
        .status(403)
        .json({ message: "You don't have permission to perform this action." });
    }

    req.userRole = user.role;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Unable to validate user role!" });
  }
};

/**
 * Any staff member (owner or A&R). Gates the shared signing/catalog routes.
 */
export const isAdmin = requireRoles(STAFF_ROLES);

/**
 * Owner-only. Gates marketing/comms and settings (subscribers, email
 * templates, hero spotlights, news) that A&R must not touch.
 */
export const isOwner = requireRoles(OWNER_ROLES);
