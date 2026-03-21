import { supabase } from "../config/supabase.config.js";
import path from "path";

/**
 * Upload an image to Supabase Storage
 */
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { bucket } = req.body;
    if (!bucket) {
      return res.status(400).json({ message: "Bucket name is required" });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    res.status(200).json({ publicUrl: data.publicUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
